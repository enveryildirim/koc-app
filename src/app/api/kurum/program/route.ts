import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createSlots } from "@/modules/schedule/server";

/** Programa ders saati. Gövde: { classroomId, courseId, teacherId, lessonType, dayOfWeek | dayOfWeeks[], startTime, endTime, confirm? } */
export const POST = api(async (req) => {
  const ids = await createSlots(await ownerOrThrow(), await req.json());
  return { id: ids[0], ids };
});
