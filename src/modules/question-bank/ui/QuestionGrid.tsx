"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ANSWERS, answerLabel, BASIS, DIFFICULTY, isBasis, GRADES, OPTION_LETTERS, QUESTION_TYPES, SIMILAR_KINDS, type BankUsage, type QuestionContent, type QuestionPatch, type QuestionType, type SimilarKind } from "../index";
import { COGNITIVE_LEVELS } from "@/shared/cognitive";
import Drawer from "@/shared/ui/Drawer";
import QuestionView from "./QuestionView";

export type GridItem = {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  difficulty: number;
  level: string;
  answer: string;
  origin: string;
  page: number | null;
  source: { name: string } | null;
  type: string;
  /** Yazılan soruda içerik; kesilmiş soruda null (içerik görseldedir) */
  content: QuestionContent | null;
  hasImage: boolean;
  archived: boolean;
  /** Yapay zekâ ile eklendi, öğretmen henüz onaylamadı (havuzda ve sınav kurarken görünmez) */
  needsReview: boolean;
  /** Agent'ın emin olmadığı noktalar (yapay zekâ sorusunda; boş = not yok) */
  agentNote: string;
  /** Yapay zekâ sorusunun nasıl yapıldığı (BASIS); elle girilende boş */
  basis: string;
  /** Yapay zekâ sorusunda cevabın kaynağı: key (kaynağın anahtarı) | agent (agent çözdü) */
  answerBy: string;
  /** Bağlı müfredat satırının kazanımı (yoksa null) */
  outcome: { code: string; text: string; unit: string } | null;
  /** Çözüm / açıklama (boş = yazılmamış) */
  explanation: string;
  /** Kaynak notu (kitap / yayın / sayfa) */
  sourceNote: string;
};

const API = "/api/kurum/soru-havuzu/sorular";

/** Havuzdaki sorular: kart ızgarası, karttan cevap işaretleme (türüne göre), seçili sorularda toplu düzenleme / silme. */
export default function QuestionGrid({
  items,
  subjects,
  topics,
  usage = {},
  similar = {},
  archive = false,
  review = false,
  reviewAll,
}: {
  items: GridItem[];
  subjects: string[];
  topics: Record<string, string[]>;
  /** Sayfadaki soruların kullanım geçmişi (kullanılmamışlar yok) */
  usage?: Record<string, BankUsage>;
  /** Sayfadaki soruların benzer soru sayıları (benzeri olmayanlar yok) */
  similar?: Record<string, { same: number; sibling: number }>;
  /** Arşiv görünümü: toplu işlem "Arşivden çıkar" olur */
  archive?: boolean;
  /** Onay bekleyenler görünümü: toplu işlemlerin başında "Onayla" olur */
  review?: boolean;
  /** Onay görünümünde süzgece (ve seçili gruba) uyan bütün soruların kimlikleri (sayfasız): "tümünü onayla / sil" */
  reviewAll?: { ids: string[]; group: string | null };
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<string | null>(null);
  const shown = detail ? items.find((i) => i.id === detail) : undefined;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ subject: "", topic: "", grade: "", difficulty: "", level: "", answer: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(method: "PATCH" | "DELETE", ids: string[], set?: QuestionPatch) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, set }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: json.error ?? "İşlem yapılamadı." });
      return false;
    }
    router.refresh();
    return json as { updated?: number; skipped?: number };
  }

  async function applyBulk() {
    const set: QuestionPatch = {};
    if (bulk.subject.trim()) set.subject = bulk.subject.trim();
    if (bulk.topic.trim()) set.topic = bulk.topic.trim();
    if (bulk.grade) set.grade = bulk.grade;
    if (bulk.difficulty) set.difficulty = Number(bulk.difficulty);
    if (bulk.level) set.level = bulk.level;
    if (bulk.answer) set.answer = bulk.answer;
    if (!Object.keys(set).length) return setMsg({ ok: false, text: "Değiştirmek istediğiniz alanı doldurun." });
    const r = await send("PATCH", [...sel], set);
    if (r) {
      setMsg({ ok: true, text: r.skipped ? `${r.updated} soru güncellendi; ${r.skipped} sorunun türü bu cevaba uymadığı için cevabı değişmedi.` : `${r.updated} soru güncellendi.` });
      setBulk({ subject: "", topic: "", grade: "", difficulty: "", level: "", answer: "" });
    }
  }

  async function removeSelected() {
    const used = [...sel].filter((id) => usage[id]).length;
    const warn = used
      ? `\n\n${used} tanesi sınav ya da çalışma kağıdında kullanıldı; silinirse o kitapçıklarda yerleri boş kalır. Silmek yerine arşive kaldırabilirsiniz.`
      : "";
    if (!confirm(`${sel.size} soru havuzdan silinsin mi? Bu işlem geri alınamaz.${warn}`)) return;
    if (await send("DELETE", [...sel])) setSel(new Set());
  }

  /** Arşive kaldırma / arşivden çıkarma: soru silinmez, eski kitapçıklarda yerinde kalır. */
  async function setArchived(ids: string[], archived: boolean) {
    const r = await send("PATCH", ids, { archived });
    if (r) {
      setSel(new Set());
      setDetail(null);
      setMsg({ ok: true, text: archived ? `${ids.length} soru arşive kaldırıldı; havuzda ve sınav kurarken görünmez, eski kitapçıklarda yerinde kalır.` : `${ids.length} soru arşivden çıkarıldı.` });
    }
  }

  /** Onay: yapay zekâ ile eklenen soru havuza ve sınav kurma ekranına geçer. */
  async function approve(ids: string[]) {
    const r = await send("PATCH", ids, { approved: true });
    if (r) {
      setSel(new Set());
      setMsg({ ok: true, text: `${ids.length} soru onaylandı; artık havuzda ve sınav kurarken görünür.` });
    }
  }

  /** Listedeki (bütün sayfalar) onay bekleyenlerin tümü: onayla ya da sil. */
  async function allInList(action: "approve" | "delete") {
    const ids = reviewAll?.ids ?? [];
    if (!ids.length) return;
    if (action === "approve") {
      const risky = reviewAll?.group === "tekrar" || reviewAll?.group === "not" || reviewAll?.group === "cevap";
      if (!confirm(`Listedeki ${ids.length} soru onaylansın mı?${risky ? "\n\nBu gruptaki soruların her birinde incelenmesi gereken bir durum var." : ""}`)) return;
      await approve(ids);
    } else {
      if (!confirm(`Listedeki ${ids.length} soru silinsin mi? Bu işlem geri alınamaz.`)) return;
      const r = await send("DELETE", ids);
      if (r) {
        setSel(new Set());
        setMsg({ ok: true, text: `${ids.length} soru silindi.` });
      }
    }
  }

  async function removeOne(id: string) {
    if (!confirm("Bu soru silinsin mi? Bu işlem geri alınamaz.")) return;
    if (await send("DELETE", [id])) setMsg({ ok: true, text: "Soru silindi." });
  }

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = items.length > 0 && items.every((i) => sel.has(i.id));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(items.map((i) => i.id)))} />
          Bu sayfadakilerin tümünü seç
        </label>
        {sel.size > 0 && <span className="text-lead">{sel.size} soru seçili</span>}
        {review && reviewAll && reviewAll.ids.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className={reviewAll.group === "temiz" ? "btn-primary py-1" : "btn-secondary py-1"} disabled={busy} onClick={() => allInList("approve")}>
              Listedeki {reviewAll.ids.length} sorunun tümünü onayla
            </button>
            {reviewAll.group === "tekrar" && (
              <button type="button" className="btn-danger py-1" disabled={busy} onClick={() => allInList("delete")}>Listedeki {reviewAll.ids.length} soruyu sil</button>
            )}
          </span>
        )}
      </div>

      {sel.size > 0 && (
        <div className="card sticky top-14 z-20 mb-3 flex flex-wrap items-end gap-2 p-2.5 lg:top-2">
          <label className="w-36">
            <span className="text-xs text-lead">Ders</span>
            <input className="input" list="qg-subjects" value={bulk.subject} onChange={(e) => setBulk({ ...bulk, subject: e.target.value })} />
          </label>
          <label className="w-44">
            <span className="text-xs text-lead">Konu</span>
            <input className="input" list="qg-topics" value={bulk.topic} onChange={(e) => setBulk({ ...bulk, topic: e.target.value })} />
          </label>
          <label>
            <span className="text-xs text-lead">Düzey</span>
            <select className="input" value={bulk.grade} onChange={(e) => setBulk({ ...bulk, grade: e.target.value })}>
              <option value="">—</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-lead">Zorluk</span>
            <select className="input" value={bulk.difficulty} onChange={(e) => setBulk({ ...bulk, difficulty: e.target.value })}>
              <option value="">—</option>
              {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-lead">Bilişsel düzey</span>
            <select className="input" value={bulk.level} onChange={(e) => setBulk({ ...bulk, level: e.target.value })}>
              <option value="">—</option>
              {COGNITIVE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-lead" title="Yalnızca çoktan seçmeli sorulara uygulanır">Cevap (test)</span>
            <select className="input" value={bulk.answer} onChange={(e) => setBulk({ ...bulk, answer: e.target.value })}>
              <option value="">—</option>
              {ANSWERS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {review && <button className="btn-primary" disabled={busy} onClick={() => approve([...sel])}>Onayla</button>}
          <button className={review ? "btn-secondary" : "btn-primary"} disabled={busy} onClick={applyBulk}>Seçililere uygula</button>
          <button className="btn-secondary" disabled={busy} onClick={() => setArchived([...sel], !archive)}>{archive ? "Arşivden çıkar" : "Arşive kaldır"}</button>
          <button className="btn-danger" disabled={busy} onClick={removeSelected}>Sil</button>
          <button className="btn-secondary" onClick={() => setSel(new Set())}>Seçimi kaldır</button>
          <datalist id="qg-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          <datalist id="qg-topics">{(topics[bulk.subject] ?? Object.values(topics).flat()).map((s) => <option key={s} value={s} />)}</datalist>
        </div>
      )}
      {msg && <p className={`mb-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((q) => {
          const on = sel.has(q.id);
          return (
            <li key={q.id} className={`card flex flex-col overflow-hidden ${on ? "ring-2 ring-ink" : ""}`}>
              <div className="flex items-center gap-2 border-b border-rule px-2.5 py-1.5 text-[13px]">
                <input type="checkbox" checked={on} onChange={() => toggle(q.id)} aria-label="Soruyu seç" />
                {q.origin === "AI" && (
                  <span className="badge shrink-0 bg-mist text-graphite" title={`Yapay zekâ agent'ı ile (MCP) eklendi${isBasis(q.basis) ? `: ${BASIS[q.basis].hint.toLocaleLowerCase("tr-TR")}` : ""}`}>
                    YZ{isBasis(q.basis) ? ` · ${BASIS[q.basis].label}` : ""}
                  </span>
                )}
                {q.needsReview && q.basis === "transcribed" && q.answerBy === "agent" && (
                  <span className="badge shrink-0 bg-amber-100 text-amber-900" title="Kaynakta cevap anahtarı yoktu; cevabı agent çözdü. Onaylamadan önce cevabı kontrol edin.">Cevabı agent çözdü</span>
                )}
                <SimilarBadge s={similar[q.id]} onOpen={() => setDetail(q.id)} />
                {q.type !== "MC" && <span className="badge shrink-0 bg-mist text-graphite" title={QUESTION_TYPES[q.type as QuestionType]?.label}>{QUESTION_TYPES[q.type as QuestionType]?.short ?? q.type}</span>}
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{q.subject}</b>
                  {q.topic ? <span className="text-lead"> · {q.topic}</span> : <span className="text-lead/70"> · konu yok</span>}
                </span>
                {q.level && <span className="badge badge-plain ml-auto bg-mist text-lead" title="Bilişsel düzey">{q.level}</span>}
                <span className={`badge bg-mist text-graphite ${q.level ? "" : "ml-auto"}`}>{DIFFICULTY[q.difficulty]}</span>
              </div>
              {q.outcome && (q.outcome.code || q.outcome.text) && (
                <p className="truncate border-b border-rule/60 px-2.5 py-1 text-xs text-lead" title={[q.outcome.unit, q.outcome.code, q.outcome.text].filter(Boolean).join(" · ")}>
                  {q.outcome.code && <b className="mr-1 font-semibold text-graphite">{q.outcome.code}</b>}
                  {q.outcome.text || "Kazanım"}
                </p>
              )}
              {q.needsReview && q.agentNote && <AgentNote note={q.agentNote} className="border-b border-rule/60 px-2.5 py-1.5" />}
              {q.content ? (
                <div className="relative max-h-80 flex-1 overflow-hidden bg-white p-3 text-black">
                  <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? `${API}/${q.id}/gorsel` : null} answer={q.answer} />
                </div>
              ) : (
                <a href={`${API}/${q.id}/gorsel`} target="_blank" rel="noreferrer" className="block flex-1 bg-white p-2" title="Büyük aç">
                  {/* eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı route, next/image optimizasyonu kullanılmaz */}
                  <img src={`${API}/${q.id}/gorsel`} alt={`${q.subject} sorusu`} loading="lazy" className="mx-auto max-h-72 w-auto object-contain" />
                </a>
              )}
              <UsageLine q={q} u={usage[q.id]} onOpen={() => setDetail(q.id)} />
              <div className="flex items-center gap-2 border-t border-rule px-2.5 py-1.5">
                <AnswerControl q={q} busy={busy} onSet={(answer) => send("PATCH", [q.id], { answer })} />
                {/* Sağ grup daralmaz (düğmeler kesilmesin); uzun cevap solda kısalır, kaynak metni burada en fazla %60 yer kaplar */}
                <span className="ml-auto flex max-w-[60%] shrink-0 items-center gap-2 text-xs text-lead">
                  {q.explanation && (
                    <button type="button" onClick={() => setDetail(q.id)} className="badge shrink-0 bg-mist text-graphite hover:bg-rule" title="Çözümü göster">Çözümlü</button>
                  )}
                  <span className="truncate" title={[q.sourceNote, q.source ? `${q.source.name}${q.page ? `, s. ${q.page}` : ""}` : ""].filter(Boolean).join(" · ")}>
                    {[
                      q.grade ? (/^\d+$/.test(q.grade) ? `${q.grade}. sınıf` : q.grade) : "",
                      q.sourceNote || (q.content ? "" : q.source ? `${q.source.name}${q.page ? `, s. ${q.page}` : ""}` : "Kaynak silinmiş"),
                    ].filter(Boolean).join(" · ")}
                  </span>
                  {q.content && <Link href={`/kurum/soru-havuzu/yaz?id=${q.id}`} className="shrink-0 font-semibold text-graphite hover:underline">Düzenle</Link>}
                </span>
              </div>
              {q.needsReview && (
                <div className="flex items-center gap-2 border-t border-rule bg-mist/60 px-2.5 py-1.5 text-xs text-lead">
                  {similar[q.id]?.same ? (
                    <button type="button" onClick={() => setDetail(q.id)} className="text-left font-semibold text-amber-800 hover:underline">Havuzda aynısı var: karşılaştırın</button>
                  ) : (
                    <span>Onay bekliyor: onaylanana kadar havuzda ve sınav kurarken görünmez.</span>
                  )}
                  <button type="button" disabled={busy} onClick={() => removeOne(q.id)} className="ml-auto shrink-0 px-2 py-1 text-xs text-lead hover:text-red-700">Sil</button>
                  <button type="button" disabled={busy} onClick={() => approve([q.id])} className="btn-primary shrink-0 px-3 py-1 text-xs">Onayla</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Drawer open={!!shown} title="Soru ayrıntısı" onClose={() => setDetail(null)}>
        {shown && (
          <UsageDetail
            key={shown.id}
            q={shown}
            u={usage[shown.id]}
            busy={busy}
            onDifficulty={(d) => send("PATCH", [shown.id], { difficulty: d })}
            onArchive={() => setArchived([shown.id], !shown.archived)}
            onNotes={async (set) => {
              if (await send("PATCH", [shown.id], set)) setMsg({ ok: true, text: "Çözüm ve kaynak kaydedildi." });
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

/** Kart üzerindeki tek satırlık kullanım özeti; tıklanınca ayrıntı açılır. */
function UsageLine({ q, u, onOpen }: { q: GridItem; u?: BankUsage; onOpen: () => void }) {
  if (!u) return <p className="border-t border-rule px-2.5 py-1 text-xs text-lead/80">Hiç kullanılmadı</p>;
  const parts = [
    u.exams ? `${u.exams} sınav` : "",
    u.worksheets ? `${u.worksheets} çalışma kağıdı` : "",
    u.last ? `son ${fmtDay(u.last)}` : "",
    u.p !== null ? `%${u.p} doğru (${u.n} öğr.)` : "",
  ].filter(Boolean);
  const off = u.measured && u.measured !== q.difficulty;
  return (
    <button type="button" onClick={onOpen} className="block w-full border-t border-rule px-2.5 py-1 text-left text-xs text-lead hover:bg-mist/60" title="Kullanım geçmişini aç">
      <span className="block truncate">{parts.join(" · ")}</span>
      {(u.flag || off || u.classIds.length > 0) && (
        <span className="flex min-w-0 gap-2">
          {u.flag && <span className="shrink-0 font-semibold text-red-700">{u.flag}</span>}
          {!u.flag && off && <span className="shrink-0 text-amber-700">ölçülen: {lower(DIFFICULTY[u.measured!])}</span>}
          {u.classIds.length > 0 && <span className="truncate">Gören: {[...new Set(u.uses.flatMap((x) => x.classes))].sort((a, b) => a.localeCompare(b, "tr")).join(", ")}</span>}
        </span>
      )}
    </button>
  );
}

/** Yan panel: her kullanım (sınav / çalışma kağıdı, tarih, gören sınıflar, sonuç) ve ölçülen zorluk. */
function UsageDetail({
  q,
  u,
  busy,
  onDifficulty,
  onArchive,
  onNotes,
}: {
  q: GridItem;
  u?: BankUsage;
  busy: boolean;
  onDifficulty: (d: number) => void;
  onArchive: () => void;
  onNotes: (set: { explanation: string; sourceNote: string }) => void;
}) {
  const title = q.content?.stem.split("\n")[0] || `${q.subject}${q.topic ? ` · ${q.topic}` : ""}`;
  const [explanation, setExplanation] = useState(q.explanation);
  const [sourceNote, setSourceNote] = useState(q.sourceNote);
  const dirty = explanation.trim() !== q.explanation || sourceNote.trim() !== q.sourceNote;
  return (
    <div className="space-y-4 text-sm">
      <p dir="auto" className="line-clamp-3 text-lead">{title}</p>
      {q.agentNote && <AgentNote note={q.agentNote} className="rounded-md px-3 py-2" />}
      <div className="space-y-2 rounded-md ring-1 ring-rule px-3 py-2.5">
        <label className="block">
          <span className="text-xs text-lead">Çözüm / açıklama</span>
          <textarea dir="auto" className="input min-h-20 resize-y" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Kitapçıkta “Çözümler” sayfasına basılır." />
        </label>
        <label className="block">
          <span className="text-xs text-lead">Kaynak notu</span>
          <input className="input" maxLength={200} value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder={q.source ? `Ör. ${q.source.name}${q.page ? `, s. ${q.page}` : ""}` : "Ör. X Yayınları, s. 42"} />
        </label>
        <button type="button" className="btn-primary py-1" disabled={busy || !dirty} onClick={() => onNotes({ explanation, sourceNote })}>Kaydet</button>
      </div>
      {q.content && <SimilarList id={q.id} />}
      <h3 className="text-[13px] font-semibold">Kullanım geçmişi</h3>
      {q.outcome && (q.outcome.code || q.outcome.text) && (
        <p className="text-[13px]">
          <span className="text-lead">Kazanım: </span>
          {q.outcome.code && <b>{q.outcome.code} </b>}
          {q.outcome.text}
        </p>
      )}
      {!u ? (
        <p>Bu soru henüz hiçbir sınavda ya da çalışma kağıdında kullanılmadı.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span><b className="num">{u.exams}</b> sınav</span>
            <span><b className="num">{u.worksheets}</b> çalışma kağıdı</span>
            {u.p !== null && <span><b className="num">%{u.p}</b> doğru · <span className="num">{u.n}</span> öğrenci</span>}
          </div>
          <div className="rounded-md bg-mist/60 px-3 py-2">
            <p>
              Girilen zorluk: <b>{DIFFICULTY[q.difficulty]}</b>
              {u.measured ? (
                <> · sonuçlara göre: <b>{DIFFICULTY[u.measured]}</b></>
              ) : (
                <span className="text-lead"> · ölçülen zorluk için en az 20 öğrencinin sonucu gerekir</span>
              )}
            </p>
            {u.measured && u.measured !== q.difficulty && (
              <button type="button" className="btn-secondary mt-2 py-1" disabled={busy} onClick={() => onDifficulty(u.measured!)}>
                Zorluğu “{DIFFICULTY[u.measured]}” yap
              </button>
            )}
            {u.flag && <p className="mt-1 font-semibold text-red-700">{u.flag} (son sınava göre). Soruyu ve cevap anahtarını kontrol edin.</p>}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-lead">
                <th className="py-1 font-normal">Sınav</th>
                <th className="py-1 font-normal">Gören</th>
                <th className="py-1 text-right font-normal">Sonuç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {u.uses.map((x, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1.5 pr-2">
                    <Link href={`/kurum/denemeler/${x.examId}`} className="font-semibold text-graphite hover:underline">{x.name}</Link>
                    <span className="block text-xs text-lead">{fmtDay(x.date)}{x.worksheet ? " · çalışma kağıdı" : ""}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-lead">{x.classes.join(", ") || "—"}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {x.p !== null ? <>%{x.p} <span className="text-xs text-lead">({x.n})</span></> : <span className="text-xs text-lead">{x.worksheet ? "puanlanmaz" : "sonuç yok"}</span>}
                    {x.flag && <span className="block text-xs text-red-700">{x.flag}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-lead">Gören sınıf: derse bağlı sınavda dersin sınıfı, ayrıca sonucu okunan öğrencilerin sınıfları. Derse bağlanmamış çalışma kağıdının kime dağıtıldığı bilinmez.</p>
        </>
      )}
      <div className="border-t border-rule pt-3">
        <button type="button" className="btn-secondary" disabled={busy} onClick={onArchive}>{q.archived ? "Arşivden çıkar" : "Arşive kaldır"}</button>
        <p className="mt-1 text-xs text-lead">
          {q.archived ? "Arşivdeki soru havuzda ve sınav kurarken görünmez." : "Arşivdeki soru silinmez: havuzda ve sınav kurarken görünmez, eski kitapçıklarda yerinde kalır."}
        </p>
      </div>
    </div>
  );
}

/** Yapay zekâ agent'ının notu: soruyu yazarken emin olmadığı noktalar. */
function AgentNote({ note, className = "" }: { note: string; className?: string }) {
  return (
    <p dir="auto" className={`whitespace-pre-line bg-amber-50 text-xs text-amber-900 ${className}`}>
      <b className="font-semibold">Agent notu: </b>
      {note}
    </p>
  );
}

/** Kart altındaki cevap: test ve D/Y'de tıklanır; boşluk doldurma ve açık uçluda yazılan cevap gösterilir (Düzenle ile değişir). */
function AnswerControl({ q, busy, onSet }: { q: GridItem; busy: boolean; onSet: (a: string) => void }) {
  const pill = (on: boolean) => `rounded-full border text-[11px] font-semibold ${on ? "border-graphite bg-graphite text-white" : "border-ink/40 text-lead hover:border-graphite"}`;
  if (q.type === "TF")
    return (
      <div className="flex gap-0.5" role="group" aria-label="Doğru cevap">
        {(["D", "Y"] as const).map((v) => (
          <button key={v} type="button" disabled={busy} aria-pressed={q.answer === v} onClick={() => onSet(q.answer === v ? "" : v)} className={`h-6 px-2 ${pill(q.answer === v)}`}>
            {answerLabel("TF", v)}
          </button>
        ))}
      </div>
    );
  if (q.type === "FILL" || q.type === "OPEN")
    return q.answer ? (
      <span dir="auto" className="min-w-0 truncate text-xs" title={answerLabel(q.type, q.answer)}>Cevap: {answerLabel(q.type, q.answer)}</span>
    ) : (
      <span className={`text-xs ${q.type === "FILL" ? "text-red-700" : "text-lead"}`}>{q.type === "FILL" ? "Cevap yok" : "Örnek cevap yok"}</span>
    );
  const letters = q.content?.options ? OPTION_LETTERS.slice(0, q.content.options.length) : ANSWERS;
  return (
    <div className="flex gap-0.5" role="group" aria-label="Doğru cevap">
      {letters.map((a) => (
        <button key={a} type="button" disabled={busy} aria-pressed={q.answer === a} onClick={() => onSet(q.answer === a ? "" : a)} className={`size-6 ${pill(q.answer === a)}`}>
          {a}
        </button>
      ))}
    </div>
  );
}

/** Kart rozeti: havuzda aynısı (önce) ya da benzeri var; tıklanınca ayrıntı paneli açılır. */
function SimilarBadge({ s, onOpen }: { s?: { same: number; sibling: number }; onOpen: () => void }) {
  if (!s || (!s.same && !s.sibling)) return null;
  const same = s.same > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`badge shrink-0 ${same ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-mist text-graphite hover:bg-rule"}`}
      title={same ? `Olası tekrar. ${SIMILAR_KINDS.same.hint}` : SIMILAR_KINDS.sibling.hint}
    >
      {same ? "Aynısı var" : `Benzeri var${s.sibling > 1 ? ` (${s.sibling})` : ""}`}
    </button>
  );
}

type SimilarRow = {
  id: string;
  kind: SimilarKind;
  stem: string;
  options?: string[];
  answer: string;
  type: string;
  topic: string;
  grade: string;
  hasImage: boolean;
  pending: boolean;
  archived: boolean;
};

/** Ayrıntı panelinde benzer sorular (açılınca yüklenir). */
function SimilarList({ id }: { id: string }) {
  const [rows, setRows] = useState<SimilarRow[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`${API}/${id}/benzer`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => live && setRows(j.similar ?? []))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [id]);
  if (err) return <p className="text-xs text-red-700">Benzer sorular yüklenemedi.</p>;
  if (!rows) return <p className="text-xs text-lead">Benzer sorular aranıyor…</p>;
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold">Benzer sorular</h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md ring-1 ring-rule">
            <div className="flex items-center gap-2 border-b border-rule/60 px-2.5 py-1 text-xs text-lead">
              <span className={`badge shrink-0 ${r.kind === "same" ? "bg-amber-100 text-amber-900" : "bg-mist text-graphite"}`} title={SIMILAR_KINDS[r.kind].hint}>{SIMILAR_KINDS[r.kind].label}</span>
              {r.pending && <span>onay bekliyor</span>}
              {r.archived && <span>arşivde</span>}
              <span className="ml-auto truncate">{[r.topic, r.grade ? (/^\d+$/.test(r.grade) ? `${r.grade}. sınıf` : r.grade) : ""].filter(Boolean).join(" · ")}</span>
              <Link href={`/kurum/soru-havuzu/yaz?id=${r.id}`} className="shrink-0 font-semibold text-graphite hover:underline">Düzenle</Link>
            </div>
            <div className="max-h-48 overflow-hidden bg-white p-2.5 text-black">
              <QuestionView type={r.type} content={{ stem: r.stem, options: r.options }} imageSrc={r.hasImage ? `${API}/${r.id}/gorsel` : null} answer={r.answer} compact />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-lead">Aynı soru: olası tekrar, birini silin ya da arşive kaldırın. Benzer soru: aynı kalıp, başka sayılar; aynı denemede birlikte kullanmayın.</p>
    </div>
  );
}
