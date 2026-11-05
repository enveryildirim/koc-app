import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { listStudents, studentNoMatcher } from "@/modules/enrollment/server";
import { gradeExam, LETTERS, maxScore, parseSections, resolveScoring, round2 } from "../domain";
import { getExam } from "./exams";

export type IncomingRow = { studentNo: string; booklet: string; answers: string };

/** OMR'den gelen [işaretli şık indeksleri] dizisini cevap dizisine çevirir. */
export function marksToAnswers(marks: number[][]) {
  return marks.map((m) => (m.length === 0 ? " " : m.length > 1 ? "*" : LETTERS[m[0]] ?? " ")).join("");
}

/**
 * Sonuç kaydı. İki biçim kabul edilir:
 *  - Optik tarama: { sheets: [{ studentNo, booklet, answers: number[][] }] }
 *  - TXT / elle:   { rows: [{ studentNo, booklet, answers: "ABC D*..." }], source: "TXT" | "MANUAL" }
 * Öğrenci numarasıyla eşleşmeyen satırlar `skipped`, kitapçık türü bu denemede olmayan satırlar `badBooklet` listesine düşer.
 * Tek kitapçıklı denemede kitapçık alanı yok sayılır (A).
 */
export async function importResults(ownerId: string, examId: string, body: Record<string, unknown>) {
  const exam = await getExam(ownerId, examId);
  let rows: IncomingRow[];
  let source: string;
  if (Array.isArray(body.sheets)) {
    rows = (body.sheets as { studentNo: string; booklet: string; answers: number[][] }[]).map((s) => ({
      studentNo: String(s.studentNo ?? ""),
      booklet: s.booklet,
      answers: marksToAnswers(s.answers ?? []),
    }));
    source = "OMR";
  } else if (Array.isArray(body.rows)) {
    rows = (body.rows as IncomingRow[]).map((r) => ({ studentNo: String(r.studentNo ?? ""), booklet: r.booklet, answers: String(r.answers ?? "") }));
    source = body.source === "MANUAL" ? "MANUAL" : "TXT";
  } else {
    throw invalid("Geçersiz istek.");
  }

  const studentIdOf = await studentNoMatcher(ownerId);
  const total = exam.secs.reduce((s, x) => s + x.count, 0);
  let saved = 0;
  const skipped: string[] = [];
  const badBooklet: string[] = [];
  for (const r of rows) {
    const studentId = studentIdOf(r.studentNo);
    if (!studentId) {
      skipped.push(r.studentNo || "(boş)");
      continue;
    }
    const given = String(r.booklet ?? "").trim().toUpperCase();
    const booklet = exam.letters.length === 1 ? "A" : (exam.letters as string[]).includes(given) ? given : null;
    if (!booklet) {
      badBooklet.push(`${r.studentNo || "(boş)"} (${given || "boş"})`);
      continue;
    }
    const answers = r.answers.toUpperCase().padEnd(total, " ").slice(0, total);
    const g = gradeExam(exam.secs, answers, booklet, exam.wrongPer, exam.scoringResolved);
    const data = { booklet, answers, stats: JSON.stringify(g.stats), totalNet: g.totalNet, score: g.score, source };
    await prisma.examResult.upsert({
      where: { examId_studentId: { examId: exam.id, studentId } },
      create: { examId: exam.id, studentId, ...data },
      update: data,
    });
    saved++;
  }
  return { saved, skipped, badBooklet };
}

/** Denemedeki bir sonucu siler; sonuç bu denemeye / kuruma ait değilse notFound. */
export async function deleteResult(ownerId: string, examId: string, resultId: string) {
  const r = await prisma.examResult.findFirst({ where: { id: resultId, examId, exam: { ownerId } }, select: { id: true } });
  if (!r) throw notFound();
  await prisma.examResult.delete({ where: { id: resultId } });
}

/** Sıralı liste ve karneler için: sonuçlar + sıralamalar + sınıf/genel ortalamalar. Deneme yoksa / başka kurumunsa null. */
export async function examReport(ownerId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerId },
    include: { results: { include: { student: { include: { classroom: true } } } } },
  });
  if (!exam) return null;
  const secs = parseSections(exam.sections);
  const scoring = resolveScoring(exam.type, secs, exam.scoring);
  const rows = exam.results
    .map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentNo: r.student.studentNo,
      name: `${r.student.firstName} ${r.student.lastName}`,
      className: r.student.classroom?.name ?? (r.student.external ? "Kurum dışı" : "—"),
      classId: r.student.classroomId ?? "_",
      booklet: r.booklet,
      answers: r.answers,
      source: r.source,
      stats: JSON.parse(r.stats) as { d: number; y: number; b: number; net: number }[],
      totalNet: r.totalNet,
      score: r.score,
      rank: 0,
      classRank: 0,
      percentile: 0,
    }))
    // Sıralama tahmini puana göre (eşitlikte net)
    .sort((a, b) => b.score - a.score || b.totalNet - a.totalNet);

  const same = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.score === b.score && a.totalNet === b.totalNet;
  rows.forEach((r, i) => (r.rank = i > 0 && same(rows[i - 1], r) ? rows[i - 1].rank : i + 1));
  // Kurum içi yüzdelik dilim: öğrenci, kurumdaki öğrencilerin üst %kaçında
  rows.forEach((r) => (r.percentile = Math.max(1, Math.round((r.rank / rows.length) * 100))));
  const byClass = new Map<string, typeof rows>();
  for (const r of rows) byClass.set(r.classId, [...(byClass.get(r.classId) ?? []), r]);
  for (const list of byClass.values()) list.forEach((r, i) => (r.classRank = i > 0 && same(list[i - 1], r) ? list[i - 1].classRank : i + 1));

  const avg = (list: typeof rows) => ({
    n: list.length,
    sections: secs.map((_, si) => mean(list.map((r) => r.stats[si]?.net ?? 0))),
    sectionD: secs.map((_, si) => mean(list.map((r) => r.stats[si]?.d ?? 0))),
    total: mean(list.map((r) => r.totalNet)),
    score: mean(list.map((r) => r.score)),
  });
  const classAvg = new Map([...byClass.entries()].map(([k, list]) => [k, { name: list[0].className, size: list.length, ...avg(list) }]));
  return { exam, secs, scoring, maxScore: maxScore(secs, scoring), rows, general: avg(rows), classAvg };
}

export type ExamReport = NonNullable<Awaited<ReturnType<typeof examReport>>>;

/**
 * Denemeye girmeyenler: sınava en az bir öğrencisi giren sınıfların (ya da verilen sınıfın)
 * kurum içi öğrencilerinden sonucu olmayanlar. `expected` beklenen katılımcı sayısıdır.
 */
export async function examAbsentees(ownerId: string, examId: string, classroomId?: string) {
  await getExam(ownerId, examId);
  const taken = await prisma.examResult.findMany({ where: { examId }, select: { studentId: true, student: { select: { classroomId: true } } } });
  const takenIds = new Set(taken.map((r) => r.studentId));
  const classIds = classroomId ? [classroomId] : [...new Set(taken.map((r) => r.student.classroomId).filter((c): c is string => !!c))];
  const expected = await listStudents(ownerId, { external: false, classroomId: classIds }, "class");
  return { expected: expected.length, missing: expected.filter((s) => !takenIds.has(s.id)) };
}

/** Verilen denemelerin (yalnızca kurumun kendi denemeleri) tüm sonuçları, öğrenci ve sınıfıyla. */
export async function examResults(ownerId: string, examIds: string[]) {
  return prisma.examResult.findMany({
    where: { examId: { in: examIds }, exam: { ownerId } },
    include: { student: { include: { classroom: true } } },
  });
}

/** Öğrencinin tüm deneme sonuçları (deneme bilgisiyle), deneme tarihine göre eskiden yeniye. Başka kurumun öğrencisi → []. */
export async function studentResults(ownerId: string, studentId: string) {
  return prisma.examResult.findMany({
    where: { studentId, exam: { ownerId } },
    include: { exam: true },
    orderBy: { exam: { date: "asc" } },
  });
}

/**
 * Öğrencinin her denemedeki sınıf içi durumu (examId → { classAvg, rank, peers }).
 * Karşılaştırma grubu öğrencinin sınıfı; sınıfı yoksa denemeye giren herkes. Sıra tahmini puana göredir.
 */
export async function classStandings(ownerId: string, classroomId: string | null, results: { examId: string; score: number }[]) {
  const peers = await prisma.examResult.findMany({
    where: { examId: { in: results.map((r) => r.examId) }, exam: { ownerId }, ...(classroomId ? { student: { classroomId } } : {}) },
    select: { examId: true, totalNet: true, score: true },
  });
  return new Map(
    results.map((r) => {
      const list = peers.filter((p) => p.examId === r.examId);
      const classAvg = list.length ? round2(list.reduce((s, p) => s + p.totalNet, 0) / list.length) : 0;
      return [r.examId, { classAvg, rank: list.filter((p) => p.score > r.score).length + 1, peers: list.length }];
    }),
  );
}

const mean = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : 0);
