import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { takeAttendance } from "@/modules/schedule/server";

/**
 * Yoklama kaydet.
 * Gövde: { date, statuses: { [studentId]: status } } ve şunlardan biri:
 *  - sessionId: var olan ders oturumu
 *  - slotId: programdaki ders (slotId+date oturumu yoksa oluşturulur)
 *  - extra: { classroomId, teacherId, subject, lessonType, startTime, endTime } → programda olmayan ek ders
 */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  return takeAttendance(ownerId, await req.json());
});
