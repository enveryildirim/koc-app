import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";
import { classroomsOf, getClassroom } from "@/modules/enrollment/server";
import { listSlots } from "@/modules/schedule/server";
import { schoolYearOf, schoolYearRange, YMD } from "../calendar";
import { itemState, layoutPlan, mondayOf, parsePlan, planProgress, type PlanSlot, type Range } from "../plan";

/** Planın dağıtımında atlanacak tatiller: kurum geneli + o sınıfa ait tatil etkinlikleri. */
export async function holidayRanges(ownerId: string, classroomId: string, year: number): Promise<Range[]> {
  const { from, to } = schoolYearRange(year);
  const list = await prisma.calendarEvent.findMany({
    where: { ownerId, kind: "HOLIDAY", startDate: { lte: to }, endDate: { gte: from }, OR: [{ classroomId: null }, { classroomId }] },
    select: { startDate: true, endDate: true },
  });
  return list.map((h) => ({ start: h.startDate, end: h.endDate }));
}

function parseSource(source: string) {
  const { lines, errors } = parsePlan(source);
  if (errors.length) throw invalid(errors[0]);
  if (!lines.length) throw invalid("En az bir konu girin.");
  if (lines.length > 300) throw invalid("Bir plan en fazla 300 konu içerebilir.");
  return lines;
}

function checkStart(startDate: string, year: number) {
  const { from, to } = schoolYearRange(year);
  if (!YMD.test(startDate) || startDate < from || startDate > to) throw invalid("Başlangıç tarihi seçilen eğitim yılı içinde olmalı.");
}

const itemRows = (planId: string, slots: PlanSlot[], keep?: Map<string, { doneDate: string | null; sessionId: string | null }[]>) =>
  slots.map((s) => {
    const prev = keep?.get(s.topic)?.shift();
    return { planId, order: s.order, topic: s.topic, week: s.week, endWeek: s.endWeek, doneDate: prev?.doneDate ?? null, sessionId: prev?.sessionId ?? null };
  });

/**
 * Eğitim yılının plan özeti: ders programındaki her (sınıf, ders) çifti ve programda olmasa da
 * oluşturulmuş planlar, ilerlemeleriyle. `classroomId` verilirse yalnızca o sınıf.
 */
export async function planOverview(ownerId: string, year: number, today: string, classroomId?: string) {
  const [slots, plans] = await Promise.all([
    listSlots(ownerId, classroomId ? { classroomId } : {}),
    prisma.lessonPlan.findMany({
      where: { ownerId, year, ...(classroomId ? { classroomId } : {}) },
      include: { classroom: { select: { name: true } }, items: { select: { week: true, endWeek: true, doneDate: true } } },
    }),
  ]);
  const rows = new Map<string, { classroomId: string; classroom: string; subject: string; teachers: string[]; weekly: number; plan: { id: string; progress: ReturnType<typeof planProgress> } | null }>();
  const key = (c: string, s: string) => `${c}|${s}`;
  for (const sl of slots) {
    const k = key(sl.classroomId, sl.subject);
    const r = rows.get(k) ?? { classroomId: sl.classroomId, classroom: sl.classroom.name, subject: sl.subject, teachers: [], weekly: 0, plan: null };
    r.weekly++;
    if (!r.teachers.includes(sl.teacher.name)) r.teachers.push(sl.teacher.name);
    rows.set(k, r);
  }
  for (const p of plans) {
    const k = key(p.classroomId, p.subject);
    const r = rows.get(k) ?? { classroomId: p.classroomId, classroom: p.classroom.name, subject: p.subject, teachers: [], weekly: 0, plan: null };
    r.plan = { id: p.id, progress: planProgress(p.items, today) };
    rows.set(k, r);
  }
  return [...rows.values()].sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.subject.localeCompare(b.subject, "tr"));
}

/** Plan detayı (sayfa için): konular, ilerleme ve dağıtımda kullanılan tatiller. Yoksa null. */
export async function findPlan(ownerId: string, id: string) {
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, ownerId },
    include: { classroom: { select: { id: true, name: true } }, items: { orderBy: { order: "asc" } } },
  });
  if (!plan) return null;
  return { ...plan, holidays: await holidayRanges(ownerId, plan.classroomId, plan.year) };
}

async function ownedPlan(ownerId: string, id: string) {
  const p = await prisma.lessonPlan.findFirst({ where: { id, ownerId }, include: { items: true } });
  if (!p) throw notFound("Plan bulunamadı.");
  return p;
}

export async function createPlan(ownerId: string, body: Record<string, unknown>) {
  const classroomId = String(body.classroomId ?? "");
  const subject = String(body.subject ?? "").trim();
  const year = Number(body.year);
  const startDate = String(body.startDate ?? "");
  const source = String(body.source ?? "");
  if (!subject) throw invalid("Ders adı gerekli.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw invalid("Geçersiz eğitim yılı.");
  try {
    await getClassroom(ownerId, classroomId);
  } catch {
    throw invalid("Sınıf bulunamadı.");
  }
  checkStart(startDate, year);
  const lines = parseSource(source);
  if (await prisma.lessonPlan.findUnique({ where: { ownerId_classroomId_subject_year: { ownerId, classroomId, subject, year } } })) {
    throw conflict("Bu sınıfın bu ders için bu yıla ait planı zaten var.");
  }
  const slots = layoutPlan(lines, startDate, await holidayRanges(ownerId, classroomId, year));
  const plan = await prisma.lessonPlan.create({ data: { ownerId, classroomId, subject, year, startDate, source } });
  await prisma.planItem.createMany({ data: itemRows(plan.id, slots) });
  return plan;
}

/** Metni veya başlangıcı değiştirir; konular yeniden dağıtılır, aynı adlı konuların "işlendi" bilgisi korunur. */
export async function updatePlan(ownerId: string, id: string, body: Record<string, unknown>) {
  const plan = await ownedPlan(ownerId, id);
  const startDate = String(body.startDate ?? plan.startDate);
  const source = String(body.source ?? plan.source);
  checkStart(startDate, plan.year);
  const lines = parseSource(source);
  const slots = layoutPlan(lines, startDate, await holidayRanges(ownerId, plan.classroomId, plan.year));
  const keep = new Map<string, { doneDate: string | null; sessionId: string | null }[]>();
  for (const it of [...plan.items].sort((a, b) => a.order - b.order)) {
    if (it.doneDate) keep.set(it.topic, [...(keep.get(it.topic) ?? []), { doneDate: it.doneDate, sessionId: it.sessionId }]);
  }
  await prisma.$transaction([
    prisma.planItem.deleteMany({ where: { planId: plan.id } }),
    prisma.planItem.createMany({ data: itemRows(plan.id, slots, keep) }),
    prisma.lessonPlan.update({ where: { id: plan.id }, data: { startDate, source } }),
  ]);
}

export async function deletePlan(ownerId: string, id: string) {
  const plan = await ownedPlan(ownerId, id);
  await prisma.lessonPlan.delete({ where: { id: plan.id } });
}

/** Planı başka sınıflara kopyalar (aynı ders ve yıl). O sınıfta zaten plan varsa atlanır. */
export async function copyPlan(ownerId: string, id: string, classroomIds: unknown) {
  const plan = await ownedPlan(ownerId, id);
  if (!Array.isArray(classroomIds) || !classroomIds.length) throw invalid("En az bir sınıf seçin.");
  const classes = new Map((await classroomsOf(ownerId)).map((c) => [c.id, c.name]));
  const lines = parseSource(plan.source);
  const created: string[] = [];
  const skipped: string[] = [];
  for (const cid of new Set(classroomIds.map(String))) {
    const name = classes.get(cid);
    if (!name || cid === plan.classroomId) continue;
    const exists = await prisma.lessonPlan.findUnique({
      where: { ownerId_classroomId_subject_year: { ownerId, classroomId: cid, subject: plan.subject, year: plan.year } },
    });
    if (exists) {
      skipped.push(name);
      continue;
    }
    const slots = layoutPlan(lines, plan.startDate, await holidayRanges(ownerId, cid, plan.year));
    const copy = await prisma.lessonPlan.create({
      data: { ownerId, classroomId: cid, subject: plan.subject, year: plan.year, startDate: plan.startDate, source: plan.source },
    });
    await prisma.planItem.createMany({ data: itemRows(copy.id, slots) });
    created.push(name);
  }
  return { created, skipped };
}

/** Konuyu işlendi / işlenmedi olarak işaretler. */
export async function setTopicDone(ownerId: string, itemId: string, body: Record<string, unknown>) {
  const item = await prisma.planItem.findFirst({ where: { id: itemId, plan: { ownerId } } });
  if (!item) throw notFound("Konu bulunamadı.");
  const done = !!body.done;
  const date = String(body.date ?? "");
  if (done && !YMD.test(date)) throw invalid("Geçerli bir tarih girin.");
  await prisma.planItem.update({
    where: { id: item.id },
    data: done ? { doneDate: date, sessionId: body.sessionId ? String(body.sessionId) : null } : { doneDate: null, sessionId: null },
  });
}

/**
 * Yoklama ekranı için: sınıf + dersin o tarihe ait planından, o gün işaretlenenler ve sıradaki
 * işlenmemiş konular (en fazla `limit`). Plan yoksa null.
 */
export async function topicsForLesson(ownerId: string, classroomId: string, subject: string, date: string, limit = 5) {
  const plan = await prisma.lessonPlan.findFirst({
    where: { ownerId, classroomId, subject, year: schoolYearOf(date) },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!plan) return null;
  const today = plan.items.filter((i) => i.doneDate === date);
  const next = plan.items.filter((i) => !i.doneDate).slice(0, limit);
  return {
    planId: plan.id,
    items: [...today, ...next].map((i) => ({ id: i.id, topic: i.topic, week: i.week, endWeek: i.endWeek, doneDate: i.doneDate, state: itemState(i, date) })),
  };
}

/** Plan editörü için: sınıflar, ders programına göre sınıf başına ders adları ve yılın tatilleri. */
export async function planEditorData(ownerId: string, year: number) {
  const { from, to } = schoolYearRange(year);
  const [classrooms, slots, holidays] = await Promise.all([
    classroomsOf(ownerId),
    listSlots(ownerId),
    prisma.calendarEvent.findMany({
      where: { ownerId, kind: "HOLIDAY", startDate: { lte: to }, endDate: { gte: from } },
      select: { startDate: true, endDate: true, classroomId: true },
    }),
  ]);
  const subjectsByClass: Record<string, string[]> = {};
  for (const s of slots) {
    const list = (subjectsByClass[s.classroomId] ??= []);
    if (!list.includes(s.subject)) list.push(s.subject);
  }
  return {
    classrooms: classrooms.map((c) => ({ id: c.id, name: c.name, level: c.level })),
    subjectsByClass,
    holidays: holidays.map((h) => ({ start: h.startDate, end: h.endDate, classroomId: h.classroomId })),
  };
}

/**
 * Verilen (sınıf, ders) çiftlerinin bu eğitim yılındaki planları: ilerleme, bu hafta plana göre
 * işlenecek konular ve sıradaki işlenmemiş konu. Planı olmayan çift `plan: null` döner.
 */
export async function plansForPairs<T extends { classroomId: string; subject: string }>(ownerId: string, pairs: T[], today: string) {
  const thisWeek = mondayOf(today);
  const plans = await prisma.lessonPlan.findMany({
    where: { ownerId, year: schoolYearOf(today), classroomId: { in: [...new Set(pairs.map((p) => p.classroomId))] } },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return pairs.map((pair) => {
    const plan = plans.find((p) => p.classroomId === pair.classroomId && p.subject === pair.subject);
    if (!plan) return { ...pair, plan: null };
    const thisWeekTopics = plan.items.filter((i) => i.week <= thisWeek && thisWeek <= i.endWeek);
    const next = plan.items.find((i) => !i.doneDate);
    return {
      ...pair,
      plan: {
        id: plan.id,
        progress: planProgress(plan.items, today),
        thisWeek: thisWeekTopics.map((i) => ({ topic: i.topic, done: !!i.doneDate })),
        next: next ? { topic: next.topic, week: next.week } : null,
      },
    };
  });
}
