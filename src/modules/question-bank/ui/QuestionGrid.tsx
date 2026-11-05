"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANSWERS, DIFFICULTY, GRADES, type QuestionPatch } from "../index";
import { COGNITIVE_LEVELS } from "@/shared/cognitive";

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
};

const API = "/api/kurum/soru-havuzu/sorular";

/** Havuzdaki sorular: kart ızgarası, karttan cevap işaretleme, seçili sorularda toplu düzenleme / silme. */
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
    return true;
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
    if (await send("PATCH", [...sel], set)) {
      setMsg({ ok: true, text: `${sel.size} soru güncellendi.` });
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
            <span className="text-xs text-lead">Cevap</span>
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
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{q.subject}</b>
                  {q.topic ? <span className="text-lead"> · {q.topic}</span> : <span className="text-lead/70"> · konu yok</span>}
                </span>
                {q.level && <span className="badge badge-plain ml-auto bg-mist text-lead" title="Bilişsel düzey">{q.level}</span>}
                <span className={`badge bg-mist text-graphite ${q.level ? "" : "ml-auto"}`}>{DIFFICULTY[q.difficulty]}</span>
              </div>
              <a href={`${API}/${q.id}/gorsel`} target="_blank" rel="noreferrer" className="block flex-1 bg-white p-2" title="Büyük aç">
                {/* eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı route, next/image optimizasyonu kullanılmaz */}
                <img src={`${API}/${q.id}/gorsel`} alt={`${q.subject} sorusu`} loading="lazy" className="mx-auto max-h-72 w-auto object-contain" />
              </a>
              <div className="flex items-center gap-2 border-t border-rule px-2.5 py-1.5">
                <div className="flex gap-0.5" role="group" aria-label="Doğru cevap">
                  {ANSWERS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      disabled={busy}
                      aria-pressed={q.answer === a}
                      onClick={() => send("PATCH", [q.id], { answer: q.answer === a ? "" : a })}
                      className={`size-6 rounded-full border text-[11px] font-semibold ${q.answer === a ? "border-graphite bg-graphite text-white" : "border-ink/40 text-lead hover:border-graphite"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <span className="ml-auto truncate text-xs text-lead" title={q.source?.name}>
                  {q.grade && <>{q.grade} · </>}
                  {q.source ? `${q.source.name}${q.page ? `, s. ${q.page}` : ""}` : "Kaynak silinmiş"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
