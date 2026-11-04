export type SlotRow = {
  id: string;
  classroomId: string;
  classroomName: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  lessonType: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};
export type Opt = { id: string; name: string };
export type TeacherRow = { id: string; name: string; branch: string; slotCount: number };

export const TYPE_STYLE: Record<string, string> = {
  GRUP: "border-rule bg-white text-graphite",
  ETUT: "border-amber-200 bg-amber-50 text-amber-800",
  OZEL: "border-violet-200 bg-violet-50 text-violet-800",
};
