/** Devam raporları: işlenen ders ve yoklama kayıtlarından tarih aralığı / sınıf bazlı özetler. */
import { prisma } from "@/shared/db";
import { LESSON_TYPES } from "@/modules/schedule";

/** Tarih aralığı (YYYY-MM-DD, iki uç dahil); classroomId verilirse yalnızca o sınıfın dersleri. */
export type LessonRange = { from: string; to: string; classroomId?: string };

const sessionWhere = (ownerId: string, r: LessonRange) => ({
  ownerId,
  date: { gte: r.from, lte: r.to },
  ...(r.classroomId ? { classroomId: r.classroomId } : {}),
});
/** Rapor kapsamındaki öğrenciler: kurum öğrencileri, sınıf seçiliyse o sınıf, değilse sınıfı olanlar. */
const studentsOf = (ownerId: string, r: LessonRange) =>
  prisma.student.findMany({ where: { ownerId, external: false, classroomId: r.classroomId || { not: null } }, include: { classroom: true } });

function minutes(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - ah * 60 - am);
}

/**
 * Öğrenci bazında devamsızlık. Devam % = (ders − gelmedi − izinli) / ders.
 * Satırlar: en çok devamsızlıktan aza, sonra düşük devamdan yükseğe, sonra ada göre.
 */
export async function absenceByStudent(ownerId: string, range: LessonRange) {
  const [students, att] = await Promise.all([
    studentsOf(ownerId, range),
    prisma.attendance.findMany({ where: { session: sessionWhere(ownerId, range) }, select: { studentId: true, status: true } }),
  ]);
  const agg = new Map<string, Record<string, number>>();
  for (const a of att) {
    const m = agg.get(a.studentId) ?? {};
    m[a.status] = (m[a.status] ?? 0) + 1;
    agg.set(a.studentId, m);
  }
  const rows = students
    .map((s) => {
      const m = agg.get(s.id) ?? {};
      const total = Object.values(m).reduce((x, y) => x + y, 0);
      const absent = m.ABSENT ?? 0;
      return { s, total, absent, late: m.LATE ?? 0, excused: m.EXCUSED ?? 0, rate: total ? Math.round(((total - absent - (m.EXCUSED ?? 0)) / total) * 100) : null };
    })
    .sort((a, b) => b.absent - a.absent || (a.rate ?? 101) - (b.rate ?? 101) || a.s.firstName.localeCompare(b.s.firstName, "tr"));
  return { records: att.length, rows };
}

/** Gelmeyen öğrenci kayıtları (öğrenci, ders, sınıf, öğretmenle); yeni tarihten eskiye, gün içinde saate göre. */
export async function absentees(ownerId: string, range: LessonRange) {
  const rows = await prisma.attendance.findMany({
    where: { status: "ABSENT", session: sessionWhere(ownerId, range) },
    include: { student: true, session: { include: { classroom: true, teacher: true } } },
  });
  return rows.sort((a, b) => b.session.date.localeCompare(a.session.date) || a.session.startTime.localeCompare(b.session.startTime));
}

/** Öğretmen başına işlenen ders sayısı, ders türü dağılımı ve süre (dakika); çoktan aza. */
export async function teacherLessonCounts(ownerId: string, range: LessonRange) {
  const [teachers, sessions] = await Promise.all([
    prisma.teacher.findMany({ where: { ownerId }, orderBy: { name: "asc" } }),
    prisma.lessonSession.findMany({ where: sessionWhere(ownerId, range), select: { teacherId: true, lessonType: true, startTime: true, endTime: true } }),
  ]);
  const rows = teachers
    .map((t) => {
      const mine = sessions.filter((s) => s.teacherId === t.id);
      const byType = Object.fromEntries(Object.keys(LESSON_TYPES).map((k) => [k, mine.filter((s) => s.lessonType === k).length]));
      return { t, count: mine.length, byType, minutes: mine.reduce((x, s) => x + minutes(s.startTime, s.endTime), 0) };
    })
    .sort((a, b) => b.count - a.count);
  return { sessions: sessions.length, rows };
}

/**
 * Öğrenci bazında ders listesi. Planlanan: öğrencinin yoklaması alınmış ders sayısı;
 * Katıldı: Geldi + Geç. bySubject[ders] = [planlanan, katıldı]. Kaydı olmayan öğrenciler dahil edilmez.
 */
export async function lessonsByStudent(ownerId: string, range: LessonRange) {
  const [students, att] = await Promise.all([
    studentsOf(ownerId, range),
    prisma.attendance.findMany({
      where: { session: sessionWhere(ownerId, range) },
      select: { studentId: true, status: true, session: { select: { subject: true, lessonType: true } } },
    }),
  ]);
  type Agg = { planned: number; attended: number; byType: Record<string, number>; bySubject: Record<string, [number, number]> };
  const agg = new Map<string, Agg>();
  for (const a of att) {
    const m = agg.get(a.studentId) ?? { planned: 0, attended: 0, byType: {}, bySubject: {} };
    const came = a.status === "PRESENT" || a.status === "LATE";
    m.planned++;
    if (came) m.attended++;
    m.byType[a.session.lessonType] = (m.byType[a.session.lessonType] ?? 0) + 1;
    const sub = (m.bySubject[a.session.subject] ??= [0, 0]);
    sub[0]++;
    if (came) sub[1]++;
    agg.set(a.studentId, m);
  }
  const rows = students
    .flatMap((s) => {
      const m = agg.get(s.id);
      return m ? [{ s, m }] : [];
    })
    .sort((a, b) => (a.s.classroom?.name ?? "").localeCompare(b.s.classroom?.name ?? "", "tr") || a.s.firstName.localeCompare(b.s.firstName, "tr"));
  return { records: att.length, rows };
}
