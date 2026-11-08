import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { classroomsOf, listStudents } from "@/modules/enrollment/server";
import { listCourses, listTeachers } from "@/modules/schedule/server";
import { staffLabel, teacherSub } from "@/modules/schedule";

/**
 * Hızlı arama dizini: öğrenciler, sınıflar, dersler, öğretmenler (yalnızca ad, numara, sınıf).
 * Arama istemcide yapılır: Türkçe harfler eşlenir ("simsek" → Şimşek), ad + soyad birlikte aranır.
 * 1000 öğrenci ≈ 60 KB; pencere her açılışta değil, sayfa başına bir kez çeker.
 */
export const GET = api(async () => {
  const ownerId = await ownerOrThrow();
  const [students, classes, courses, teachers] = await Promise.all([listStudents(ownerId, {}, "name"), classroomsOf(ownerId), listCourses(ownerId), listTeachers(ownerId)]);
  return {
    students: students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, no: s.studentNo, cls: s.classroom?.name ?? (s.external ? "Kurum dışı" : "") })),
    classes: classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
    courses: courses.map((c) => ({ id: c.id, name: c.name, classroomId: c.classroomId, cls: c.classroomName, teacher: c.teacherName ? staffLabel(c.teacherName, c.teacherRole) : "" })),
    teachers: teachers.map((t) => ({ id: t.id, name: t.name, branch: teacherSub(t) })),
  };
});
