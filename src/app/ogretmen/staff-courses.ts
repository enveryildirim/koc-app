import { classroomsOf } from "@/modules/enrollment/server";
import { coursesForTeacher, listCourses } from "@/modules/schedule/server";

/**
 * Öğretmen ekranında listelenen dersler: öğretmenin girdiği / sorumlu olduğu dersler; etüt mesulüne
 * ayrıca mesulü olduğu sınıfların bütün dersleri (dışarıda alınanlar dahil).
 */
export async function staffCourses(me: { ownerId: string; teacherId: string; role: string }) {
  const own = await coursesForTeacher(me.ownerId, me.teacherId);
  if (me.role !== "MENTOR") return own;
  const mine = (await classroomsOf(me.ownerId)).filter((c) => c.mentorId === me.teacherId).map((c) => c.id);
  const extra = mine.length ? await listCourses(me.ownerId).then((l) => l.filter((c) => mine.includes(c.classroomId))) : [];
  const seen = new Set(own.map((c) => c.id));
  return [...own, ...extra.filter((c) => !seen.has(c.id))].sort((a, b) => a.classroomName.localeCompare(b.classroomName, "tr") || a.name.localeCompare(b.name, "tr"));
}
