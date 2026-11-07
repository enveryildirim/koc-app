import { addDays } from "@/shared/date";
import { lessonsOn } from "@/modules/schedule/server";
import { holidaysOn, topicsForLesson } from "@/modules/planning/server";

/*
 * Öğretmen ekranı ("Bugün") için gündem: günün dersleri (yoklama ve işlenen konu durumuyla)
 * ve son günlerde girişi eksik kalan dersler. Okuma modelidir; yazmaz.
 */

export type AgendaLesson = {
  slotId: string | null;
  sessionId: string | null;
  date: string;
  classroomId: string;
  classroom: string;
  subject: string;
  lessonType: string;
  startTime: string;
  endTime: string;
  /** Sınıfın öğrenci sayısı (ek üyeler dahil) ve gelmeyen sayısı */
  total: number;
  absent: number;
  taken: boolean;
  holiday: string | null;
  /** Yıllık planı var mı, bu tarihte işlenen konu işaretlenmiş mi */
  hasPlan: boolean;
  topicDone: boolean;
};

async function day(ownerId: string, teacherId: string, date: string, withTopics: boolean): Promise<AgendaLesson[]> {
  const [lessons, holidays] = await Promise.all([lessonsOn(ownerId, date), holidaysOn(ownerId, date)]);
  const mine = lessons.filter((l) => l.teacherId === teacherId);
  return Promise.all(
    mine.map(async (l) => {
      const h = holidays.find((x) => !x.classroomId || x.classroomId === l.classroomId);
      const topics = withTopics ? await topicsForLesson(ownerId, l.classroomId, l.subject, date) : null;
      return {
        slotId: l.slotId,
        sessionId: l.sessionId,
        date,
        classroomId: l.classroomId,
        classroom: l.classroom,
        subject: l.subject,
        lessonType: l.lessonType,
        startTime: l.startTime,
        endTime: l.endTime,
        total: l.total,
        absent: l.absent,
        taken: l.taken,
        holiday: l.taken ? null : (h?.title ?? null),
        hasPlan: !!topics,
        topicDone: !!topics?.items.some((i) => i.doneDate === date),
      };
    }),
  );
}

/**
 * `date` günün dersleri; `today` ise ayrıca bugünden önceki `lookback` gün içinde yoklaması alınmamış
 * (tatil olmayan) dersler, en yenisi önce.
 */
export async function teacherAgenda(ownerId: string, teacherId: string, date: string, today: string, lookback = 14) {
  const lessons = await day(ownerId, teacherId, date, true);
  const missing: AgendaLesson[] = [];
  if (date === today) {
    for (let i = 1; i <= lookback; i++) {
      const d = addDays(today, -i);
      missing.push(...(await day(ownerId, teacherId, d, false)).filter((l) => !l.taken && !l.holiday));
    }
  }
  return { lessons, missing };
}
