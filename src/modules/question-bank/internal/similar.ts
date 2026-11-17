import { prisma } from "@/shared/db";
import { subjectKey } from "@/modules/curriculum";
import { answerKey, findSimilar, type SimDoc, type SimilarKind } from "../similarity";
import { parseContent, plainText, type QuestionContent } from "../written";
import { hashDistance, IMAGE_SAME } from "./image-hash";

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
  /** Kesilmiş soru: içerik görseldedir (stem / options yazıya geçirilmiş metindir ya da boştur); ekranda görsel gösterilir */
  cut: boolean;
  /** Onay bekliyor (yapay zekâ ile eklendi, henüz onaylanmadı) */
  pending: boolean;
  archived: boolean;
};

/** Taslak soru (henüz kaydedilmemiş): yazma ekranı ve MCP. type + answer verilirse cevabı farklı olan "Aynı soru" sayılmaz. */
export type SimilarDraft = { subject: string; content: QuestionContent; type?: string; answer?: string };

/** Metni olan sorular: yazılanlar ve yazıya geçirilmiş kesilmiş sorular. */
const TEXTED = { OR: [{ content: { not: "" } }, { transcript: { not: "" } }] };
/** Yazılı içerik, yoksa kesilmiş sorunun yazıya geçirilmiş metni. */
const contentOf = (r: { content: string; transcript: string }) => parseContent(r.content) ?? parseContent(r.transcript);

const doc = (id: string, c: QuestionContent, type = "", answer = ""): SimDoc => ({ id, stem: c.stem, options: c.options, key: answerKey(type, answer, c.options) });

/**
 * Karşılaştırma havuzu: verilen derslerdeki metinli sorular (yazılanlar ve yazıya geçirilmiş kesilmiş sorular; metinsiz
 * kesilmiş sorular burada yok, onlar görsel parmak iziyle karşılaştırılır: imageMatches).
 * Arşivdekiler ve onay bekleyenler de dahil: arşivdeki bir sorunun tekrarı da tekrardır; aynı soruyu iki agent eklemiş olabilir.
 * Ders adı yazılış farkı gözetmeden eşleşir. Sınıf düzeyiyle daraltılmaz (aynı soru başka düzeyde de tekrardır).
 */
async function poolOf(ownerId: string, subjects: string[]) {
  const keys = new Set(subjects.map(subjectKey));
  const names = (await prisma.questionItem.groupBy({ by: ["subject"], where: { ownerId } })).map((g) => g.subject).filter((s) => keys.has(subjectKey(s)));
  if (!names.length) return [];
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, subject: { in: names }, ...TEXTED },
    select: { id: true, subject: true, topic: true, grade: true, type: true, answer: true, content: true, transcript: true, imageKey: true, needsReview: true, archivedAt: true },
  });
  return rows.flatMap((r) => {
    const c = contentOf(r);
    return c && plainText(c) ? [{ ...r, c }] : [];
  });
}

type PoolRow = Awaited<ReturnType<typeof poolOf>>[number];

const rowDoc = (r: PoolRow) => doc(r.id, r.c, r.type, r.answer);

const summary = (r: PoolRow, h: { kind: SimilarKind }): SimilarQuestion => ({
  id: r.id,
  kind: h.kind,
  cut: !r.content,
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
 * Havuzdaki sorular için benzerleri: kimlik → benzer sorular (önce "Aynı soru", sonra "Benzer soru").
 * Metni olmayan (kesilmiş) sorular ve benzeri olmayanlar sonuçta yer almaz.
 */
export async function similarForItems(ownerId: string, ids: string[], top?: number) {
  const out = new Map<string, SimilarQuestion[]>();
  if (!ids.length) return out;
  // Kesilmiş sorular: aynı görsel (parmak izi) önce; metni varsa metin benzerliği de eklenir
  for (const [id, list] of await imageMatches(ownerId, ids)) out.set(id, list);
  const own = await prisma.questionItem.findMany({ where: { ownerId, id: { in: ids }, ...TEXTED }, select: { id: true, subject: true } });
  if (!own.length) return out;
  const pool = await poolOf(ownerId, [...new Set(own.map((o) => o.subject))]);
  const rowOf = new Map(pool.map((r) => [r.id, r]));
  for (const [k, rows] of bySubject(pool)) {
    const queries = own.filter((o) => subjectKey(o.subject) === k && rowOf.has(o.id)).map((o) => rowDoc(rowOf.get(o.id)!));
    if (!queries.length) continue;
    for (const [id, hits] of findSimilar(queries, rows.map(rowDoc), { top })) {
      if (!hits.length) continue;
      const have = out.get(id) ?? [];
      const seen = new Set(have.map((x) => x.id));
      out.set(id, [...have, ...hits.filter((h) => !seen.has(h.id)).map((h) => summary(rowOf.get(h.id)!, h))].slice(0, Math.max(top ?? 5, have.length)));
    }
  }
  return out;
}

/** Kesilmiş sorular arası aynı görsel (parmak izi farkı ≤ IMAGE_SAME): kimlik → "Aynı soru" listesi. Ders gözetilmez. */
async function imageMatches(ownerId: string, ids: string[]) {
  const out = new Map<string, SimilarQuestion[]>();
  const own = await prisma.questionItem.findMany({ where: { ownerId, id: { in: ids }, content: "", imageHash: { not: "" } }, select: { id: true, imageHash: true } });
  const valid = own.filter((o) => o.imageHash.length > 1);
  if (!valid.length) return out;
  const all = await prisma.questionItem.findMany({
    where: { ownerId, content: "", imageHash: { not: "" } },
    select: { id: true, subject: true, topic: true, grade: true, type: true, answer: true, content: true, transcript: true, imageKey: true, needsReview: true, archivedAt: true, imageHash: true },
  });
  for (const o of valid) {
    const list = all
      .filter((r) => r.id !== o.id && hashDistance(o.imageHash, r.imageHash) <= IMAGE_SAME)
      .map(({ imageHash: _h, ...r }) => (void _h, summary({ ...r, c: contentOf(r) ?? { stem: "" } }, { kind: "same" })));
    if (list.length) out.set(o.id, list);
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

/**
 * Deneme kurma ekranı için: seçilebilir sorular (arşivdekiler ve onay bekleyenler hariç) arasındaki aynı / benzer soru çiftleri.
 * kimlik → { id, kind }[] (iki yönlü; benzeri olmayan yok). Aynı denemeye benzer iki soru konmasın diye ekranda uyarı verilir.
 * Not: ders başına tüm çiftler karşılaştırılır (n²); havuz binlerce soruya çıkınca önbelleğe alınmalı.
 */
export async function similarPairs(ownerId: string) {
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, archivedAt: null, needsReview: false },
    select: { id: true, subject: true, type: true, answer: true, content: true, transcript: true, imageHash: true },
  });
  const docs = rows.flatMap((r) => {
    const c = contentOf(r);
    return c && plainText(c) ? [{ subject: r.subject, d: doc(r.id, c, r.type, r.answer) }] : [];
  });
  const out: Record<string, { id: string; kind: SimilarKind }[]> = {};
  const add = (a: string, b: string, kind: SimilarKind) => {
    const l = (out[a] ??= []);
    const at = l.findIndex((x) => x.id === b);
    if (at < 0) l.push({ id: b, kind });
    else if (kind === "same") l[at].kind = "same";
  };
  for (const [, group] of bySubject(docs)) {
    const ds = group.map((x) => x.d);
    for (const [id, hits] of findSimilar(ds, ds, { top: 20 })) for (const h of hits) add(id, h.id, h.kind);
  }
  // Kesilmiş sorular: aynı görsel
  const cut = rows.filter((r) => !r.content && r.imageHash.length > 1);
  for (let i = 0; i < cut.length; i++)
    for (let j = i + 1; j < cut.length; j++)
      if (hashDistance(cut[i].imageHash, cut[j].imageHash) <= IMAGE_SAME) {
        add(cut[i].id, cut[j].id, "same");
        add(cut[j].id, cut[i].id, "same");
      }
  return out;
}
