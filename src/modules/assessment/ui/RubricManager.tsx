"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_KINDS, COURSE_KIND_KEYS } from "@/modules/schedule";
import { RUBRIC_PRESETS, maxTotalOf, type Criterion } from "../index";

type Rubric = { id: string; name: string; kind: string; criteria: Criterion[] };
type Draft = { name: string; kind: string; criteria: { name: string; max: string }[] };

const toDraft = (r?: { name: string; kind: string; criteria: Criterion[] }): Draft =>
  r ? { name: r.name, kind: r.kind, criteria: r.criteria.map((c) => ({ name: c.name, max: String(c.max) })) } : { name: "", kind: "", criteria: [{ name: "", max: "" }] };

/** Puan cetvelleri (yönetici): liste, düzenleme, hazır örneklerden ekleme. */
export default function RubricManager({ rubrics }: { rubrics: Rubric[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: string | null; d: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const missingPresets = RUBRIC_PRESETS.filter((p) => !rubrics.some((r) => r.name === p.name));

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "İşlem başarısız.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveDraft() {
    if (!edit) return;
    const body = { name: edit.d.name, kind: edit.d.kind, criteria: edit.d.criteria.map((c) => ({ name: c.name, max: Number(c.max) })) };
    const ok = edit.id ? await send(`/api/kurum/puan-cetvelleri/${edit.id}`, "PUT", body) : await send("/api/kurum/puan-cetvelleri", "POST", body);
    if (ok) setEdit(null);
  }

  const setD = (d: Draft) => setEdit((e) => (e ? { ...e, d } : e));

  const form = edit && (
    <div className="space-y-3 bg-paper/60 p-3.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="label">Cetvel adı</label>
          <input className="input" value={edit.d.name} onChange={(e) => setD({ ...edit.d, name: e.target.value })} placeholder="ör. Kur'an okuma" />
        </div>
        <div>
          <label className="label">Önerildiği ders türü</label>
          <select className="input" value={edit.d.kind} onChange={(e) => setD({ ...edit.d, kind: e.target.value })}>
            <option value="">Hepsi</option>
            {COURSE_KIND_KEYS.map((k) => (
              <option key={k} value={k}>{COURSE_KINDS[k].label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Kriterler ve en yüksek puan</span>
        <div className="space-y-1.5">
          {edit.d.criteria.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" value={c.name} placeholder="Kriter" onChange={(e) => setD({ ...edit.d, criteria: edit.d.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input className="input num w-20" inputMode="numeric" value={c.max} placeholder="Puan" onChange={(e) => setD({ ...edit.d, criteria: edit.d.criteria.map((x, j) => (j === i ? { ...x, max: e.target.value.replace(/\D/g, "") } : x)) })} />
              <button className="px-1 text-lead/70 hover:text-red-600" aria-label="Kriteri sil" disabled={edit.d.criteria.length === 1} onClick={() => setD({ ...edit.d, criteria: edit.d.criteria.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          {edit.d.criteria.length < 8 ? (
            <button className="font-medium text-brand-600" onClick={() => setD({ ...edit.d, criteria: [...edit.d.criteria, { name: "", max: "" }] })}>+ Kriter</button>
          ) : <span />}
          <span className="text-lead">Toplam <span className="num font-semibold text-graphite">{edit.d.criteria.reduce((s, c) => s + (Number(c.max) || 0), 0)}</span> puan</span>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={saveDraft}>Kaydet</button>
        <button className="btn text-lead" onClick={() => { setEdit(null); setError(""); }}>Vazgeç</button>
        {edit.id && (
          <button
            className="ml-auto text-sm text-lead/70 hover:text-red-600"
            disabled={busy}
            onClick={() => confirm("Cetvel silinsin mi? Daha önce açılmış değerlendirmeler etkilenmez.") && send(`/api/kurum/puan-cetvelleri/${edit.id}`, "DELETE").then((ok) => ok && setEdit(null))}
          >
            Sil
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
      <section className="card">
        <div className="flex items-center justify-between border-b border-rule/70 px-3.5 py-2.5">
          <h2 className="font-semibold">Puan cetvelleri <span className="font-normal text-lead">({rubrics.length})</span></h2>
          {!edit && <button className="text-sm font-medium text-brand-600" onClick={() => setEdit({ id: null, d: toDraft() })}>+ Yeni cetvel</button>}
        </div>
        {edit && !edit.id && form}
        <ul className="divide-y divide-rule/70">
          {rubrics.map((r) =>
            edit?.id === r.id ? (
              <li key={r.id}>{form}</li>
            ) : (
              <li key={r.id}>
                <button className="w-full px-3.5 py-2.5 text-left hover:bg-paper" onClick={() => setEdit({ id: r.id, d: toDraft(r) })}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{r.name}</span>
                    {r.kind && <span className={`badge ${COURSE_KINDS[r.kind]?.cls ?? ""}`}>{COURSE_KINDS[r.kind]?.label}</span>}
                    <span className="num ml-auto text-[13px] text-lead">{maxTotalOf(r.criteria)} puan</span>
                  </span>
                  <span className="block text-[13px] text-lead">{r.criteria.map((c) => `${c.name} ${c.max}`).join(" · ")}</span>
                </button>
              </li>
            ),
          )}
          {rubrics.length === 0 && !edit && <li className="px-3.5 py-4 text-sm text-lead">Henüz cetvel yok. Sağdaki hazır örneklerden başlayabilirsiniz.</li>}
        </ul>
      </section>
      {missingPresets.length > 0 && (
        <aside className="card p-3.5">
          <h3 className="font-semibold">Hazır örnekler</h3>
          <p className="mb-2 text-[13px] text-lead">Tek dokunuşla ekleyin, sonra kurumunuza göre değiştirin.</p>
          <ul className="space-y-1.5">
            {missingPresets.map((p) => (
              <li key={p.name}>
                <button className="btn-secondary w-full justify-between" disabled={busy} onClick={() => send("/api/kurum/puan-cetvelleri", "POST", p)}>
                  <span>{p.name}</span>
                  <span className="num text-[12.5px] font-normal text-lead">{maxTotalOf(p.criteria)} puan</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
