import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";
import { cleanStudent, normStudentNo, type StudentInput } from "../studentInput";
import { normClassName } from "./classrooms";

export type StudentFilter = {
  /** Tek sınıf ya da sınıf listesi. `null` = sınıfsız öğrenciler. */
  classroomId?: string | string[] | null;
  /** true: yalnızca bir sınıfa atanmış öğrenciler. */
  hasClassroom?: boolean;
  /** true: yalnızca kurum dışı (STS); false: yalnızca kurum öğrencileri. */
  external?: boolean;
  ids?: string[];
  /** Ad, soyad veya numarada geçen metin. */
  q?: string;
  /**
   * Sınıfın bütün öğrencileri: ana sınıfı burası olanlar + ek üyeler (ClassMember).
   * Ders, yoklama ve değerlendirme listeleri bunu kullanır; `classroomId` yalnızca ana sınıfa bakar.
   */
  inClass?: string;
};
export type StudentOrder = "class" | "name" | "number";

const ORDER: Record<StudentOrder, Prisma.StudentOrderByWithRelationInput[]> = {
  class: [{ classroom: { name: "asc" } }, { studentNo: "asc" }],
  name: [{ firstName: "asc" }, { lastName: "asc" }],
  number: [{ studentNo: "asc" }],
};

/** Kurumun öğrencileri (sınıfıyla birlikte), filtre ve sıralamayla. Sınıf öğrencileri için `{ classroomId }`. */
export async function listStudents(ownerId: string, f: StudentFilter = {}, order: StudentOrder = "class") {
  const where: Prisma.StudentWhereInput = { ownerId };
  if (f.classroomId !== undefined) where.classroomId = Array.isArray(f.classroomId) ? { in: f.classroomId } : f.classroomId;
  else if (f.hasClassroom !== undefined) where.classroomId = f.hasClassroom ? { not: null } : null;
  if (f.external !== undefined) where.external = f.external;
  if (f.ids) where.id = { in: f.ids };
  const and: Prisma.StudentWhereInput[] = [];
  if (f.q) and.push({ OR: [{ firstName: { contains: f.q } }, { lastName: { contains: f.q } }, { studentNo: { contains: f.q } }] });
  if (f.inClass) and.push({ OR: [{ classroomId: f.inClass }, { memberships: { some: { classroomId: f.inClass } } }] });
  if (and.length) where.AND = and;
  return prisma.student.findMany({ where, include: { classroom: true }, orderBy: ORDER[order] });
}

/** Kurumun öğrencisi (sınıfıyla); yoksa / başka kurumunsa null. */
export async function findStudent(ownerId: string, id: string) {
  return prisma.student.findFirst({
    where: { id, ownerId },
    include: { classroom: true, memberships: { include: { classroom: { select: { id: true, name: true } } } } },
  });
}

/** Kurumun öğrencisi (sınıfıyla); yoksa / başka kurumunsa notFound. */
export async function getStudent(ownerId: string, id: string) {
  const st = await findStudent(ownerId, id);
  if (!st) throw notFound();
  return st;
}

/**
 * Kurumun öğrencilerini öğrenci numarasıyla eşleyen fonksiyon döndürür (optik / dosya girişleri için).
 * Numaralar normalize edilerek karşılaştırılır ("00123" = "123"). Eşleşme yoksa undefined.
 */
export async function studentNoMatcher(ownerId: string) {
  const students = await prisma.student.findMany({ where: { ownerId }, select: { id: true, studentNo: true } });
  const byNo = new Map(students.map((s) => [normStudentNo(s.studentNo), s.id]));
  return (studentNo: string) => byNo.get(normStudentNo(studentNo));
}

const MAX_NO = 999_999; // optik formda 6 hane

/** En büyük sayısal öğrenci numarası (yoksa 0). */
async function maxStudentNo(ownerId: string) {
  const list = await prisma.student.findMany({ where: { ownerId }, select: { studentNo: true } });
  return list.reduce((m, s) => Math.max(m, Number(s.studentNo) || 0), 0);
}

/** Sıradaki öğrenci numarası: en büyük numara + 1. 6 haneyi aşarsa boş (elle girilir). */
export async function nextStudentNo(ownerId: string) {
  const n = (await maxStudentNo(ownerId)) + 1;
  return n <= MAX_NO ? String(n) : "";
}

async function assertClassroom(ownerId: string, classroomId: string | null) {
  if (!classroomId) return;
  const c = await prisma.classroom.findFirst({ where: { id: classroomId, ownerId }, select: { id: true } });
  if (!c) throw invalid("Sınıf bulunamadı.");
}

function parse(body: Record<string, unknown>): StudentInput {
  const { data, error } = cleanStudent(body);
  if (!data) throw invalid(error!);
  return data;
}

export async function createStudent(ownerId: string, body: Record<string, unknown>) {
  const data = parse(body);
  await assertClassroom(ownerId, data.classroomId);
  if (await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId, studentNo: data.studentNo } } })) {
    throw conflict(`${data.studentNo} numaralı öğrenci zaten kayıtlı.`);
  }
  return prisma.student.create({ data: { ownerId, ...data } });
}

/** Öğrencinin kayıt bilgilerini günceller (veli paylaşım alanlarına dokunmaz). */
export async function updateStudent(ownerId: string, id: string, body: Record<string, unknown>) {
  const st = await getStudent(ownerId, id);
  const data = parse(body);
  await assertClassroom(ownerId, data.classroomId);
  const clash = await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId, studentNo: data.studentNo } } });
  if (clash && clash.id !== st.id) throw conflict(`${data.studentNo} numarası başka öğrencide kayıtlı.`);
  await prisma.student.update({ where: { id: st.id }, data });
}

export async function deleteStudent(ownerId: string, id: string) {
  const st = await getStudent(ownerId, id);
  await prisma.student.delete({ where: { id: st.id } });
}

/**
 * Toplu öğrenci yükleme. rows: [{ studentNo, firstName, lastName, className, phone, parentName, parentPhone }]
 * Aynı numara varsa öğrenci güncellenir; sınıf adı yoksa sınıf oluşturulur. Hatalı satırlar atlanıp raporlanır.
 * Numarası boş satırlara sıradaki numaralar verilir (kurumdaki ve dosyadaki en büyük numaradan sonra); `numbered` bunların sayısıdır.
 */
export async function importStudents(ownerId: string, rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) throw invalid("Satır yok.");
  if (rows.length > 2000) throw invalid("Tek seferde en fazla 2000 öğrenci yüklenebilir.");

  const classes = new Map((await prisma.classroom.findMany({ where: { ownerId } })).map((c) => [c.name, c.id]));
  let created = 0;
  let updated = 0;
  let numbered = 0;
  const errors: string[] = [];
  const list = rows as Record<string, unknown>[];
  const noOf = (r: Record<string, unknown>) => String(r.studentNo ?? "").trim();
  let next = Math.max(await maxStudentNo(ownerId), ...list.map((r) => Number(noOf(r)) || 0)) + 1;

  for (const [i, row] of list.entries()) {
    let r = row;
    if (!noOf(r)) {
      if (next > MAX_NO) {
        errors.push(`Satır ${i + 2}: numara verilemedi (6 hane doldu); numarayı elle girin.`);
        continue;
      }
      r = { ...r, studentNo: String(next++) };
      numbered++;
    }
    const className = normClassName(r.className);
    let classroomId: string | null = null;
    if (className) {
      if (!classes.has(className)) {
        const c = await prisma.classroom.create({ data: { ownerId, name: className, level: className.match(/^\d+/)?.[0] ?? "" } });
        classes.set(className, c.id);
      }
      classroomId = classes.get(className)!;
    }
    const { data, error } = cleanStudent({ ...r, classroomId });
    if (!data) {
      errors.push(`Satır ${i + 2}: ${error}`);
      continue;
    }
    const existing = await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId, studentNo: data.studentNo } } });
    if (existing) {
      await prisma.student.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.student.create({ data: { ownerId, ...data } });
      created++;
    }
  }
  return { created, updated, numbered, errors };
}
