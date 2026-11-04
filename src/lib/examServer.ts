import { prisma } from "./db";
import { ExamSection, gradeExam, LETTERS, maxScore, normNo, parseSections, resolveScoring } from "./exam";

export async function loadExam(ownerId: string, id: string) {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam || exam.ownerId !== ownerId) return null;
  const secs = parseSections(exam.sections);
  return { ...exam, secs, scoringResolved: resolveScoring(exam.type, secs, exam.scoring) };
}

export type IncomingRow = { studentNo: string; booklet: string; answers: string };

/** OMR'den gelen [işaretli şık indeksleri] dizisini cevap dizisine çevirir. */
export function marksToAnswers(marks: number[][]) {
  return marks.map((m) => (m.length === 0 ? " " : m.length > 1 ? "*" : LETTERS[m[0]] ?? " ")).join("");
}

/** Sonuçları öğrenci numarasıyla eşleştirip kaydeder (aynı öğrencinin eski sonucu güncellenir). */
export async function saveResults(
  exam: { id: string; ownerId: string; type: string; scoring: string; secs: ExamSection[]; wrongPer: number },
  rows: IncomingRow[],
  source: string,
) {
  const students = await prisma.student.findMany({ where: { ownerId: exam.ownerId }, select: { id: true, studentNo: true } });
  const byNo = new Map(students.map((s) => [normNo(s.studentNo), s.id]));
  const total = exam.secs.reduce((s, x) => s + x.count, 0);
  const scoring = resolveScoring(exam.type, exam.secs, exam.scoring);
  let saved = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const studentId = byNo.get(normNo(r.studentNo));
    if (!studentId) {
      skipped.push(r.studentNo || "(boş)");
      continue;
    }
    const booklet = r.booklet === "B" ? "B" : "A";
    const answers = r.answers.toUpperCase().padEnd(total, " ").slice(0, total);
    const g = gradeExam(exam.secs, answers, booklet, exam.wrongPer, scoring);
    const data = { booklet, answers, stats: JSON.stringify(g.stats), totalNet: g.totalNet, score: g.score, source };
    await prisma.examResult.upsert({
      where: { examId_studentId: { examId: exam.id, studentId } },
      create: { examId: exam.id, studentId, ...data },
      update: data,
    });
    saved++;
  }
  return { saved, skipped };
}

/** Cevap anahtarı değişince tüm sonuçları yeniden hesaplar. */
export async function regrade(examId: string) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { results: true } });
  const secs = parseSections(exam.sections);
  const scoring = resolveScoring(exam.type, secs, exam.scoring);
  for (const r of exam.results) {
    const g = gradeExam(secs, r.answers, r.booklet, exam.wrongPer, scoring);
    await prisma.examResult.update({ where: { id: r.id }, data: { stats: JSON.stringify(g.stats), totalNet: g.totalNet, score: g.score } });
  }
}

/** Sıralı liste ve karneler için: sonuçlar + sıralamalar + sınıf/genel ortalamalar. */
export async function examReport(examId: string) {
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    include: { results: { include: { student: { include: { classroom: true } } } } },
  });
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

const mean = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : 0);
