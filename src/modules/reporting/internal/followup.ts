import { prisma } from "@/shared/db";
import { addDays } from "@/shared/date";
import { lessonsOn } from "@/modules/schedule/server";
import { holidaysOn, planOverview } from "@/modules/planning/server";
import { schoolYearOf } from "@/modules/planning";
import { parseCriteria } from "@/modules/assessment";

/*
 * Takibat (okuma modeli): "Dikkat isteyenler", sınıf karşılaştırması, ders analizi, öğretmen etkinliği.
 * Her satır bir sonraki adımı gösterecek kadar açıklama taşır. Ölçekler farklı olduğu için notlar yüzdedir.
 * `classIds`: kapsam (etüt mesulünde kendi sınıfları); null = bütün kurum.
 */

export const FOLLOW_RULES = {
  absentDays: 14,
  absentMin: 3,
  /** Devamsızlık oranı eşiği (son 14 gündeki derslerine göre); kalabalık programda tek başına sayı yanıltır */
  absentRate: 0.15,
  dropPoints: 15,
  lowAvg: 50,
  quietDays: 30,
  entryDays: 7,
  homeworkDays: 30,
  homeworkMissMin: 2,
};

type Reason = { kind: "devam" | "not" | "odev"; text: string };
export type AttentionStudent = { id: string; name: string; classroom: string; reasons: Reason[] };

const pct = (n: number) => `%${Math.round(n)}`;
const shortDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** Kapsamdaki öğrenciler (ana sınıf ya da ek üyelik), kurum dışı hariç. */
async function scopeStudents(ownerId: string, classIds: string[] | null) {
  return prisma.student.findMany({
    where: {
      ownerId,
      external: false,
      ...(classIds ? { OR: [{ classroomId: { in: classIds } }, { memberships: { some: { classroomId: { in: classIds } } } }] } : { classroomId: { not: null } }),
    },
    include: { classroom: { select: { name: true } } },
  });
}

/** Son `days` günde yoklaması alınmamış (tatil olmayan) dersler; öğretmene göre. */
async function missingEntries(ownerId: string, today: string, days: number, classIds: string[] | null) {
  const out: { teacherId: string; teacher: string; classroom: string; subject: string; date: string }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    const [lessons, holidays] = await Promise.all([lessonsOn(ownerId, d), holidaysOn(ownerId, d)]);
    for (const l of lessons) {
      if (l.taken || (classIds && !classIds.includes(l.classroomId))) continue;
      if (holidays.some((h) => !h.classroomId || h.classroomId === l.classroomId)) continue;
      out.push({ teacherId: l.teacherId, teacher: l.teacher, classroom: l.classroom, subject: l.subject, date: d });
    }
  }
  return out;
}

/** Dikkat isteyenler: öğrenciler (devam, not, ödev), sessiz dersler, geride planlar, eksik girişler. */
export async function attention(ownerId: string, today: string, classIds: string[] | null) {
  const R = FOLLOW_RULES;
  const students = await scopeStudents(ownerId, classIds);
  const ids = students.map((s) => s.id);
  const byId = new Map<string, AttentionStudent>(
    students.map((s) => [s.id, { id: s.id, name: `${s.firstName} ${s.lastName}`, classroom: s.classroom?.name ?? "", reasons: [] }]),
  );

  // Devam: son 14 gün ve önceki 14 gün
  const from2 = addDays(today, -2 * R.absentDays);
  const from1 = addDays(today, -R.absentDays);
  const att = await prisma.attendance.findMany({
    where: { studentId: { in: ids }, session: { date: { gte: from2, lt: today } } },
    select: { studentId: true, status: true, session: { select: { date: true } } },
  });
  const recent = new Map<string, number>();
  const lessons = new Map<string, number>();
  const before = new Map<string, number>();
  for (const a of att) {
    const isRecent = a.session.date >= from1;
    if (isRecent) lessons.set(a.studentId, (lessons.get(a.studentId) ?? 0) + 1);
    if (a.status !== "ABSENT") continue;
    const m = isRecent ? recent : before;
    m.set(a.studentId, (m.get(a.studentId) ?? 0) + 1);
  }
  for (const [id, n] of recent) {
    const total = lessons.get(id) ?? 0;
    if (n < R.absentMin || n / total < R.absentRate) continue;
    byId.get(id)?.reasons.push({ kind: "devam", text: `Son ${R.absentDays} günde ${total} dersin ${n} tanesine gelmedi (önceki ${R.absentDays} günde ${before.get(id) ?? 0})` });
  }

  // Not: aynı derste son iki not arasında düşüş ya da son 30 gün ortalaması düşük
  const quietFrom = addDays(today, -R.quietDays);
  const scores = await prisma.assessmentScore.findMany({
    where: { studentId: { in: ids }, absent: false, percent: { not: null } },
    select: { studentId: true, percent: true, assessment: { select: { date: true, course: { select: { id: true, name: true } } } } },
    orderBy: { assessment: { date: "desc" } },
  });
  const byStudentCourse = new Map<string, typeof scores>();
  for (const s of scores) {
    const k = `${s.studentId}|${s.assessment.course.id}`;
    byStudentCourse.set(k, [...(byStudentCourse.get(k) ?? []), s]);
  }
  for (const list of byStudentCourse.values()) {
    const st = byId.get(list[0].studentId);
    if (!st) continue;
    const course = list[0].assessment.course.name;
    if (list.length >= 2 && list[1].percent! - list[0].percent! >= R.dropPoints) {
      st.reasons.push({ kind: "not", text: `${course}: ${pct(list[1].percent!)} → ${pct(list[0].percent!)}` });
      continue;
    }
    const last30 = list.filter((x) => x.assessment.date >= quietFrom);
    const avg = last30.length ? last30.reduce((a, x) => a + x.percent!, 0) / last30.length : null;
    if (avg !== null && avg < R.lowAvg) st.reasons.push({ kind: "not", text: `${course} ortalaması ${pct(avg)}` });
  }

  // Ödev: son 30 günde yapılmayanlar
  const hw = await prisma.homeworkStatus.groupBy({
    by: ["studentId"],
    where: { studentId: { in: ids }, status: "NOT_DONE", homework: { dueDate: { gte: new Date(addDays(today, -R.homeworkDays) + "T00:00:00"), lt: new Date(today + "T00:00:00") } } },
    _count: true,
  });
  for (const h of hw) {
    if (h._count >= R.homeworkMissMin) byId.get(h.studentId)?.reasons.push({ kind: "odev", text: `Son ${R.homeworkDays} günde ${h._count} ödevi yapmadı` });
  }

  // Sessiz dersler: son 30 günde hiç sözlü / yazılı yapılmamış (etüt ve deneme ile ölçülen hazırlık dersleri hariç)
  const courses = await prisma.course.findMany({
    where: { ownerId, kind: { notIn: ["STUDY", "PREP"] }, ...(classIds ? { classroomId: { in: classIds } } : {}) },
    include: { classroom: { select: { name: true } }, teacher: { select: { name: true } }, assessments: { select: { date: true }, orderBy: { date: "desc" }, take: 1 } },
  });
  const quiet = courses
    .filter((c) => !c.assessments[0] || c.assessments[0].date < quietFrom)
    .map((c) => ({ classroomId: c.classroomId, classroom: c.classroom.name, course: c.name, teacher: c.teacher?.name ?? null, last: c.assessments[0]?.date ?? null, external: c.external }))
    .sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.course.localeCompare(b.course, "tr"));

  // Plana göre geride kalan dersler
  const plans = (await planOverview(ownerId, schoolYearOf(today), today))
    .filter((p) => p.plan && p.plan.progress.behindWeeks > 0 && (!classIds || classIds.includes(p.classroomId)))
    .map((p) => ({ planId: p.plan!.id, classroom: p.classroom, subject: p.subject, teachers: p.teachers, behindWeeks: p.plan!.progress.behindWeeks, late: p.plan!.progress.late }))
    .sort((a, b) => b.behindWeeks - a.behindWeeks);

  // Girişi eksik dersler (son 7 gün), öğretmene göre
  const missing = await missingEntries(ownerId, today, R.entryDays, classIds);
  const byTeacher = new Map<string, { teacherId: string; teacher: string; count: number; lessons: string[] }>();
  for (const m of missing) {
    const t = byTeacher.get(m.teacherId) ?? { teacherId: m.teacherId, teacher: m.teacher, count: 0, lessons: [] };
    t.count++;
    if (t.lessons.length < 4) t.lessons.push(`${shortDate(m.date)} ${m.classroom} ${m.subject}`);
    byTeacher.set(m.teacherId, t);
  }

  const flagged = [...byId.values()]
    .filter((s) => s.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.name.localeCompare(b.name, "tr"));
  return { students: flagged, quiet, plans, entries: [...byTeacher.values()].sort((a, b) => b.count - a.count), scopeSize: students.length };
}

/** Sınıfların karşılaştırması (son 30 gün): devam, ödev, değerlendirme ortalaması, geride plan. */
export async function classComparison(ownerId: string, today: string, classIds: string[] | null) {
  const from = addDays(today, -30);
  const classes = await prisma.classroom.findMany({
    where: { ownerId, ...(classIds ? { id: { in: classIds } } : {}) },
    include: { mentor: { select: { name: true } }, _count: { select: { students: true, members: true } } },
  });
  const plans = await planOverview(ownerId, schoolYearOf(today), today);
  const rows = [];
  for (const c of classes) {
    const [att, hw, sc] = await Promise.all([
      prisma.attendance.groupBy({ by: ["status"], where: { session: { classroomId: c.id, date: { gte: from, lt: today } } }, _count: true }),
      prisma.homeworkStatus.groupBy({ by: ["status"], where: { homework: { classroomId: c.id, dueDate: { gte: new Date(from + "T00:00:00"), lt: new Date(today + "T00:00:00") } } }, _count: true }),
      prisma.assessmentScore.aggregate({ where: { absent: false, percent: { not: null }, assessment: { date: { gte: from }, course: { classroomId: c.id } } }, _avg: { percent: true }, _count: true }),
    ]);
    const n = (l: { status: string; _count: number }[], k: string) => l.find((x) => x.status === k)?._count ?? 0;
    const attTotal = att.reduce((a, x) => a + x._count, 0);
    const hwDue = n(hw, "DONE") + n(hw, "PARTIAL") + n(hw, "NOT_DONE");
    rows.push({
      id: c.id,
      name: c.name,
      mentor: c.mentor?.name ?? null,
      students: c._count.students + c._count.members,
      attendance: attTotal ? ((n(att, "PRESENT") + n(att, "LATE")) / attTotal) * 100 : null,
      homework: hwDue ? ((n(hw, "DONE") + n(hw, "PARTIAL") * 0.5) / hwDue) * 100 : null,
      assessAvg: sc._avg.percent,
      assessCount: sc._count,
      behind: plans.filter((p) => p.classroomId === c.id && p.plan && p.plan.progress.behindWeeks > 0).length,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true }));
}

/**
 * Ders analizi: aynı adlı dersin sınıflar arası durumu (son 60 gün). Kriter adına göre ortalamalar
 * birleştirilir; en zayıf kriter öne çıkar. Plan ilerlemesi de yanında.
 */
export async function courseAnalysis(ownerId: string, today: string, classIds: string[] | null) {
  const from = addDays(today, -60);
  const [courses, plans] = await Promise.all([
    prisma.course.findMany({
      where: { ownerId, kind: { not: "STUDY" }, ...(classIds ? { classroomId: { in: classIds } } : {}) },
      include: {
        classroom: { select: { name: true } },
        teacher: { select: { name: true } },
        assessments: { where: { date: { gte: from } }, include: { scores: { where: { absent: false }, select: { scores: true, percent: true } } } },
      },
    }),
    planOverview(ownerId, schoolYearOf(today), today),
  ]);
  type Row = {
    courseId: string; classroomId: string; classroom: string; teacher: string | null; external: boolean; count: number; avg: number | null;
    weakest: { name: string; avg: number } | null; plan: { id: string; rate: number; behindWeeks: number } | null;
  };
  const groups = new Map<string, { name: string; kind: string; rows: Row[]; crit: Map<string, { sum: number; n: number }> }>();
  for (const c of courses) {
    const g = groups.get(c.name) ?? { name: c.name, kind: c.kind, rows: [] as Row[], crit: new Map<string, { sum: number; n: number }>() };
    const percents: number[] = [];
    const crit = new Map<string, { sum: number; n: number }>();
    for (const a of c.assessments) {
      const cr = parseCriteria(a.criteria);
      for (const s of a.scores) {
        if (s.percent !== null) percents.push(s.percent);
        const v = JSON.parse(s.scores) as number[];
        cr.forEach((k, i) => {
          if (typeof v[i] !== "number") return;
          for (const m of [crit, g.crit]) {
            const x = m.get(k.name) ?? { sum: 0, n: 0 };
            x.sum += (v[i] / k.max) * 100;
            x.n++;
            m.set(k.name, x);
          }
        });
      }
    }
    const plan = plans.find((p) => p.classroomId === c.classroomId && p.subject === c.name)?.plan ?? null;
    const weakest = [...crit].map(([name, x]) => ({ name, avg: x.sum / x.n })).sort((a, b) => a.avg - b.avg)[0] ?? null;
    g.rows.push({
      courseId: c.id, classroomId: c.classroomId, classroom: c.classroom.name, teacher: c.teacher?.name ?? null, external: c.external,
      count: c.assessments.length, avg: percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null,
      weakest, plan: plan ? { id: plan.id, rate: plan.progress.rate, behindWeeks: plan.progress.behindWeeks } : null,
    });
    groups.set(c.name, g);
  }
  return [...groups.values()]
    .map((g) => ({
      name: g.name,
      kind: g.kind,
      criteria: [...g.crit].map(([name, x]) => ({ name, avg: x.sum / x.n })).sort((a, b) => a.avg - b.avg),
      rows: g.rows.sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

/**
 * Öğretmen etkinliği (son 14 gün): ders sayısı, yoklaması alınan, işaretlenen konu, açılan değerlendirme,
 * son giriş. Sıralama değil, etkinlik takibi: ada göre sıralıdır.
 */
export async function teacherActivity(ownerId: string, today: string) {
  const days = 14;
  const from = addDays(today, -days);
  const teachers = await prisma.teacher.findMany({ where: { ownerId }, select: { id: true, name: true, role: true } });
  const lessons = new Map<string, { total: number; taken: number }>();
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    const [ls, holidays] = await Promise.all([lessonsOn(ownerId, d), holidaysOn(ownerId, d)]);
    for (const l of ls) {
      if (!l.taken && holidays.some((h) => !h.classroomId || h.classroomId === l.classroomId)) continue;
      const x = lessons.get(l.teacherId) ?? { total: 0, taken: 0 };
      x.total++;
      if (l.taken) x.taken++;
      lessons.set(l.teacherId, x);
    }
  }
  const [assess, sessions, slots, plans] = await Promise.all([
    prisma.assessment.groupBy({ by: ["teacherId"], where: { ownerId, date: { gte: from } }, _count: true, _max: { date: true } }),
    prisma.lessonSession.groupBy({ by: ["teacherId"], where: { ownerId, date: { gte: from, lt: today }, attendances: { some: {} } }, _max: { date: true } }),
    prisma.scheduleSlot.findMany({ where: { ownerId }, select: { teacherId: true, classroomId: true, subject: true } }),
    prisma.lessonPlan.findMany({ where: { ownerId, year: schoolYearOf(today) }, select: { classroomId: true, subject: true, items: { select: { doneDate: true } } } }),
  ]);
  return teachers
    .map((t) => {
      const mine = new Set(slots.filter((s) => s.teacherId === t.id).map((s) => `${s.classroomId}|${s.subject}`));
      const myPlans = plans.filter((p) => mine.has(`${p.classroomId}|${p.subject}`));
      const topics = myPlans.reduce((a, p) => a + p.items.filter((i) => i.doneDate && i.doneDate >= from && i.doneDate < today).length, 0);
      const l = lessons.get(t.id) ?? { total: 0, taken: 0 };
      const a = assess.find((x) => x.teacherId === t.id);
      const lastDates = [a?._max.date, sessions.find((x) => x.teacherId === t.id)?._max.date].filter(Boolean) as string[];
      return {
        id: t.id, name: t.name, role: t.role, lessons: l.total, taken: l.taken,
        plans: myPlans.length, topics, assessments: a?._count ?? 0,
        lastEntry: lastDates.sort().at(-1) ?? null,
      };
    })
    .filter((t) => t.lessons || t.assessments || t.role === "MENTOR")
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
