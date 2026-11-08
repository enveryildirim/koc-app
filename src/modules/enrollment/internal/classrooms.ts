import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";

/** Sınıf adları kurum içinde büyük harfe normalize edilerek tutulur. */
export const normClassName = (name: unknown) => String(name ?? "").trim().toLocaleUpperCase("tr-TR");

/**
 * Kurumun sınıfları (ada göre). `studentCount`: ana sınıfı burası olanlar; `memberCount`: ek üyeler;
 * `mentor`: etüt mesulü (yoksa null).
 */
export async function classroomsOf(ownerId: string) {
  const list = await prisma.classroom.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true, members: true } }, mentor: { select: { id: true, name: true } } },
  });
  return list.map(({ _count, ...c }) => ({ ...c, studentCount: _count.students, memberCount: _count.members }));
}

/** Kurumun sınıfını getirir; yoksa / başka kurumunsa notFound. */
export async function getClassroom(ownerId: string, id: string) {
  const c = await prisma.classroom.findFirst({ where: { id, ownerId } });
  if (!c) throw notFound("Sınıf bulunamadı.");
  return c;
}

/** Yeni sınıf; ad zorunlu ve kurum içinde benzersiz. */
export async function createClassroom(ownerId: string, body: Record<string, unknown>) {
  const name = normClassName(body.name);
  if (!name) throw invalid("Sınıf adı gerekli.");
  if (await prisma.classroom.findUnique({ where: { ownerId_name: { ownerId, name } } })) {
    throw conflict("Bu isimde bir sınıf zaten var.");
  }
  return prisma.classroom.create({ data: { ownerId, name, level: String(body.level ?? "").trim() } });
}

/** Sınıfı siler; öğrencisi (ana ya da ek üye) olan sınıf silinemez. Dersleri de silinir. */
export async function deleteClassroom(ownerId: string, id: string) {
  const c = await prisma.classroom.findFirst({ where: { id, ownerId }, include: { _count: { select: { students: true, members: true } } } });
  if (!c) throw notFound();
  if (c._count.students > 0) throw conflict("Sınıfta öğrenci var. Önce öğrencileri başka sınıfa taşıyın.");
  if (c._count.members > 0) throw conflict("Sınıfta başka sınıftan katılan öğrenci var. Önce onları sınıf sayfasından çıkarın.");
  await prisma.classroom.delete({ where: { id } });
}

/** Sınıf (sayfa için) etüt mesulüyle; yoksa / başka kurumunsa null. */
export async function findClassroom(ownerId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, ownerId }, include: { mentor: { select: { id: true, name: true } } } });
}

/** Sınıf adı ve düzeyini günceller. */
export async function updateClassroom(ownerId: string, id: string, body: Record<string, unknown>) {
  const c = await getClassroom(ownerId, id);
  const data: { name?: string; level?: string } = {};
  if (body.name !== undefined) {
    const name = normClassName(body.name);
    if (!name) throw invalid("Sınıf adı gerekli.");
    const same = await prisma.classroom.findUnique({ where: { ownerId_name: { ownerId, name } } });
    if (same && same.id !== c.id) throw conflict("Bu isimde bir sınıf zaten var.");
    data.name = name;
  }
  if (body.level !== undefined) data.level = String(body.level ?? "").trim();
  await prisma.classroom.update({ where: { id: c.id }, data });
}

/**
 * Sınıfın etüt mesulünü atar (`null` = kaldırır). Öğretmenin bu kurumun etüt mesulü olduğunu
 * çağıran doğrular (Teacher tablosu schedule modülünündür; route önce `findTeacher` ile bakar).
 */
export async function setClassroomMentor(ownerId: string, id: string, mentorId: string | null) {
  const c = await getClassroom(ownerId, id);
  await prisma.classroom.update({ where: { id: c.id }, data: { mentorId } });
}

/** Öğrenciyi sınıfa ek üye yapar. Ana sınıfı zaten burasıysa ya da zaten üyeyse hata verir. */
export async function addClassMember(ownerId: string, classroomId: string, studentId: string) {
  const c = await getClassroom(ownerId, classroomId);
  const st = await prisma.student.findFirst({ where: { id: studentId, ownerId } });
  if (!st) throw notFound("Öğrenci bulunamadı.");
  if (st.classroomId === c.id) throw conflict("Öğrencinin ana sınıfı zaten bu sınıf.");
  const exists = await prisma.classMember.findUnique({ where: { classroomId_studentId: { classroomId: c.id, studentId } } });
  if (exists) throw conflict("Öğrenci bu sınıfa zaten üye.");
  await prisma.classMember.create({ data: { ownerId, classroomId: c.id, studentId } });
}

/** Öğrencinin bu sınıftaki ek üyeliğini kaldırır (ana sınıfına dokunmaz). */
export async function removeClassMember(ownerId: string, classroomId: string, studentId: string) {
  const m = await prisma.classMember.findFirst({ where: { ownerId, classroomId, studentId } });
  if (!m) throw notFound();
  await prisma.classMember.delete({ where: { id: m.id } });
}

/**
 * Sınıfların öğrencileri (ana sınıf + ek üyeler): sınıf kimliği → (öğrenci kimliği → "Ad Soyad").
 * Ders programı çakışma denetimi kullanır (aynı öğrenci aynı saatte iki derste mi).
 */
export async function classRosters(ownerId: string) {
  const [students, members] = await Promise.all([
    prisma.student.findMany({ where: { ownerId, classroomId: { not: null } }, select: { id: true, firstName: true, lastName: true, classroomId: true } }),
    prisma.classMember.findMany({ where: { ownerId }, select: { classroomId: true, student: { select: { id: true, firstName: true, lastName: true } } } }),
  ]);
  const map = new Map<string, Map<string, string>>();
  const add = (classroomId: string, s: { id: string; firstName: string; lastName: string }) => {
    if (!map.has(classroomId)) map.set(classroomId, new Map());
    map.get(classroomId)!.set(s.id, `${s.firstName} ${s.lastName}`);
  };
  for (const s of students) add(s.classroomId!, s);
  for (const m of members) add(m.classroomId, m.student);
  return map;
}

/**
 * Etüt mesulünün sorumlu olduğu sınıfları topluca belirler: verilen sınıflar ona atanır (başka mesulden alınır),
 * listede olmayan ve şu an ona ait sınıfların mesulü kaldırılır. Boş liste bütün sınıflarını bırakır
 * (rolü öğretmene dönen kişi için). Kişinin etüt mesulü olduğunu çağıran doğrular (Teacher schedule'ındır).
 */
export async function setMentorClasses(ownerId: string, mentorId: string, classroomIds: string[]) {
  const ids = [...new Set(classroomIds.map(String))];
  const owned = await prisma.classroom.count({ where: { ownerId, id: { in: ids } } });
  if (owned !== ids.length) throw invalid("Sınıf bulunamadı.");
  await prisma.$transaction([
    prisma.classroom.updateMany({ where: { ownerId, mentorId, id: { notIn: ids } }, data: { mentorId: null } }),
    prisma.classroom.updateMany({ where: { ownerId, id: { in: ids } }, data: { mentorId } }),
  ]);
}
