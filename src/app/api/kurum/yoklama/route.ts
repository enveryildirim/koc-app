import { api } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { takeAttendance } from "@/modules/schedule/server";

/**
 * Yoklama kaydet. Kurum hesabı, etüt mesulü ve (yalnızca kendi dersine) öğretmen kullanabilir.
 * Gövde: { date, statuses: { [studentId]: status } } ve şunlardan biri:
 *  - sessionId: var olan ders oturumu
 *  - slotId: programdaki ders (slotId+date oturumu yoksa oluşturulur)
 *  - extra: { classroomId, teacherId, subject, lessonType, startTime, endTime } → programda olmayan ek ders
 */
export const POST = api(async (req) => {
  const a = await actorOrThrow();
  return takeAttendance(a.ownerId, await req.json(), { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
