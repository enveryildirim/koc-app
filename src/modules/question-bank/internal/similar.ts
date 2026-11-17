import { prisma } from "@/shared/db";
import { subjectKey } from "@/modules/curriculum";
import { answerKey, findSimilar, type SimDoc, type SimilarHit, type SimilarKind } from "../similarity";
import { parseContent, plainText, type QuestionContent } from "../written";

/** Benzer sorunun ekranda / agent'a gösterilen özeti. */
export type SimilarQuestion = {
  id: string;
  kind: SimilarKind;
  stem: string;
  options?: string[];
  answer: string;
  type: string;
  subject: string;
  topic: string;
  grade: string;
  hasImage: boolean;
  /** Onay bekliyor (yapay zekâ ile eklendi, henüz onaylanmadı) */
  pending: boolean;
  archived: boolean;
};

/** Taslak soru (henüz kaydedilmemiş): yazma ekranı ve MCP. type + answer verilirse cevabı farklı olan "Aynı soru" sayılmaz. */
export type SimilarDraft = { subject: string; content: QuestionContent; type?: string; answer?: string };

const doc = (id: string, c: QuestionContent, type = "", answer = ""): SimDoc => ({ id, stem: c.stem, options: c.options, key: answerKey(type, answer, c.options) });

/**
 * Karşılaştırma havuzu: verilen derslerdeki metinli sorular (kesilmiş, yalnızca görsel olan sorular karşılaştırılamaz).
 * Arşivdekiler ve onay bekleyenler de dahil: arşivdeki bir sorunun tekrarı da tekrardır; aynı soruyu iki agent eklemiş olabilir.
 * Ders adı yazılış farkı gözetmeden eşleşir. Sınıf düzeyiyle daraltılmaz (aynı soru başka düzeyde de tekrardır).
 */
async function poolOf(ownerId: string, subjects: string[]) {
  const keys = new Set(subjects.map(subjectKey));
  const names = (await prisma.questionItem.groupBy({ by: ["subject"], where: { ownerId } })).map((g) => g.subject).filter((s) => keys.has(subjectKey(s)));
  if (!names.length) return [];
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, subject: { in: names }, content: { not: "" } },
    select: { id: true, subject: true, topic: true, grade: true, type: true, answer: true, content: true, imageKey: true, needsReview: true, archivedAt: true },
  });
  return rows.flatMap((r) => {
    const c = parseContent(r.content);
    return c && plainText(c) ? [{ ...r, c }] : [];
  });
}

type PoolRow = Awaited<ReturnType<typeof poolOf>>[number];

const rowDoc = (r: PoolRow) => doc(r.id, r.c, r.type, r.answer);

const summary = (r: PoolRow, h: SimilarHit): SimilarQuestion => ({
  id: r.id,
  kind: h.kind,
  stem: r.c.stem,
  options: r.c.options,
  answer: r.answer,
  type: r.type,
  subject: r.subject,
  topic: r.topic,
  grade: r.grade,
  hasImage: !!r.imageKey,
  pending: r.needsReview,
  archived: !!r.archivedAt,
});

/** Ders başına ayrı hesap (IDF o dersin sorularından). */
function bySubject<T extends { subject: string }>(xs: T[]) {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(subjectKey(x.subject), [...(m.get(subjectKey(x.subject)) ?? []), x]);
  return m;
}

/**
 * Havuzdaki sorular için benzerleri: kimlik → benzer sorular (önce "Aynı soru", sonra "Kardeş soru").
 * Metni olmayan (kesilmiş) sorular ve benzeri olmayanlar sonuçta yer almaz.
 */
export async function similarForItems(ownerId: string, ids: string[], top?: number) {
  const out = new Map<string, SimilarQuestion[]>();
  if (!ids.length) return out;
  const own = await prisma.questionItem.findMany({ where: { ownerId, id: { in: ids }, content: { not: "" } }, select: { id: true, subject: true } });
  if (!own.length) return out;
  const pool = await poolOf(ownerId, [...new Set(own.map((o) => o.subject))]);
  const rowOf = new Map(pool.map((r) => [r.id, r]));
  for (const [k, rows] of bySubject(pool)) {
    const queries = own.filter((o) => subjectKey(o.subject) === k && rowOf.has(o.id)).map((o) => rowDoc(rowOf.get(o.id)!));
    if (!queries.length) continue;
    for (const [id, hits] of findSimilar(queries, rows.map(rowDoc), { top })) {
      if (hits.length) out.set(id, hits.map((h) => summary(rowOf.get(h.id)!, h)));
    }
  }
  return out;
}

/** Tek sorunun benzerleri (soru ayrıntısı paneli). */
export async function similarForItem(ownerId: string, id: string) {
  return (await similarForItems(ownerId, [id], 10)).get(id) ?? [];
}

/**
 * Henüz kaydedilmemiş sorular için benzerler: havuzdakiler ve aynı gönderimdeki diğer taslaklar.
 * Sonuç taslak sırasıyla; taslaklar arası eşleşme `draft` (diğer taslağın sırası, 0'dan) ile döner.
 * `exclude`: düzenlenen sorunun kendisi.
 */
export async function similarForDrafts(ownerId: string, drafts: SimilarDraft[], opts: { exclude?: string; top?: number } = {}) {
  const res: { bank: SimilarQuestion[]; drafts: { index: number; kind: SimilarKind }[] }[] = drafts.map(() => ({ bank: [], drafts: [] }));
  const usable = drafts.map((d, i) => ({ ...d, i })).filter((d) => plainText(d.content));
  if (!usable.length) return res;
  const pool = (await poolOf(ownerId, [...new Set(usable.map((d) => d.subject))])).filter((r) => r.id !== opts.exclude);
  const rowOf = new Map(pool.map((r) => [r.id, r]));
  const poolBy = bySubject(pool);
  for (const [k, ds] of bySubject(usable)) {
    const draftDocs = ds.map((d) => doc(`draft:${d.i}`, d.content, d.type, d.answer));
    const bankDocs = (poolBy.get(k) ?? []).map(rowDoc);
    for (const [id, hits] of findSimilar(draftDocs, [...bankDocs, ...draftDocs], { top: opts.top })) {
      const i = Number(id.slice(6));
      for (const h of hits) {
        if (h.id.startsWith("draft:")) res[i].drafts.push({ index: Number(h.id.slice(6)), kind: h.kind });
        else res[i].bank.push(summary(rowOf.get(h.id)!, h));
      }
    }
  }
  return res;
}
