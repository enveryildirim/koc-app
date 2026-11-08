/**
 * Müfredat takibi: bir (ders, sınıf) setinin her konusu için yıllık plandaki ilerleme, soru havuzundaki
 * soru sayısı ve denemelerdeki başarı. Planlama, soru havuzu ve deneme tablolarını yalnızca okur.
 */
import { prisma } from "@/shared/db";
import { subjectMatches } from "@/shared/subjects";
import { ymd } from "@/shared/date";
import { parseSections, topicStats } from "@/modules/exams";
import { mondayOf, schoolYearOf, topicMatches } from "@/modules/planning";
import { gradeScope } from "@/modules/curriculum";

export type TopicTracking = {
  id: string;
  unit: string;
  topic: string;
  code: string;
  outcome: string;
  weeks: number;
  /** Bu eğitim yılında konuyu planında bulunduran sınıflar, konuyu işlemiş olanlar ve planlanan haftası geçtiği halde işlemeyenler */
  plan: { planned: number; done: number; late: number };
  /** Konuya bağlı sözlü / yazılı değerlendirmeler (bütün sınıflar): sayı ve öğrenci ortalaması (%) */
  assess: { count: number; avg: number | null };
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
      select: {
        id: true,
        subject: true,
        classroomId: true,
        classroom: { select: { name: true } },
        items: { select: { id: true, topic: true, doneDate: true, endWeek: true, curriculumTopicId: true } },
      },
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
  const thisWeek = mondayOf(ymd());
  const ids = new Set(topics.map((t) => t.id));
  // Konuya bağlı değerlendirmeler: plan satırı üzerinden
  const itemTopic = new Map(subjectPlans.flatMap((p) => p.items.filter((i) => i.curriculumTopicId && ids.has(i.curriculumTopicId)).map((i) => [i.id, i.curriculumTopicId!] as const)));
  const assessments = itemTopic.size
    ? await prisma.assessment.findMany({ where: { ownerId, planItemId: { in: [...itemTopic.keys()] } }, select: { planItemId: true, scores: { select: { percent: true } } } })
    : [];
  const bankItems = items.filter((q) => q.topic && subjectMatches(q.subject, subject) && (!q.grade || scope.grades.includes(q.grade)));
  const examStats = exams.flatMap((e) => topicStats(parseSections(e.sections), e.results)).filter((t) => subjectMatches(t.section, subject));

  const rows: TopicTracking[] = topics.map((t) => {
    let planned = 0;
    let done = 0;
    let late = 0;
    for (const p of subjectPlans) {
      // Müfredata bağlı planlarda bağ kimlikle; hiç bağı olmayan (eski / elle yazılmış) planlarda konu adıyla
      const byId = p.items.some((i) => i.curriculumTopicId);
      const matched = p.items.filter((i) => (byId ? i.curriculumTopicId === t.id : topicMatches(i.topic, t.topic)));
      if (!matched.length) continue;
      planned++;
      if (matched.every((i) => i.doneDate)) done++;
      else if (matched.some((i) => !i.doneDate && i.endWeek < thisWeek)) late++;
    }
    const pct = assessments.filter((a) => itemTopic.get(a.planItemId!) === t.id).flatMap((a) => a.scores.map((s) => s.percent).filter((x): x is number => x !== null));
    const count = assessments.filter((a) => itemTopic.get(a.planItemId!) === t.id).length;
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
      plan: { planned, done, late },
      assess: { count, avg: pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : null },
      bank: bankItems.filter((q) => topicMatches(q.topic, t.topic)).length,
      exam: { questions: ex.reduce((a, s) => a + s.questions, 0), total, rate: total ? Math.round((correct / total) * 100) : null },
    };
  });

  // Müfredatta karşılığı olmayan konu adları (yazım farkı ya da müfredata eklenmemiş konu)
  const known = (name: string) => topics.some((t) => topicMatches(name, t.topic));
  const linkedPlans = subjectPlans.filter((p) => p.items.some((i) => i.curriculumTopicId));
  const count = (names: string[]) => {
    const m = new Map<string, number>();
    for (const n of names) if (!known(n)) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  };
  const countAll = (names: string[]) => {
    const m = new Map<string, number>();
    for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n }));
  };
  const unmatched = {
    // Bağlı planlarda müfredatta karşılığı olmayan satırlar, bağsız planlarda adı eşleşmeyenler
    plan: [
      ...count(subjectPlans.filter((p) => !linkedPlans.includes(p)).flatMap((p) => [...new Set(p.items.map((i) => i.topic))])),
      ...countAll(linkedPlans.flatMap((p) => p.items.filter((i) => !i.curriculumTopicId).map((i) => i.topic))),
    ],
    bank: count(bankItems.map((q) => q.topic)),
    exam: count(examStats.map((s) => s.topic)),
  };

  const classPlans = subjectPlans
    .map((p) => {
      const linked = p.items.filter((i) => i.curriculumTopicId && ids.has(i.curriculumTopicId));
      return {
        planId: p.id,
        classroomId: p.classroomId,
        classroom: p.classroom.name,
        done: linked.filter((i) => i.doneDate).length,
        late: linked.filter((i) => !i.doneDate && i.endWeek < thisWeek).length,
        linked: linked.length,
        total: p.items.length,
      };
    })
    .sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }));

  return { rows, classes: subjectPlans.length, classPlans, examCount: exams.length, unmatched };
}
