/** Analiz & Uyarılar merkezi için veri katmanı (sunucu). */
import { prisma } from "@/shared/db";
import { ExamSection, parseSections, round2 } from "@/modules/exams";
import { ymd } from "@/shared/date";
import { RISK_FLAGS, RISK_RULES, type RiskFlag } from "../risk";

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

export async function classProgress(ownerId: string, type: string, section: string) {
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
    const vals = list.map((r) => valueOf(e, r)).filter((v): v is number => v !== null);
    return { net: mean(vals), score: mean(list.map((r) => r.score)), n: list.length };
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

/* ================================== 2. Risk ================================== */

export async function riskList(ownerId: string, classroomId?: string) {
  const since = new Date(Date.now() - RISK_RULES.days * 86400000);
  const sinceYmd = ymd(since);
  const students = await prisma.student.findMany({
    where: { ownerId, external: false, classroomId: classroomId || { not: null } },
    include: { classroom: true },
    orderBy: { studentNo: "asc" },
  });
  const ids = students.map((s) => s.id);
  const [results, att, hw] = await Promise.all([
    prisma.examResult.findMany({
      where: { exam: { ownerId } },
      select: { studentId: true, totalNet: true, examId: true, student: { select: { classroomId: true } }, exam: { select: { id: true, name: true, type: true, date: true } } },
    }),
    prisma.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids }, session: { ownerId, date: { gte: sinceYmd } } }, _count: true }),
    prisma.homeworkStatus.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: ids }, homework: { ownerId, dueDate: { gte: since, lte: new Date() } } },
      _count: true,
    }),
  ]);

  // Sınıfın en son girdiği deneme (en az bir sınıf öğrencisinin sonucu olan)
  const lastExamOfClass = new Map<string, { id: string; name: string; type: string; date: Date }>();
  for (const r of results) {
    const c = r.student.classroomId;
    if (!c) continue;
    const cur = lastExamOfClass.get(c);
    if (!cur || r.exam.date > cur.date) lastExamOfClass.set(c, r.exam);
  }
  const byStudent = new Map<string, typeof results>();
  for (const r of results) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);

  const count = (arr: { studentId: string; status: string; _count: number }[], id: string, st: string) =>
    arr.find((a) => a.studentId === id && a.status === st)?._count ?? 0;

  const rows = students.map((s) => {
    const flags: RiskFlag[] = [];
    const lastClassExam = s.classroomId ? lastExamOfClass.get(s.classroomId) : undefined;
    const mine = (byStudent.get(s.id) ?? []).sort((a, b) => a.exam.date.getTime() - b.exam.date.getTime());
    let lastNet: number | null = null;
    let delta: number | null = null;
    let lastExamName = "";
    if (lastClassExam) {
      if (!mine.some((r) => r.examId === lastClassExam.id)) flags.push("MISSED_EXAM");
      const sameType = mine.filter((r) => r.exam.type === lastClassExam.type);
      const last = sameType[sameType.length - 1];
      const prev = sameType[sameType.length - 2];
      if (last) {
        lastNet = last.totalNet;
        lastExamName = last.exam.name;
      }
      if (last && prev) {
        delta = round2(last.totalNet - prev.totalNet);
        if (delta <= -RISK_RULES.netDropAbs || (prev.totalNet > 0 && delta <= -RISK_RULES.netDropRel * prev.totalNet)) flags.push("NET_DROP");
      }
    }
    const present = count(att, s.id, "PRESENT") + count(att, s.id, "LATE");
    const attTotal = present + count(att, s.id, "ABSENT") + count(att, s.id, "EXCUSED");
    const attRate = attTotal ? Math.round((present / attTotal) * 100) : null;
    if (attRate !== null && attRate < RISK_RULES.attendanceMin) flags.push("ATTENDANCE");
    const done = count(hw, s.id, "DONE");
    const graded = done + count(hw, s.id, "PARTIAL") + count(hw, s.id, "NOT_DONE");
    const hwRate = graded ? Math.round((done / graded) * 100) : null;
    if (hwRate !== null && hwRate < RISK_RULES.homeworkMin) flags.push("HOMEWORK");
    const score = flags.reduce((a, f) => a + RISK_FLAGS[f].weight, 0);
    return {
      id: s.id,
      studentNo: s.studentNo,
      name: `${s.firstName} ${s.lastName}`,
      className: s.classroom?.name ?? "—",
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      lastNet,
      lastExamName,
      delta,
      attRate,
      absent: count(att, s.id, "ABSENT"),
      hwRate,
      flags,
      score,
      level: score >= 4 ? "Yüksek" : score >= 2 ? "Orta" : "Düşük",
    };
  });

  const risky = rows.filter((r) => r.flags.length > 0).sort((a, b) => b.score - a.score || (a.attRate ?? 101) - (b.attRate ?? 101));
  const flagCounts = Object.fromEntries((Object.keys(RISK_FLAGS) as RiskFlag[]).map((f) => [f, risky.filter((r) => r.flags.includes(f)).length])) as Record<RiskFlag, number>;
  return { total: rows.length, risky, flagCounts };
}

/* ========================== 3. Öğretmen / ders performansı ========================== */

const ALIASES: Record<string, string> = {
  "temel matematik": "matematik",
  "t.c. inkılap tarihi": "inkılap tarihi",
  "tc inkılap tarihi": "inkılap tarihi",
  "t.c. inkılap tarihi ve atatürkçülük": "inkılap tarihi",
  "inkılap tarihi ve atatürkçülük": "inkılap tarihi",
  "din kültürü ve ahlak bilgisi": "din kültürü",
  "ingilizce": "ingilizce",
  "yabancı dil": "ingilizce",
};

export function normSubject(s: string) {
  const n = s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  return ALIASES[n] ?? n.replace(/\./g, "").trim();
}

export function subjectMatches(section: string, subject: string) {
  const a = normSubject(section);
  const b = normSubject(subject);
  return a === b || a.includes(b) || b.includes(a);
}

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
        branch: slot.teacher.branch,
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
