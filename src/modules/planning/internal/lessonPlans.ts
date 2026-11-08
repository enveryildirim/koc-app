import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";
import { classroomsOf, getClassroom } from "@/modules/enrollment/server";
import { listCourses, listSlots, teachesSubject } from "@/modules/schedule/server";
import { topicKey } from "@/modules/curriculum";
import { curriculumForClass } from "@/modules/curriculum/server";
import { schoolYearOf, schoolYearRange, YMD } from "../calendar";
import { byWeek, itemState, layoutPlan, mondayOf, parsePlan, planProgress, type PlanSlot, type Range } from "../plan";

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

type Slot = PlanSlot & { curriculumTopicId: string | null };

/**
 * Plan satırlarını sınıfın müfredat setine bağlar: önce aynı ünite + konu adı, sonra yalnızca konu adı
 * (büyük-küçük harf / şapka farkı gözetilmez). Müfredattaki her konu en fazla bir satıra bağlanır.
 */
async function linkSlots(ownerId: string, classroomId: string, subject: string, slots: PlanSlot[]): Promise<Slot[]> {
  const level = (await prisma.classroom.findFirst({ where: { id: classroomId, ownerId }, select: { level: true } }))?.level ?? "";
  const topics = await curriculumForClass(ownerId, subject, level);
  const used = new Set<string>();
  const pick = (test: (t: (typeof topics)[number]) => boolean) => {
    const t = topics.find((x) => !used.has(x.id) && test(x));
    if (t) used.add(t.id);
    return t?.id ?? null;
  };
  return slots.map((s) => {
    const k = topicKey(s.topic);
    const u = topicKey(s.unit);
    return { ...s, curriculumTopicId: pick((t) => topicKey(t.topic) === k && topicKey(t.unit) === u) ?? pick((t) => topicKey(t.topic) === k) };
  });
}

const newRows = (planId: string, slots: Slot[]) =>
  slots.map((s) => ({ planId, order: s.order, topic: s.topic, unit: s.unit, week: s.week, endWeek: s.endWeek, curriculumTopicId: s.curriculumTopicId }));

/** Metin + başlangıç → bağlı satırlar. */
async function buildSlots(ownerId: string, classroomId: string, subject: string, year: number, source: string, startDate: string, parallel: boolean) {
  const slots = layoutPlan(parseSource(source), startDate, await holidayRanges(ownerId, classroomId, year), parallel);
  return linkSlots(ownerId, classroomId, subject, slots);
}

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
  const parallel = body.parallel === true;
  const slots = await buildSlots(ownerId, classroomId, subject, year, source, startDate, parallel);
  if (await prisma.lessonPlan.findUnique({ where: { ownerId_classroomId_subject_year: { ownerId, classroomId, subject, year } } })) {
    throw conflict("Bu sınıfın bu ders için bu yıla ait planı zaten var.");
  }
  const plan = await prisma.lessonPlan.create({ data: { ownerId, classroomId, subject, year, startDate, source, parallel } });
  await prisma.planItem.createMany({ data: newRows(plan.id, slots) });
  return plan;
}

/**
 * Metni, başlangıcı ya da paralel seçeneğini değiştirir; konular yeniden dağıtılır. Var olan satırlar yerinde
 * güncellenir (aynı müfredat konusu, yoksa aynı ünite + konu adı, yoksa aynı konu adı), böylece "işlendi" bilgisi,
 * yoklama bağı ve konuya bağlı değerlendirmeler korunur. Karşılığı kalmayan satırlar silinir.
 */
export async function updatePlan(ownerId: string, id: string, body: Record<string, unknown>) {
  const plan = await ownedPlan(ownerId, id);
  const startDate = String(body.startDate ?? plan.startDate);
  const source = String(body.source ?? plan.source);
  const parallel = typeof body.parallel === "boolean" ? body.parallel : plan.parallel;
  checkStart(startDate, plan.year);
  const slots = await buildSlots(ownerId, plan.classroomId, plan.subject, plan.year, source, startDate, parallel);

  const left = [...plan.items].sort((a, b) => a.order - b.order);
  const take = (test: (i: (typeof left)[number]) => boolean) => {
    const at = left.findIndex(test);
    return at < 0 ? null : left.splice(at, 1)[0];
  };
  const matched = slots.map((s) => s.curriculumTopicId ? take((i) => i.curriculumTopicId === s.curriculumTopicId) : null);
  slots.forEach((s, n) => {
    matched[n] ??= take((i) => topicKey(i.topic) === topicKey(s.topic) && topicKey(i.unit) === topicKey(s.unit)) ?? take((i) => topicKey(i.topic) === topicKey(s.topic));
  });
  const fresh = slots.filter((_, n) => !matched[n]);
  await prisma.$transaction([
    ...slots.flatMap((s, n) =>
      matched[n]
        ? [prisma.planItem.update({ where: { id: matched[n]!.id }, data: { order: s.order, topic: s.topic, unit: s.unit, week: s.week, endWeek: s.endWeek, curriculumTopicId: s.curriculumTopicId } })]
        : [],
    ),
    prisma.planItem.deleteMany({ where: { id: { in: left.map((i) => i.id) } } }),
    prisma.planItem.createMany({ data: newRows(plan.id, fresh) }),
    prisma.lessonPlan.update({ where: { id: plan.id }, data: { startDate, source, parallel } }),
  ]);
}

/** Müfredat kaydedilince (konu eklendi / adı değişti) o dersin planlarındaki bağları tazeler; dağıtıma dokunmaz. */
export async function relinkPlans(ownerId: string, subject: string) {
  const plans = await prisma.lessonPlan.findMany({ where: { ownerId }, include: { items: true } });
  for (const p of plans.filter((x) => x.subject === subject || topicKey(x.subject) === topicKey(subject))) {
    const items = [...p.items].sort((a, b) => a.order - b.order);
    const linked = await linkSlots(ownerId, p.classroomId, p.subject, items);
    const updates = items.flatMap((it, n) =>
      linked[n].curriculumTopicId !== it.curriculumTopicId ? [prisma.planItem.update({ where: { id: it.id }, data: { curriculumTopicId: linked[n].curriculumTopicId } })] : [],
    );
    if (updates.length) await prisma.$transaction(updates);
  }
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
    const slots = await buildSlots(ownerId, cid, plan.subject, plan.year, plan.source, plan.startDate, plan.parallel);
    const copy = await prisma.lessonPlan.create({
      data: { ownerId, classroomId: cid, subject: plan.subject, year: plan.year, startDate: plan.startDate, source: plan.source, parallel: plan.parallel },
    });
    await prisma.planItem.createMany({ data: newRows(copy.id, slots) });
    created.push(name);
  }
  return { created, skipped };
}

/** Konuyu işlendi / işlenmedi olarak işaretler. */
/** `opts.teacherId`: öğretmen oturumu; yalnızca girdiği sınıf + dersin planına işaret koyabilir. */
export async function setTopicDone(ownerId: string, itemId: string, body: Record<string, unknown>, opts: { teacherId?: string } = {}) {
  const item = await prisma.planItem.findFirst({ where: { id: itemId, plan: { ownerId } }, include: { plan: { select: { classroomId: true, subject: true } } } });
  if (!item) throw notFound("Konu bulunamadı.");
  if (opts.teacherId && !(await teachesSubject(ownerId, opts.teacherId, item.plan.classroomId, item.plan.subject))) throw notFound("Konu bulunamadı.");
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
  // Paralel ünitelerde aynı haftanın konuları yan yana gelsin diye hafta sırasıyla
  const items = byWeek(plan.items);
  const today = items.filter((i) => i.doneDate === date);
  const next = items.filter((i) => !i.doneDate).slice(0, limit);
  return {
    planId: plan.id,
    items: [...today, ...next].map((i) => ({ id: i.id, topic: i.topic, unit: i.unit, week: i.week, endWeek: i.endWeek, doneDate: i.doneDate, state: itemState(i, date) })),
  };
}

/** Plan editörü için: sınıflar, sınıf başına ders adları (Yönetim → Dersler) ve yılın tatilleri. */
export async function planEditorData(ownerId: string, year: number) {
  const { from, to } = schoolYearRange(year);
  const [classrooms, courses, holidays] = await Promise.all([
    classroomsOf(ownerId),
    listCourses(ownerId),
    prisma.calendarEvent.findMany({
      where: { ownerId, kind: "HOLIDAY", startDate: { lte: to }, endDate: { gte: from } },
      select: { startDate: true, endDate: true, classroomId: true },
    }),
  ]);
  const subjectsByClass: Record<string, string[]> = {};
  for (const c of courses) (subjectsByClass[c.classroomId] ??= []).push(c.name);
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
    const next = byWeek(plan.items).find((i) => !i.doneDate);
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

/** Plan satırı (bağlı olduğu sınıf ve dersle); yoksa / başka kurumunsa null. Değerlendirmeyi konuya bağlarken kullanılır. */
export async function findPlanItem(ownerId: string, itemId: string) {
  const i = await prisma.planItem.findFirst({ where: { id: itemId, plan: { ownerId } }, include: { plan: { select: { classroomId: true, subject: true } } } });
  return i ? { id: i.id, topic: i.topic, classroomId: i.plan.classroomId, subject: i.plan.subject } : null;
}
