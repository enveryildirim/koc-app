"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_KINDS } from "../calendar";

export type EventDraft = {
  id?: string;
  title: string;
  kind: string;
  startDate: string;
  endDate: string;
  classroomId: string;
  note: string;
  parentVisible: boolean;
};

/** Etkinlik ekleme / düzenleme penceresi. */
export default function EventForm({
  initial,
  classrooms,
  onClose,
}: {
  initial: EventDraft;
  classrooms: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  // Yönetici "velilere göster"i elle değiştirmediyse türün varsayılanını izle
  const [touched, setTouched] = useState(!!initial.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<EventDraft>) => setF({ ...f, ...p });

  async function send(method: "POST" | "PUT" | "DELETE") {
    if (method === "DELETE" && !confirm(`"${f.title}" silinsin mi?`)) return;
    setBusy(true);
    setError("");
    const url = f.id ? `/api/kurum/takvim/${f.id}` : "/api/kurum/takvim";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(f),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "İşlem başarısız.");
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{f.id ? "Etkinliği düzenle" : "Yeni etkinlik"}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Başlık</label>
            <input className="input" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="ör. Veli toplantısı" />
          </div>
          <div>
            <label className="label">Tür</label>
            <select
              className="input"
              value={f.kind}
              onChange={(e) => set({ kind: e.target.value, ...(touched ? {} : { parentVisible: EVENT_KINDS[e.target.value].parentDefault }) })}
            >
              {Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kimin için</label>
            <select className="input" value={f.classroomId} onChange={(e) => set({ classroomId: e.target.value })}>
              <option value="">Tüm kurum</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Başlangıç</label>
            <input
              type="date"
              className="input"
              value={f.startDate}
              onChange={(e) => set({ startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })}
            />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" className="input" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Not (isteğe bağlı)</label>
            <textarea className="input" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.parentVisible}
              onChange={(e) => {
                setTouched(true);
                set({ parentVisible: e.target.checked });
              }}
            />
            Velilere göster <span className="text-xs text-lead">(veli karnesinin &quot;Yaklaşanlar&quot; bölümünde, notuyla birlikte)</span>
          </label>
        </div>
        {f.kind === "HOLIDAY" && (
          <p className="mt-3 text-xs text-lead">Tatil günlerinde yoklama ekranı, ilgili sınıfların derslerini &quot;tatil&quot; olarak gösterir.</p>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {f.id && (
            <button className="btn-danger" disabled={busy} onClick={() => send("DELETE")}>Sil</button>
          )}
          <div className="flex-1" />
          <button className="btn-secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn-primary" disabled={busy} onClick={() => send(f.id ? "PUT" : "POST")}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}
