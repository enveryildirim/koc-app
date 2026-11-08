/** Analiz & Uyarılar merkezi için veri katmanı (sunucu). */
import { prisma } from "@/shared/db";
import { splitOutliers } from "@/shared/stats";
import { subjectMatches } from "@/shared/subjects";
import { ExamSection, parseSections, round2 } from "@/modules/exams";
import { teacherSub } from "@/modules/schedule";

type Stat = { d: number; y: number; b: number; net: number };

const TYPE_ORDER = ["LGS", "TYT", "AYT", "SERBEST"];
const mean = (a: number[]) => (a.length ? round2(a.reduce((s, x) => s + x, 0) / a.length) : null);

/** Kurumda sonucu olan sınav türleri (sabit sırada). */
export async function examTypesOf(ownerId: string) {
  const rows = await prisma.exam.findMany({ where: { ownerId, results: { some: {} } }, select: { type: true }, distinct: ["type"] });
  const set = new Set(rows.map((r) => r.type));
  return TYPE_ORDER.filter((t) => set.has(t)).concat([...set].filter((t) => !TYPE_ORDER.includes(t)));
}

/* =============================== 1. Sınıf gelişimi =============================== */

/** `trim`: her hücrede (sınıf × deneme) uç değerler o grubun içinde ayrılır; `removed` kaç kişinin ayrıldığıdır. */
export async function classProgress(ownerId: string, type: string, section: string, trim = false) {
  const exams = await prisma.exam.findMany({
    where: { ownerId, type, results: { some: {} } },
    orderBy: { date: "asc" },
    include: { results: { select: { totalNet: true, score: true, stats: true, student: { select: { classroomId: true } } } } },
  });
  const secsOf = new Map(exams.map((e) => [e.id, parseSections(e.sections)]));
  // Bölüm adları: tüm denemelerde geçen adlar (ilk görüldüğü sırayla)
  const sectionNames: string[] = [];
  for (const e of exams) for (const s of secsOf.get(e.id)!) if (!sectionNames.includes(s.name)) sectionNames.push(s.name);
  const sel = sectionNames.includes(section) ? section : "";

  const valueOf = (e: (typeof exams)[number], r: (typeof exams)[number]["results"][number]) => {
    if (!sel) return r.totalNet;
    const idx = secsOf.get(e.id)!.findIndex((s) => s.name === sel);
    if (idx < 0) return null;
    return (JSON.parse(r.stats) as Stat[])[idx]?.net ?? null;
  };
  const maxOf = (e: (typeof exams)[number]) => {
    const secs = secsOf.get(e.id)!;
    return sel ? (secs.find((s) => s.name === sel)?.count ?? 0) : secs.reduce((a, s) => a + s.count, 0);
  };

  const classIds = new Set<string>();
  for (const e of exams) for (const r of e.results) if (r.student.classroomId) classIds.add(r.student.classroomId);
  const classrooms = await prisma.classroom.findMany({ where: { ownerId, id: { in: [...classIds] } }, orderBy: { name: "asc" } });

  const cell = (list: (typeof exams)[number]["results"], e: (typeof exams)[number]) => {
    if (!trim) {
      const vals = list.map((r) => valueOf(e, r)).filter((v): v is number => v !== null);
      return { net: mean(vals), score: mean(list.map((r) => r.score)), n: list.length, removed: 0 };
    }
    const withVal = list.flatMap((r) => {
      const v = valueOf(e, r);
      return v === null ? [] : [{ v, score: r.score }];
    });
    const s = splitOutliers(withVal, (x) => x.v);
    return { net: mean(s.kept.map((x) => x.v)), score: mean(s.kept.map((x) => x.score)), n: list.length, removed: s.low.length + s.high.length };
  };

  const rows = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    cells: exams.map((e) => {
      const list = e.results.filter((r) => r.student.classroomId === c.id);
      return list.length ? cell(list, e) : null;
    }),
  }));
  const total = exams.map((e) => cell(e.results, e));

  return {
    sectionNames,
    section: sel,
    exams: exams.map((e) => ({ id: e.id, name: e.name, date: e.date, max: maxOf(e) })),
    rows,
    total,
  };
}

/* ========================== 2. Öğretmen / ders performansı ========================== */

export async function teacherPerformance(ownerId: string) {
  const [slots, exams] = await Promise.all([
    prisma.scheduleSlot.findMany({ where: { ownerId }, include: { teacher: true, classroom: true } }),
    prisma.exam.findMany({
      where: { ownerId, results: { some: {} } },
      orderBy: { date: "asc" },
      include: { results: { select: { stats: true, student: { select: { classroomId: true } } } } },
    }),
  ]);
  const parsed = exams.map((e) => ({ ...e, secs: parseSections(e.sections) as ExamSection[] }));

  // Benzersiz (öğretmen, sınıf, ders) üçlüleri
  const triples = new Map<string, (typeof slots)[number]>();
  for (const s of slots) triples.set(`${s.teacherId}|${s.classroomId}|${s.subject}`, s);

  const avgSection = (e: (typeof parsed)[number], idx: number, classroomId?: string) =>
    mean(
      e.results
        .filter((r) => !classroomId || r.student.classroomId === classroomId)
        .map((r) => (JSON.parse(r.stats) as Stat[])[idx]?.net)
        .filter((v): v is number => typeof v === "number"),
    );

  type Row = {
    teacherId: string;
    teacher: string;
    branch: string;
    className: string;
    subject: string;
    section: string;
    type: string;
    count: number;
    firstExam: string;
    lastExam: string;
    exams: number;
    first: number | null;
    last: number | null;
    change: number | null;
    instAvg: number | null;
    diff: number | null;
    success: number | null;
  };
  const rows: Row[] = [];
  const unmatched: { teacher: string; className: string; subject: string }[] = [];

  for (const slot of triples.values()) {
    // Sınıfın sonuç verdiği ve bu derse karşılık bölüm içeren denemeler, türe göre
    const byType = new Map<string, { exam: (typeof parsed)[number]; idx: number }[]>();
    for (const e of parsed) {
      if (!e.results.some((r) => r.student.classroomId === slot.classroomId)) continue;
      const idx = e.secs.findIndex((s) => subjectMatches(s.name, slot.subject));
      if (idx < 0) continue;
      byType.set(e.type, [...(byType.get(e.type) ?? []), { exam: e, idx }]);
    }
    if (byType.size === 0) {
      unmatched.push({ teacher: slot.teacher.name, className: slot.classroom.name, subject: slot.subject });
      continue;
    }
    for (const [type, list] of byType) {
      const f = list[0];
      const l = list[list.length - 1];
      const first = avgSection(f.exam, f.idx, slot.classroomId);
      const last = avgSection(l.exam, l.idx, slot.classroomId);
      const instAvg = avgSection(l.exam, l.idx);
      const count = l.exam.secs[l.idx].count;
      rows.push({
        teacherId: slot.teacherId,
        teacher: slot.teacher.name,
        branch: teacherSub(slot.teacher),
        className: slot.classroom.name,
        subject: slot.subject,
        section: l.exam.secs[l.idx].name,
        type,
        count,
        firstExam: f.exam.name,
        lastExam: l.exam.name,
        exams: list.length,
        first,
        last,
        change: list.length > 1 && first !== null && last !== null ? round2(last - first) : null,
        instAvg,
        diff: last !== null && instAvg !== null ? round2(last - instAvg) : null,
        success: last !== null && count ? Math.round((last / count) * 100) : null,
      });
    }
  }
  rows.sort((a, b) => a.teacher.localeCompare(b.teacher, "tr") || a.className.localeCompare(b.className, "tr") || a.type.localeCompare(b.type));

  const teachers = [...new Set(rows.map((r) => r.teacherId))].map((id) => {
    const list = rows.filter((r) => r.teacherId === id);
    const changes = list.map((r) => r.change).filter((v): v is number => v !== null);
    const diffs = list.map((r) => r.diff).filter((v): v is number => v !== null);
    const succ = list.map((r) => r.success).filter((v): v is number => v !== null);
    return {
      id,
      name: list[0].teacher,
      branch: list[0].branch,
      rows: list,
      avgChange: mean(changes),
      avgDiff: mean(diffs),
      avgSuccess: succ.length ? Math.round(succ.reduce((a, b) => a + b, 0) / succ.length) : null,
    };
  });
  unmatched.sort((a, b) => a.teacher.localeCompare(b.teacher, "tr"));
  return { teachers, rows, unmatched };
}
