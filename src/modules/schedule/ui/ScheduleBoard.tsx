"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAYS, LESSON_TYPES } from "@/modules/schedule";
import { Opt, SlotRow, TYPE_STYLE } from "../types";

type Draft = Omit<SlotRow, "id" | "classroomName" | "teacherName"> & { id?: string };

export default function ScheduleBoard({
  slots,
  classrooms,
  teachers,
  view,
  defaults,
}: {
  slots: SlotRow[];
  classrooms: Opt[];
  teachers: (Opt & { branch: string })[];
  view: "sinif" | "ogretmen";
  /** Yeni ders formu için önceden seçili sınıf/öğretmen */
  defaults: { classroomId?: string; teacherId?: string };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const days = slots.some((s) => s.dayOfWeek === 7) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];

  function openNew(day: number) {
    setError("");
    const teacherId = defaults.teacherId ?? teachers[0]?.id ?? "";
    setDraft({
      classroomId: defaults.classroomId ?? classrooms[0]?.id ?? "",
      teacherId,
      subject: teachers.find((t) => t.id === teacherId)?.branch ?? "",
      lessonType: "GRUP",
      dayOfWeek: day,
      startTime: "16:00",
      endTime: "16:40",
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    const res = await fetch(draft.id ? `/api/kurum/program/${draft.id}` : "/api/kurum/program", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Kaydedilemedi.");
    setDraft(null);
    router.refresh();
  }

  async function remove() {
    if (!draft?.id || !confirm("Bu ders programdan silinsin mi? Geçmiş yoklamalar korunur.")) return;
    setBusy(true);
    await fetch(`/api/kurum/program/${draft.id}`, { method: "DELETE" });
    setBusy(false);
    setDraft(null);
    router.refresh();
  }

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {days.map((day) => {
          const list = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="card flex flex-col p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">{DAYS[day]}</h3>
                <span className="text-xs text-lead/70">{list.length} ders</span>
              </div>
              <div className="flex-1 space-y-2">
                {list.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setError("");
                      setDraft({ ...s });
                    }}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition hover:shadow ${TYPE_STYLE[s.lessonType] ?? TYPE_STYLE.GRUP}`}
                  >
                    <div className="num font-semibold">{s.startTime}–{s.endTime}</div>
                    <div className="mt-0.5 text-sm font-semibold">{s.subject}</div>
                    <div className="opacity-80">{view === "sinif" ? s.teacherName : `Sınıf ${s.classroomName}`}</div>
                    {s.lessonType !== "GRUP" && <div className="mt-0.5 font-medium">{LESSON_TYPES[s.lessonType]}</div>}
                  </button>
                ))}
                {list.length === 0 && <p className="py-4 text-center text-xs text-lead/70">Ders yok</p>}
              </div>
              <button className="mt-2 rounded-md py-1 text-xs font-medium text-brand-600 hover:bg-brand-50" onClick={() => openNew(day)}>
                + Ders ekle
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-lead">
        {Object.entries(LESSON_TYPES).map(([k, v]) => (
          <span key={k} className={`rounded border px-2 py-0.5 ${TYPE_STYLE[k]}`}>{v}</span>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{draft.id ? "Dersi düzenle" : "Yeni ders"}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sınıf</label>
                <select className="input" value={draft.classroomId} onChange={(e) => set({ classroomId: e.target.value })}>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Öğretmen</label>
                <select
                  className="input"
                  value={draft.teacherId}
                  onChange={(e) => {
                    const t = teachers.find((x) => x.id === e.target.value);
                    set({ teacherId: e.target.value, ...(draft.subject ? {} : { subject: t?.branch ?? "" }) });
                  }}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.branch})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Ders adı</label>
                <input className="input" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
              </div>
              <div>
                <label className="label">Tür</label>
                <select className="input" value={draft.lessonType} onChange={(e) => set({ lessonType: e.target.value })}>
                  {Object.entries(LESSON_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Gün</label>
                <select className="input" value={draft.dayOfWeek} onChange={(e) => set({ dayOfWeek: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>{DAYS[d]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Başlangıç</label>
                <input type="time" className="input" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
              </div>
              <div>
                <label className="label">Bitiş</label>
                <input type="time" className="input" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />
              </div>
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex items-center gap-2">
              {draft.id && (
                <button className="btn-danger" disabled={busy} onClick={remove}>Sil</button>
              )}
              <button className="btn-secondary ml-auto" onClick={() => setDraft(null)}>Vazgeç</button>
              <button className="btn-primary" disabled={busy || !teachers.length} onClick={save}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
            {!teachers.length && <p className="mt-2 text-xs text-amber-600">Önce menüdeki “Öğretmenler” sayfasından öğretmen ekleyin.</p>}
          </div>
        </div>
      )}
    </>
  );
}
