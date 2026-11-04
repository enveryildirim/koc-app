import { prisma } from "@/shared/db";
import { addDays, ymd } from "@/shared/date";
import { subjectMatches } from "@/shared/subjects";
import { topicStats } from "@/modules/exams";
import { examReport, examsBetween } from "@/modules/exams/server";
import { schoolYearOf } from "../calendar";
import { mondayOf } from "../plan";
import { matchPlanTopics } from "../topics";
import { planOverview } from "./lessonPlans";

export type TopicCoverage = {
  topic: string;
  questions: number;
  /** Sınıfın bu konudaki doğru oranı (%) */
  rate: number;
  /**
   * done: deneme tarihine kadar işlendi · late: planlanan haftası denemeden önce bitmişti ama işlenmedi
   * (gecikme) · notYet: planda deneme tarihinden sonraya planlı · unplanned: planda karşılığı yok
   */
  status: "done" | "late" | "notYet" | "unplanned";
  planTopics: string[];
  /** late / notYet için: planda ilk işlenmemiş karşılığının başlangıç haftası */
  plannedWeek: string | null;
};

export type SectionCoverage = { section: string; plan: { id: string; subject: string } | null; topics: TopicCoverage[] };

/**
 * Deneme ↔ yıllık plan uyumu: denemeye giren her sınıf için, konusu girilmiş bölümlerin konuları
 * deneme tarihine kadar işlenmiş mi? Deneme yoksa null.
 */
export async function examPlanCoverage(ownerId: string, examId: string) {
  const report = await examReport(ownerId, examId);
  if (!report) return null;
  const examDate = ymd(report.exam.date);
  const secs = report.secs.filter((s) => s.topics?.some(Boolean));
  const byClass = new Map<string, { name: string; rows: typeof report.rows }>();
  for (const r of report.rows) {
    if (r.classId === "_") continue;
    const c = byClass.get(r.classId) ?? { name: r.className, rows: [] };
    c.rows.push(r);
    byClass.set(r.classId, c);
  }
  const plans = await prisma.lessonPlan.findMany({
    where: { ownerId, year: schoolYearOf(examDate), classroomId: { in: [...byClass.keys()] } },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const classes = [...byClass.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name, "tr", { numeric: true }))
    .map(([classroomId, c]) => {
      const stats = topicStats(report.secs, c.rows);
      const sections: SectionCoverage[] = secs.map((s) => {
        const plan = plans.find((p) => p.classroomId === classroomId && subjectMatches(s.name, p.subject)) ?? null;
        const names = [...new Set(s.topics!.filter(Boolean))];
        const topics = names.map((topic): TopicCoverage => {
          const st = stats.find((x) => x.section === s.name && x.topic === topic);
          const base = { topic, questions: st?.questions ?? 0, rate: st?.rate ?? 0 };
          if (!plan) return { ...base, status: "unplanned", planTopics: [], plannedWeek: null };
          const matched = matchPlanTopics(topic, plan.items.map((i) => i.topic)).map((i) => plan.items[i]);
          if (!matched.length) return { ...base, status: "unplanned", planTopics: [], plannedWeek: null };
          const undone = matched.filter((i) => !i.doneDate || i.doneDate > examDate);
          return {
            ...base,
            status: !undone.length ? "done" : addDays(undone[0].endWeek, 4) < examDate ? "late" : "notYet",
            planTopics: matched.map((i) => i.topic),
            plannedWeek: undone[0]?.week ?? null,
          };
        });
        return { section: s.name, plan: plan && { id: plan.id, subject: plan.subject }, topics };
      });
      const planned = sections.filter((s) => s.plan);
      const count = (st: TopicCoverage["status"]) => planned.reduce((a, s) => a + s.topics.filter((t) => t.status === st).length, 0);
      return { classroomId, classroom: c.name, students: c.rows.length, sections, summary: { done: count("done"), late: count("late"), notYet: count("notYet"), unplanned: count("unplanned") } };
    });

  return { exam: { id: report.exam.id, name: report.exam.name, date: examDate }, hasTopics: secs.length > 0, classes };
}

/**
 * Analiz merkezi için yıllık plan uyarıları:
 * - plana göre geride kalan sınıf-ders çiftleri,
 * - son `days` gündeki denemelerde, plana göre işlenmiş olması gerektiği halde işlenmeden sorulan konular.
 */
export async function planAlerts(ownerId: string, today: string, days = 45) {
  const year = schoolYearOf(today);
  const overview = await planOverview(ownerId, year, today);
  const behind = overview
    .filter((r) => r.plan && r.plan.progress.behindWeeks > 0)
    .sort((a, b) => b.plan!.progress.behindWeeks - a.plan!.progress.behindWeeks);

  const from = ymd(new Date(Date.parse(today) - days * 86400000));
  const exams = await examsBetween(ownerId, from, today);
  const late: { examId: string; exam: string; date: string; classroomId: string; classroom: string; section: string; planId: string; topic: string; plannedWeek: string | null; rate: number; questions: number }[] = [];
  for (const e of exams) {
    const cov = await examPlanCoverage(ownerId, e.id);
    if (!cov) continue;
    for (const c of cov.classes)
      for (const s of c.sections)
        for (const t of s.topics)
          if (s.plan && t.status === "late")
            late.push({ examId: e.id, exam: e.name, date: cov.exam.date, classroomId: c.classroomId, classroom: c.classroom, section: s.section, planId: s.plan.id, topic: t.topic, plannedWeek: t.plannedWeek, rate: t.rate, questions: t.questions });
  }
  late.sort((a, b) => b.date.localeCompare(a.date) || a.classroom.localeCompare(b.classroom, "tr", { numeric: true }));
  const planned = overview.filter((r) => r.plan);
  return {
    year,
    thisWeek: mondayOf(today),
    plannedCount: planned.length,
    pairCount: overview.length,
    behind,
    late,
  };
}
