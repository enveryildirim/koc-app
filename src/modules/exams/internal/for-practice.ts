import { bankItemsByIds, similarForItems } from "@/modules/question-bank/server";
import { keyFor, orderFor } from "../domain";
import { bankUsage } from "./for-bank";
import { examReport } from "./results";

/**
 * Yanlış yapılan soruların havuzdaki aynı / benzer soruları (öğretmen isteyince; öğrenciye kendiliğinden gitmez).
 * Öğretmen önerilerden seçer, seçtikleriyle çalışma kağıdı hazırlar (deneme kurma ekranı).
 *
 * Yalnızca havuzdan kurulmuş denemelerde çalışır: hangi kitapçıkta hangi sorunun hangi havuz sorusu olduğu `sections[].items`
 * ve kitapçık eşlemesinden (orderFor) bilinir. Boş bırakılan soru da yanlış sayılır.
 * Adaylar: onaylı, arşivde olmayan, bu denemede kullanılmamış sorular. Seçilen öğrencilerin sınıfının daha önce gördüğü
 * sorular elenmez, işaretlenir.
 *
 * scope: resultId (tek öğrenci) ya da classId (bir sınıf); ikisi de yoksa denemeye giren herkes.
 */
export async function practiceSuggestions(ownerId: string, examId: string, scope: { resultId?: string; classId?: string } = {}) {
  const report = await examReport(ownerId, examId);
  if (!report) return null;
  const { secs, exam } = report;
  const fromBank = secs.some((s) => (s.items?.length ?? 0) === s.count && s.count > 0);
  const rows = report.rows.filter((r) => (scope.resultId ? r.id === scope.resultId : scope.classId ? r.classId === scope.classId : true));
  const base = { exam: { id: exam.id, name: exam.name, courseId: exam.courseId }, fromBank, students: rows.length, student: scope.resultId ? (rows[0]?.name ?? null) : null };
  if (!fromBank || !rows.length) return { ...base, items: [] };

  // Havuz sorusu → yanlış yapan öğrenciler, denemedeki yeri (A kitapçığına göre)
  const wrong = new Map<string, { students: Set<string>; section: string; no: number }>();
  let offset = 0;
  for (const s of secs) {
    const items = s.items ?? [];
    if (items.length === s.count) {
      for (const r of rows) {
        const order = orderFor(s, r.booklet || "A");
        const key = keyFor(s, r.booklet || "A");
        if (!order) continue;
        for (let j = 0; j < s.count; j++) {
          const k = key[j];
          if (!k || k === " " || k === "?") continue;
          if ((r.answers[offset + j] ?? " ") === k) continue;
          const id = items[order[j]];
          const w = wrong.get(id) ?? { students: new Set<string>(), section: s.name, no: order[j] + 1 };
          w.students.add(r.studentId);
          wrong.set(id, w);
        }
      }
    }
    offset += s.count;
  }
  if (!wrong.size) return { ...base, items: [] };

  const inExam = new Set(secs.flatMap((s) => s.items ?? []));
  const ids = [...wrong.keys()];
  const [similar, own, usage] = await Promise.all([similarForItems(ownerId, ids, 10), bankItemsByIds(ownerId, ids), bankUsage(ownerId)]);
  const ownById = new Map(own.map((q) => [q.id, q]));
  const classes = new Set(rows.map((r) => r.classId));
  const items = ids
    .map((id) => {
      const q = ownById.get(id);
      const w = wrong.get(id)!;
      const candidates = (similar.get(id) ?? [])
        .filter((c) => !c.pending && !c.archived && !inExam.has(c.id))
        .map((c) => {
          const u = usage.usage[c.id];
          return { ...c, uses: u?.uses.length ?? 0, seen: !!u?.classIds.some((x) => classes.has(x)) };
        });
      return {
        id,
        section: w.section,
        no: w.no,
        wrong: w.students.size,
        type: q?.type ?? "",
        content: q?.content ?? null,
        hasImage: q?.hasImage ?? false,
        answer: q?.answer ?? "",
        topic: q?.topic ?? "",
        candidates,
      };
    })
    .sort((a, b) => b.wrong - a.wrong || a.section.localeCompare(b.section, "tr") || a.no - b.no);
  return { ...base, items };
}

export type PracticeSuggestions = NonNullable<Awaited<ReturnType<typeof practiceSuggestions>>>;
