"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ANSWERS, answerLabel, DIFFICULTY, GRADES, OPTION_LETTERS, QUESTION_TYPES, type QuestionContent, type QuestionPatch, type QuestionType } from "../index";
import { COGNITIVE_LEVELS } from "@/shared/cognitive";
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
  usedCount: number;
  page: number | null;
  source: { name: string } | null;
  type: string;
  /** Yazılan soruda içerik; kesilmiş soruda null (içerik görseldedir) */
  content: QuestionContent | null;
  hasImage: boolean;
};

const API = "/api/kurum/soru-havuzu/sorular";

/** Havuzdaki sorular: kart ızgarası, karttan cevap işaretleme (türüne göre), seçili sorularda toplu düzenleme / silme. */
export default function QuestionGrid({ items, subjects, topics }: { items: GridItem[]; subjects: string[]; topics: Record<string, string[]> }) {
  const router = useRouter();
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
    if (!confirm(`${sel.size} soru havuzdan silinsin mi? Bu işlem geri alınamaz.`)) return;
    if (await send("DELETE", [...sel])) setSel(new Set());
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
          <button className="btn-primary" disabled={busy} onClick={applyBulk}>Seçililere uygula</button>
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
                {q.type !== "MC" && <span className="badge shrink-0 bg-mist text-graphite" title={QUESTION_TYPES[q.type as QuestionType]?.label}>{QUESTION_TYPES[q.type as QuestionType]?.short ?? q.type}</span>}
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{q.subject}</b>
                  {q.topic ? <span className="text-lead"> · {q.topic}</span> : <span className="text-lead/70"> · konu yok</span>}
                </span>
                {q.level && <span className="badge badge-plain ml-auto bg-mist text-lead" title="Bilişsel düzey">{q.level}</span>}
                <span className={`badge bg-mist text-graphite ${q.level ? "" : "ml-auto"}`}>{DIFFICULTY[q.difficulty]}</span>
              </div>
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
              <div className="flex items-center gap-2 border-t border-rule px-2.5 py-1.5">
                <AnswerControl q={q} busy={busy} onSet={(answer) => send("PATCH", [q.id], { answer })} />
                <span className="ml-auto flex min-w-0 items-center gap-2 text-xs text-lead">
                  <span className="truncate" title={q.source?.name}>
                    {q.grade && <>{/^\d+$/.test(q.grade) ? `${q.grade}. sınıf` : q.grade}{q.content ? "" : " · "}</>}
                    {q.content ? "" : q.source ? `${q.source.name}${q.page ? `, s. ${q.page}` : ""}` : "Kaynak silinmiş"}
                  </span>
                  {q.content && <Link href={`/kurum/soru-havuzu/yaz?id=${q.id}`} className="shrink-0 font-semibold text-graphite hover:underline">Düzenle</Link>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
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
