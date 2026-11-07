import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { dayOfWeek } from "@/shared/date";
import { listStudents } from "@/modules/enrollment/server";
import { parseSlot } from "./validate";
import { teachesSubject } from "./teachers";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Yoklamanın hangi derse alındığı: var olan oturum, programdaki dersin o günkü oturumu ya da ek ders. */
export type AttendanceTarget = { sessionId: string } | { slotId: string; date: string };

export type TakeAttendanceInput = {
  date?: unknown;
  sessionId?: unknown;
  slotId?: unknown;
  /** Programda olmayan ek ders: { classroomId, teacherId, subject, lessonType, startTime, endTime } */
  extra?: Record<string, unknown>;
  /** { [studentId]: PRESENT | ABSENT | LATE | EXCUSED } */
  statuses?: Record<string, unknown>;
};

/**
 * Yoklama kaydeder ve oturum kimliğini döndürür.
 * Ders şunlardan biriyle seçilir: `sessionId` (var olan oturum), `slotId` (slotId+date oturumu yoksa oluşturulur)
 * ya da `extra` (programda olmayan ek ders → yeni oturum). Yalnızca oturumun sınıfındaki öğrenciler ve geçerli
 * durumlar kaydedilir (ek üyeler dahil); diğerleri sessizce yok sayılır.
 */
/** Öğretmen yalnızca kendi dersine (programdaki öğretmeni ya da dersin sorumlusu) yazabilir. */
async function assertTeaches(ownerId: string, teacherId: string | undefined, l: { teacherId: string; classroomId: string; subject: string }) {
  if (!teacherId || l.teacherId === teacherId) return;
  if (await teachesSubject(ownerId, teacherId, l.classroomId, l.subject)) return;
  throw notFound("Ders bulunamadı.");
}

/** `opts.teacherId`: öğretmen oturumu; yalnızca kendi derslerine yazabilir. */
export async function takeAttendance(ownerId: string, input: TakeAttendanceInput, opts: { teacherId?: string } = {}) {
  const date = String(input.date ?? "");
  if (!DATE.test(date)) throw invalid("Geçersiz tarih.");

  let session;
  if (input.sessionId) {
    session = await prisma.lessonSession.findFirst({ where: { id: String(input.sessionId), ownerId } });
    if (!session) throw notFound("Ders bulunamadı.");
    await assertTeaches(ownerId, opts.teacherId, session);
  } else if (input.slotId) {
    const slot = await prisma.scheduleSlot.findFirst({ where: { id: String(input.slotId), ownerId } });
    if (!slot) throw notFound("Ders bulunamadı.");
    await assertTeaches(ownerId, opts.teacherId, slot);
    session = await prisma.lessonSession.upsert({
      where: { slotId_date: { slotId: slot.id, date } },
      update: {},
      create: {
        ownerId,
        slotId: slot.id,
        classroomId: slot.classroomId,
        teacherId: slot.teacherId,
        subject: slot.subject,
        lessonType: slot.lessonType,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
  } else if (input.extra) {
    const { dayOfWeek: _d, ...d } = await parseSlot(ownerId, { ...input.extra, dayOfWeek: 1 });
    void _d;
    if (opts.teacherId && d.teacherId !== opts.teacherId) throw invalid("Ek dersi yalnızca kendi adınıza girebilirsiniz.");
    session = await prisma.lessonSession.create({ data: { ownerId, slotId: null, date, ...d } });
  } else {
    throw invalid("Ders seçilmedi.");
  }

  const statuses = input.statuses ?? {};
  const ids = Object.keys(statuses);
  if (ids.length) {
    const valid = await listStudents(ownerId, { ids, inClass: session.classroomId });
    const ok = new Set(valid.map((s) => s.id));
    const sessionId = session.id;
    await prisma.$transaction(
      ids
        .filter((id) => ok.has(id) && STATUSES.includes(statuses[id] as string))
        .map((studentId) => {
          const status = statuses[studentId] as string;
          return prisma.attendance.upsert({
            where: { sessionId_studentId: { sessionId, studentId } },
            update: { status },
            create: { sessionId, studentId, status },
          });
        }),
    );
  }
  return { sessionId: session.id };
}

/** Ders oturumunu ve yoklamasını siler. */
export async function deleteSession(ownerId: string, id: string, opts: { teacherId?: string } = {}) {
  const s = await prisma.lessonSession.findFirst({ where: { id, ownerId } });
  if (!s || (opts.teacherId && s.teacherId !== opts.teacherId)) throw notFound();
  await prisma.lessonSession.delete({ where: { id } });
}

/**
 * Bir günün dersleri: o günün programındaki dersler (varsa o günkü oturumlarıyla) + programda olmayan
 * (ek ya da programdan silinmiş) oturumlar. Başlangıç saati ve sınıfa göre sıralı.
 * `taken`: en az bir öğrencinin yoklaması girilmiş; `total`: sınıfın öğrenci sayısı (ek üyeler dahil).
 */
export async function lessonsOn(ownerId: string, date: string) {
  const withCount = { include: { _count: { select: { students: true, members: true } } } } as const;
  const [slots, sessions] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { ownerId, dayOfWeek: dayOfWeek(date) },
      include: { classroom: withCount, teacher: true },
    }),
    prisma.lessonSession.findMany({
      where: { ownerId, date },
      include: { classroom: withCount, teacher: true, attendances: { select: { status: true } } },
    }),
  ]);

  const bySlot = new Map(sessions.filter((s) => s.slotId).map((s) => [s.slotId!, s]));
  const slotIds = new Set(slots.map((sl) => sl.id));
  const summary = (s?: (typeof sessions)[number]) => ({
    taken: !!s && s.attendances.length > 0,
    absent: s?.attendances.filter((a) => a.status === "ABSENT").length ?? 0,
  });

  return [
    ...slots.map((sl) => {
      const s = bySlot.get(sl.id);
      return {
        slotId: sl.id as string | null,
        sessionId: s?.id ?? null,
        classroomId: sl.classroomId,
        classroom: sl.classroom.name,
        subject: sl.subject,
        teacher: sl.teacher.name,
        teacherId: sl.teacherId,
        lessonType: sl.lessonType,
        startTime: sl.startTime,
        endTime: sl.endTime,
        ...summary(s),
        total: sl.classroom._count.students + sl.classroom._count.members,
        extra: false,
      };
    }),
    ...sessions
      .filter((s) => !s.slotId || !slotIds.has(s.slotId))
      .map((s) => ({
        slotId: s.slotId,
        sessionId: s.id as string | null,
        classroomId: s.classroomId,
        classroom: s.classroom.name,
        subject: s.subject,
        teacher: s.teacher.name,
        teacherId: s.teacherId,
        lessonType: s.lessonType,
        startTime: s.startTime,
        endTime: s.endTime,
        ...summary(s),
        total: s.classroom._count.students + s.classroom._count.members,
        extra: true,
      })),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.classroom.localeCompare(b.classroom, "tr"));
}

/**
 * Yoklama listesi: dersin bilgisi, sınıfın öğrencileri (ek üyeler dahil, ada göre) ve varsa daha önce girilmiş durumlar.
 * Ders bulunamazsa / başka kurumunsa null. `extra`: programa bağlı olmayan oturum.
 */
export async function attendanceSheet(ownerId: string, target: AttendanceTarget) {
  let lesson;
  let sessionId: string | null = null;
  let extra = false;

  if ("sessionId" in target) {
    const s = await prisma.lessonSession.findFirst({ where: { id: target.sessionId, ownerId }, include: { classroom: true, teacher: true } });
    if (!s) return null;
    lesson = { ...s, classroom: s.classroom.name, teacher: s.teacher.name };
    sessionId = s.id;
    extra = !s.slotId;
  } else {
    if (!DATE.test(target.date)) return null;
    const sl = await prisma.scheduleSlot.findFirst({ where: { id: target.slotId, ownerId }, include: { classroom: true, teacher: true } });
    if (!sl) return null;
    lesson = { ...sl, classroom: sl.classroom.name, teacher: sl.teacher.name, date: target.date };
    const s = await prisma.lessonSession.findUnique({ where: { slotId_date: { slotId: sl.id, date: target.date } } });
    sessionId = s?.id ?? null;
  }

  const [students, existing] = await Promise.all([
    listStudents(ownerId, { inClass: lesson.classroomId }, "name"),
    sessionId ? prisma.attendance.findMany({ where: { sessionId } }) : Promise.resolve([]),
  ]);
  return {
    lesson: {
      classroomId: lesson.classroomId,
      classroom: lesson.classroom,
      subject: lesson.subject,
      teacher: lesson.teacher,
      teacherId: lesson.teacherId,
      lessonType: lesson.lessonType,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      date: lesson.date,
    },
    sessionId,
    extra,
    students,
    marks: Object.fromEntries(existing.map((a) => [a.studentId, a.status])) as Record<string, string>,
  };
}

/** Bir öğrencinin yoklama kayıtları (oturum + öğretmeniyle); isteğe bağlı tarih aralığı (YYYY-MM-DD, dahil). */
export async function studentAttendance(ownerId: string, studentId: string, range: { from?: string; to?: string } = {}) {
  return prisma.attendance.findMany({
    where: {
      studentId,
      session: { ownerId, ...(range.from || range.to ? { date: { gte: range.from, lte: range.to } } : {}) },
    },
    include: { session: { include: { teacher: true } } },
  });
}
