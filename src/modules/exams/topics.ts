import { parseSections, topicStats, TopicStat } from "./domain";

/** Bir öğrencinin birden fazla denemedeki konu başarısını birleştirir (ders|konu bazında). */
export function combinedTopics(results: { answers: string; booklet: string; exam: { sections: string } }[]): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const r of results) {
    for (const t of topicStats(parseSections(r.exam.sections), [r])) {
      if (t.total === 0) continue;
      const k = t.section + "|" + t.topic;
      const cur = map.get(k) ?? { ...t, questions: 0, correct: 0, total: 0 };
      cur.questions += t.questions;
      cur.correct += t.correct;
      cur.total += t.total;
      map.set(k, cur);
    }
  }
  return [...map.values()].map((x) => ({ ...x, rate: x.total ? Math.round((x.correct / x.total) * 100) : 0 }));
}
