import { prisma } from "@/shared/db";
import { AppError, conflict, invalid, notFound } from "@/shared/errors";
import { getClassroom } from "@/modules/enrollment/server";
import { COURSE_KIND_KEYS, guessCourseKind } from "../labels";
import type { CourseRow } from "../types";

/*
 * Ders (Course): sınıfın dersi. (classroomId, name) tektir.
 * Ders yalnızca Yönetim → Dersler'de açılır (`createCourse`). Program satırı ve ek ders var olan derse bağlanır (`parseSlot`).
 * `courseIdFor` yalnızca derse bağlanmamış eski program satırları içindir (`syncCourses`).
 * Ödev ve yıllık plan bugün (sınıf, ders adı) taşır; formlarda ad sınıfın derslerinden seçilir.
 */

/** Eski veriler için: sınıf + ders adına karşılık gelen dersin kimliği; yoksa ders oluşturulur (türü addan tahmin edilir). */
export async function courseIdFor(ownerId: string, s: { classroomId: string; subject: string; lessonType: string; teacherId: string }) {
  const found = await prisma.course.findUnique({ where: { classroomId_name: { classroomId: s.classroomId, name: s.subject } } });
  if (found) return found.id;
  const c = await prisma.course.create({
    data: { ownerId, classroomId: s.classroomId, name: s.subject, kind: guessCourseKind(s.subject, s.lessonType), teacherId: s.teacherId },
  });
  return c.id;
}

/**
 * Derse bağlı olmayan program satırlarını derslere bağlar (eski veriler için). Normal (GRUP) satırlar önce işlenir;
 * böylece aynı adlı etüt satırı dersin türünü belirlemez. Bağlanan satır sayısını döndürür.
 */
export async function syncCourses(ownerId: string) {
  const loose = await prisma.scheduleSlot.findMany({ where: { ownerId, courseId: null }, orderBy: [{ lessonType: "desc" }] });
  // "OZEL" > "GRUP" > "ETUT" (desc): etüt satırları en sona kalır
  for (const sl of loose) {
    const courseId = await courseIdFor(ownerId, sl);
    await prisma.scheduleSlot.update({ where: { id: sl.id }, data: { courseId } });
  }
  return loose.length;
}

function minutes(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - (ah * 60 + am));
}

export type CourseFilter = { classroomId?: string; teacherId?: string };

/** Dersler (sınıf ve ders adına göre, Türkçe sıralı), sorumlusu ve programdaki haftalık yüküyle. */
export async function listCourses(ownerId: string, f: CourseFilter = {}): Promise<(CourseRow & { classroomName: string })[]> {
  const list = await prisma.course.findMany({
    where: { ownerId, ...f },
    include: { teacher: { select: { name: true } }, classroom: { select: { name: true } }, slots: { select: { startTime: true, endTime: true } } },
  });
  // Türkçe sıralama (SQLite "İ", "Ş" gibi harfleri sona atar)
  list.sort((a, b) => a.classroom.name.localeCompare(b.classroom.name, "tr") || a.name.localeCompare(b.name, "tr"));
  return list.map((c) => ({
    id: c.id,
    classroomId: c.classroomId,
    classroomName: c.classroom.name,
    name: c.name,
    kind: c.kind,
    teacherId: c.teacherId,
    teacherName: c.teacher?.name ?? null,
    external: c.external,
    createdAt: c.createdAt.toISOString(),
    slotCount: c.slots.length,
    weeklyMinutes: c.slots.reduce((s, x) => s + minutes(x.startTime, x.endTime), 0),
  }));
}

async function ownedCourse(ownerId: string, id: string) {
  const c = await prisma.course.findFirst({ where: { id, ownerId } });
  if (!c) throw notFound("Ders bulunamadı.");
  return c;
}

async function checkTeacher(ownerId: string, teacherId: string | null) {
  if (!teacherId) return;
  const t = await prisma.teacher.findFirst({ where: { id: teacherId, ownerId }, select: { id: true } });
  if (!t) throw invalid("Öğretmen bulunamadı.");
}

function parseFields(body: Record<string, unknown>) {
  const out: { name?: string; kind?: string; teacherId?: string | null; external?: boolean } = {};
  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw invalid("Ders adı gerekli.");
    if (name.length > 60) throw invalid("Ders adı en fazla 60 karakter olabilir.");
    out.name = name;
  }
  if (body.kind !== undefined) {
    const kind = String(body.kind);
    if (!COURSE_KIND_KEYS.includes(kind)) throw invalid("Geçersiz ders türü.");
    out.kind = kind;
  }
  if (body.teacherId !== undefined) out.teacherId = body.teacherId ? String(body.teacherId) : null;
  if (body.external !== undefined) out.external = Boolean(body.external);
  return out;
}

/** Yeni ders. Gövde: { classroomId, name, kind, teacherId?, external? } */
export async function createCourse(ownerId: string, body: Record<string, unknown>) {
  const classroomId = String(body.classroomId ?? "");
  await getClassroom(ownerId, classroomId).catch((e) => {
    if (e instanceof AppError && e.kind === "not_found") throw invalid("Sınıf bulunamadı.");
    throw e;
  });
  const f = parseFields({ kind: "SCHOOL", ...body, name: body.name ?? "" });
  await checkTeacher(ownerId, f.teacherId ?? null);
  if (await prisma.course.findUnique({ where: { classroomId_name: { classroomId, name: f.name! } } })) {
    throw conflict("Bu sınıfta bu adla bir ders zaten var.");
  }
  return prisma.course.create({
    data: { ownerId, classroomId, name: f.name!, kind: f.kind!, teacherId: f.teacherId ?? null, external: f.external ?? false },
  });
}

/**
 * Dersi günceller (ad, tür, sorumlu, dışarıda). Ad değişirse programdaki satırların ders adı da değişir;
 * geçmiş yoklama oturumlarındaki ad olduğu gibi kalır.
 */
export async function updateCourse(ownerId: string, id: string, body: Record<string, unknown>) {
  const c = await ownedCourse(ownerId, id);
  const f = parseFields(body);
  if (f.teacherId !== undefined) await checkTeacher(ownerId, f.teacherId);
  if (f.name && f.name !== c.name) {
    const same = await prisma.course.findUnique({ where: { classroomId_name: { classroomId: c.classroomId, name: f.name } } });
    if (same) throw conflict("Bu sınıfta bu adla bir ders zaten var.");
  }
  await prisma.$transaction([
    prisma.course.update({ where: { id: c.id }, data: f }),
    ...(f.name && f.name !== c.name ? [prisma.scheduleSlot.updateMany({ where: { courseId: c.id }, data: { subject: f.name } })] : []),
  ]);
}

/** Dersi siler. Programda satırı olan ders silinemez (önce programdan kaldırılmalı). */
export async function deleteCourse(ownerId: string, id: string) {
  const c = await ownedCourse(ownerId, id);
  const n = await prisma.scheduleSlot.count({ where: { courseId: c.id } });
  if (n > 0) throw conflict(`Bu dersin programda ${n} saati var. Önce programdan kaldırın.`);
  await prisma.course.delete({ where: { id: c.id } });
}

/** Ders (sınıf adı ve sorumlusuyla); yoksa / başka kurumunsa null. */
export async function findCourse(ownerId: string, id: string) {
  return prisma.course.findFirst({
    where: { id, ownerId },
    include: { classroom: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
  });
}

/** Öğretmenin dersleri: sorumlusu olduğu ya da programda girdiği dersler (dışarıda alınanlar dahil). */
export async function coursesForTeacher(ownerId: string, teacherId: string) {
  const all = await listCourses(ownerId);
  const viaSlots = new Set(
    (await prisma.scheduleSlot.findMany({ where: { ownerId, teacherId, courseId: { not: null } }, select: { courseId: true } })).map((s) => s.courseId!),
  );
  return all.filter((c) => c.teacherId === teacherId || viaSlots.has(c.id));
}
