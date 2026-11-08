/**
 * Konu takibi (bir sınıfın bir dersi): yıllık planın her konusu için durum, işlendiği ders, konuya bağlı
 * değerlendirmeler ve denemelerdeki başarı. Planlama, değerlendirme ve deneme tablolarını yalnızca okur.
 */
import { prisma } from "@/shared/db";
import { ymd } from "@/shared/date";
import { byWeek, itemState, planProgress, schoolYearRange } from "@/modules/planning";
import { examPlanCoverage, findPlan } from "@/modules/planning/server";
import { examsBetween } from "@/modules/exams/server";

export type TopicRow = {
  id: string;
  order: number;
  unit: string;
  topic: string;
  week: string;
  endWeek: string;
  doneDate: string | null;
  state: ReturnType<typeof itemState>;
  /** İşaretlendiği yoklama oturumu (yoklama ekranından işaretlendiyse) */
  sessionId: string | null;
  /** Müfredattaki karşılığı; null = müfredatta yok */
  curriculum: { code: string; outcome: string } | null;
  /** Konuya bağlı sözlü / yazılı / uygulama değerlendirmeleri */
  assessments: { id: string; title: string; date: string; avg: number | null }[];
  /** Denemelerde bu konuya düşen sorularda sınıfın başarısı */
  exams: { id: string; name: string; date: string; rate: number; questions: number }[];
};

export async function planTopicTracking(ownerId: string, planId: string, today = ymd()) {
  const plan = await findPlan(ownerId, planId);
  if (!plan) return null;
  const items = byWeek(plan.items);
  const ids = items.map((i) => i.id);

  const [topics, assessments] = await Promise.all([
    prisma.curriculumTopic.findMany({
      where: { ownerId, id: { in: items.map((i) => i.curriculumTopicId).filter((x): x is string => !!x) } },
      select: { id: true, code: true, outcome: true },
    }),
    prisma.assessment.findMany({
      where: { ownerId, planItemId: { in: ids } },
      select: { id: true, title: true, date: true, planItemId: true, scores: { select: { percent: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Sınıfın bu yılki denemeleri: konusu girilmiş bölümler plan konularıyla ada göre eşleşir
  const { from, to } = schoolYearRange(plan.year);
  const exams: Map<string, TopicRow["exams"]> = new Map();
  for (const e of await examsBetween(ownerId, from, to < today ? to : today)) {
    const cov = await examPlanCoverage(ownerId, e.id);
    const cls = cov?.classes.find((c) => c.classroomId === plan.classroomId);
    if (!cov || !cls) continue;
    for (const s of cls.sections) {
      if (s.plan?.id !== plan.id) continue;
      for (const t of s.topics) {
        for (const name of t.planTopics) {
          const list = exams.get(name) ?? [];
          list.push({ id: cov.exam.id, name: cov.exam.name, date: cov.exam.date, rate: t.rate, questions: t.questions });
          exams.set(name, list);
        }
      }
    }
  }

  const rows: TopicRow[] = items.map((i) => {
    const cur = topics.find((t) => t.id === i.curriculumTopicId);
    return {
      id: i.id,
      order: i.order,
      unit: i.unit,
      topic: i.topic,
      week: i.week,
      endWeek: i.endWeek,
      doneDate: i.doneDate,
      state: itemState(i, today),
      sessionId: i.sessionId,
      curriculum: cur ? { code: cur.code, outcome: cur.outcome } : null,
      assessments: assessments
        .filter((a) => a.planItemId === i.id)
        .map((a) => {
          const p = a.scores.map((s) => s.percent).filter((x): x is number => x !== null);
          return { id: a.id, title: a.title, date: a.date, avg: p.length ? Math.round(p.reduce((x, y) => x + y, 0) / p.length) : null };
        }),
      exams: exams.get(i.topic) ?? [],
    };
  });

  return {
    plan: { id: plan.id, subject: plan.subject, year: plan.year, startDate: plan.startDate, classroom: plan.classroom },
    holidays: plan.holidays,
    progress: planProgress(plan.items, today),
    linked: rows.filter((r) => r.curriculum).length,
    rows,
  };
}
