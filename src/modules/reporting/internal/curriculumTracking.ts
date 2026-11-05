/**
 * Müfredat takibi: bir (ders, sınıf) setinin her konusu için yıllık plandaki ilerleme, soru havuzundaki
 * soru sayısı ve denemelerdeki başarı. Planlama, soru havuzu ve deneme tablolarını yalnızca okur.
 */
import { prisma } from "@/shared/db";
import { subjectMatches } from "@/shared/subjects";
import { ymd } from "@/shared/date";
import { parseSections, topicStats } from "@/modules/exams";
import { schoolYearOf, topicMatches } from "@/modules/planning";
import { gradeScope } from "@/modules/curriculum";

export type TopicTracking = {
  id: string;
  unit: string;
  topic: string;
  code: string;
  outcome: string;
  weeks: number;
  /** Bu eğitim yılında konuyu planında bulunduran sınıflar ve konuyu işlemiş olanlar */
  plan: { planned: number; done: number };
  /** Soru havuzundaki soru sayısı */
  bank: number;
  /** Denemelerdeki soru sayısı, cevap sayısı ve doğru oranı (null = denemede sorulmamış) */
  exam: { questions: number; total: number; rate: number | null };
};

export async function curriculumTracking(ownerId: string, subject: string, grade: string) {
  const scope = gradeScope(grade);
  const year = schoolYearOf(ymd());
  const [topics, plans, items, exams] = await Promise.all([
    prisma.curriculumTopic.findMany({ where: { ownerId, subject, grade }, orderBy: { order: "asc" } }),
    prisma.lessonPlan.findMany({
      where: { ownerId, year, classroom: { level: { in: scope.levels } } },
      select: { subject: true, classroomId: true, items: { select: { topic: true, doneDate: true } } },
    }),
    prisma.questionItem.findMany({ where: { ownerId }, select: { subject: true, topic: true, grade: true } }),
    scope.examTypes.length
      ? prisma.exam.findMany({
          where: { ownerId, type: { in: scope.examTypes }, results: { some: {} } },
          select: { sections: true, results: { select: { answers: true, booklet: true } } },
        })
      : Promise.resolve([]),
  ]);

  const subjectPlans = plans.filter((p) => subjectMatches(p.subject, subject));
  const bankItems = items.filter((q) => q.topic && subjectMatches(q.subject, subject) && (!q.grade || scope.grades.includes(q.grade)));
  const examStats = exams.flatMap((e) => topicStats(parseSections(e.sections), e.results)).filter((t) => subjectMatches(t.section, subject));

  const rows: TopicTracking[] = topics.map((t) => {
    let planned = 0;
    let done = 0;
    for (const p of subjectPlans) {
      const matched = p.items.filter((i) => topicMatches(i.topic, t.topic));
      if (!matched.length) continue;
      planned++;
      if (matched.every((i) => i.doneDate)) done++;
    }
    const ex = examStats.filter((s) => topicMatches(s.topic, t.topic));
    const total = ex.reduce((a, s) => a + s.total, 0);
    const correct = ex.reduce((a, s) => a + s.correct, 0);
    return {
      id: t.id,
      unit: t.unit,
      topic: t.topic,
      code: t.code,
      outcome: t.outcome,
      weeks: t.weeks,
      plan: { planned, done },
      bank: bankItems.filter((q) => topicMatches(q.topic, t.topic)).length,
      exam: { questions: ex.reduce((a, s) => a + s.questions, 0), total, rate: total ? Math.round((correct / total) * 100) : null },
    };
  });

  // Müfredatta karşılığı olmayan konu adları (yazım farkı ya da müfredata eklenmemiş konu)
  const known = (name: string) => topics.some((t) => topicMatches(name, t.topic));
  const count = (names: string[]) => {
    const m = new Map<string, number>();
    for (const n of names) if (!known(n)) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  };
  const unmatched = {
    plan: count(subjectPlans.flatMap((p) => [...new Set(p.items.map((i) => i.topic))])),
    bank: count(bankItems.map((q) => q.topic)),
    exam: count(examStats.map((s) => s.topic)),
  };

  return { rows, classes: subjectPlans.length, examCount: exams.length, unmatched };
}
