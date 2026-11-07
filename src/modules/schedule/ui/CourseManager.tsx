"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_KINDS, COURSE_KIND_KEYS } from "../labels";
import type { CourseRow } from "../types";

type Teacher = { id: string; name: string; role: string };
type Draft = { name: string; kind: string; teacherId: string; external: boolean };

const EMPTY: Draft = { name: "", kind: "SCHOOL", teacherId: "", external: false };

function hours(min: number) {
  return (min / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

/** Sınıfın dersleri: liste, düzenleme ve yeni ders. Telefonda tek sütun. */
export default function CourseManager({ classroomId, courses, teachers }: { classroomId: string; courses: CourseRow[]; teachers: Teacher[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<(Draft & { id: string }) | null>(null);
  const [add, setAdd] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "İşlem başarısız.");
      return false;
    }
    router.refresh();
    return true;
  }

  const form = (d: Draft, set: (d: Draft) => void, onSave: () => void, onCancel: () => void) => (
    <div className="space-y-2.5 bg-paper/60 px-3.5 py-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="label">Ders adı</label>
          <input className="input" value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} placeholder="ör. Fizik" autoFocus />
        </div>
        <div>
          <label className="label">Tür</label>
          <select className="input" value={d.kind} onChange={(e) => set({ ...d, kind: e.target.value })}>
            {COURSE_KIND_KEYS.map((k) => (
              <option key={k} value={k}>{COURSE_KINDS[k].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sorumlu</label>
          <select className="input" value={d.teacherId} onChange={(e) => set({ ...d, teacherId: e.target.value })}>
            <option value="">—</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.role === "MENTOR" ? " (etüt mesulü)" : ""}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={d.external} onChange={(e) => set({ ...d, external: e.target.checked })} />
          Başka kurumda alınıyor
        </label>
      </div>
      {d.external && <p className="text-[13px] text-lead">Bu dersin bilgilerini sorumlusu (genelde etüt mesulü) girer.</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !d.name.trim()} onClick={onSave}>Kaydet</button>
        <button className="btn text-lead" onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-rule/70 px-3.5 py-2.5">
        <h2 className="font-semibold">Dersler <span className="font-normal text-lead">({courses.length})</span></h2>
        {!add && (
          <button className="text-sm font-medium text-brand-600" onClick={() => { setAdd(EMPTY); setEdit(null); }}>+ Ders ekle</button>
        )}
      </div>
      {error && <p className="px-3.5 pt-2 text-sm text-red-600">{error}</p>}
      {add &&
        form(
          add,
          setAdd,
          async () => (await send("/api/kurum/dersler", "POST", { ...add, classroomId, teacherId: add.teacherId || null })) && setAdd(null),
          () => setAdd(null),
        )}
      <ul className="divide-y divide-rule/70">
        {courses.map((c) =>
          edit?.id === c.id ? (
            <li key={c.id}>
              {form(
                edit,
                (d) => setEdit({ ...d, id: c.id }),
                async () => (await send(`/api/kurum/dersler/${c.id}`, "PATCH", { ...edit, teacherId: edit.teacherId || null })) && setEdit(null),
                () => setEdit(null),
              )}
            </li>
          ) : (
            <li key={c.id}>
              <button
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-paper active:bg-paper"
                onClick={() => { setEdit({ id: c.id, name: c.name, kind: c.kind, teacherId: c.teacherId ?? "", external: c.external }); setAdd(null); }}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{c.name}</span>
                    <span className={`badge ${COURSE_KINDS[c.kind]?.cls ?? ""}`}>{COURSE_KINDS[c.kind]?.label ?? c.kind}</span>
                    {c.external && <span className="badge bg-zinc-100 text-zinc-700">Dışarıda</span>}
                  </span>
                  <span className="block text-[13px] text-lead">{c.teacherName ?? "Sorumlu yok"}</span>
                </span>
                <span className="shrink-0 text-right text-[13px] text-lead">
                  {c.slotCount ? <span className="num">{c.slotCount} saat · {hours(c.weeklyMinutes)} sa/hafta</span> : "Programda yok"}
                </span>
              </button>
            </li>
          ),
        )}
        {courses.length === 0 && !add && <li className="px-3.5 py-4 text-sm text-lead">Henüz ders yok. Ders programına eklenen dersler burada kendiliğinden görünür.</li>}
      </ul>
      {edit && (
        <div className="border-t border-rule/70 px-3.5 py-2 text-right">
          <button
            className="text-sm text-lead/70 hover:text-red-600"
            disabled={busy}
            onClick={() => confirm(`“${edit.name}” dersi silinsin mi?`) && send(`/api/kurum/dersler/${edit.id}`, "DELETE").then((ok) => ok && setEdit(null))}
          >
            Dersi sil
          </button>
        </div>
      )}
    </section>
  );
}
