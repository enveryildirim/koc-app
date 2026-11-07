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
export type TeacherRow = {
  id: string;
  name: string;
  branch: string;
  role: string;
  slotCount: number;
  /** Kişisel giriş linki (yoksa null); lastUsedAt ISO */
  link?: { token: string; lastUsedAt: string | null } | null;
};
export type CourseRow = {
  id: string;
  classroomId: string;
  name: string;
  kind: string;
  teacherId: string | null;
  teacherName: string | null;
  external: boolean;
  /** Programdaki haftalık ders sayısı ve dakikası */
  slotCount: number;
  weeklyMinutes: number;
};

export const TYPE_STYLE: Record<string, string> = {
  GRUP: "border-rule bg-surface text-graphite",
  ETUT: "border-amber-200 bg-amber-50 text-amber-800",
  OZEL: "border-violet-200 bg-violet-50 text-violet-800",
};
