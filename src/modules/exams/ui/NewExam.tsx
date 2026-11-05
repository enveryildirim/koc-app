"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAM_TYPES } from "../domain";

export default function NewExam() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("LGS");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [booklets, setBooklets] = useState(2);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/kurum/denemeler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, date, booklets }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    router.push(`/kurum/denemeler/${json.id}?tab=anahtar`);
  }

  const t = EXAM_TYPES[type];
  return (
    <form onSubmit={submit} className="card h-fit space-y-3 p-5">
      <h2 className="font-semibold">Yeni deneme</h2>
      <div>
        <label className="label">Sınav adı</label>
        <input className="input" placeholder="ör. LGS Deneme 4" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tür</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(EXAM_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tarih</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-lead">
        {t.sections.map((s) => `${s.name} (${s.count})`).join(" · ")} — {t.choices} şık
        {t.wrongPer ? `, ${t.wrongPer} yanlış 1 doğruyu götürür` : ""}. Bölümleri sonraki adımda değiştirebilirsiniz.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Kitapçık</span>
        <select className="input w-auto" value={booklets} onChange={(e) => setBooklets(Number(e.target.value))}>
            <option value={1}>Tek kitapçık</option>
            <option value={2}>A, B</option>
            <option value={3}>A, B, C</option>
            <option value={4}>A, B, C, D</option>
          </select>
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>Oluştur ve cevap anahtarını gir</button>
    </form>
  );
}
