import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { parseSlot } from "@/modules/schedule/server";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yoklama kaydet.
 * Gövde: { date, statuses: { [studentId]: status } } ve şunlardan biri:
 *  - sessionId: var olan ders oturumu
 *  - slotId: programdaki ders (slotId+date oturumu yoksa oluşturulur)
 *  - extra: { classroomId, teacherId, subject, lessonType, startTime, endTime } → programda olmayan ek ders
 */
export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json();
  const date = String(body.date ?? "");
  if (!DATE.test(date)) return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });

  let session;
  if (body.sessionId) {
    session = await prisma.lessonSession.findUnique({ where: { id: String(body.sessionId) } });
    if (!session || session.ownerId !== ownerId) return NextResponse.json({ error: "Ders bulunamadı." }, { status: 404 });
  } else if (body.slotId) {
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: String(body.slotId) } });
    if (!slot || slot.ownerId !== ownerId) return NextResponse.json({ error: "Ders bulunamadı." }, { status: 404 });
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
  } else if (body.extra) {
    const r = await parseSlot(ownerId, { ...body.extra, dayOfWeek: 1 });
    if (!r.data) return NextResponse.json({ error: r.error }, { status: 400 });
    const { dayOfWeek: _d, ...d } = r.data;
    void _d;
    session = await prisma.lessonSession.create({ data: { ownerId, slotId: null, date, ...d } });
  } else {
    return NextResponse.json({ error: "Ders seçilmedi." }, { status: 400 });
  }

  const statuses: Record<string, string> = body.statuses ?? {};
  const ids = Object.keys(statuses);
  if (ids.length) {
    const valid = await prisma.student.findMany({
      where: { id: { in: ids }, ownerId, classroomId: session.classroomId },
      select: { id: true },
    });
    const ok = new Set(valid.map((s) => s.id));
    await prisma.$transaction(
      ids
        .filter((id) => ok.has(id) && STATUSES.includes(statuses[id]))
        .map((studentId) =>
          prisma.attendance.upsert({
            where: { sessionId_studentId: { sessionId: session.id, studentId } },
            update: { status: statuses[studentId] },
            create: { sessionId: session.id, studentId, status: statuses[studentId] },
          }),
        ),
    );
  }
  return NextResponse.json({ sessionId: session.id });
}
