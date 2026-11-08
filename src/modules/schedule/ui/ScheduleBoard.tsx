"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DAYS, DAYS_SHORT, LESSON_TYPES, teacherSub } from "@/modules/schedule";
import { Opt, SlotRow, TYPE_STYLE } from "../types";

/**
 * `days`: seçili günler. Yenide aynı saat her güne eklenir. Düzenlemede açılan satırın serisinin günleriyle başlar
 * (`seriesDays`); değişiklik seçili günlerin hepsine uygulanır, seçimden çıkan günlerin satırı silinir.
 */
type Draft = Omit<SlotRow, "id" | "classroomName" | "teacherName"> & { id?: string; days?: number[]; seriesDays?: number[] };

/** Aynı dersin başka günlerdeki aynı saati mi (sınıf, ders, öğretmen, tür, saat aynı). Sunucudaki `slotSeries` ile aynı kural. */
const sameSeries = (a: SlotRow, b: SlotRow) =>
  a.classroomId === b.classroomId &&
  a.teacherId === b.teacherId &&
  a.lessonType === b.lessonType &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  (a.courseId ? a.courseId === b.courseId : a.subject === b.subject);
/** Sınıfın dersi: programa yalnızca bunlardan biri eklenir (ders Yönetim → Dersler'de açılır). */
type CourseOpt = { id: string; classroomId: string; name: string; kind: string; teacherId: string | null };

export default function ScheduleBoard({
  slots,
  classrooms,
  teachers,
  courses,
  view,
  defaults,
  clash = {},
}: {
  slots: SlotRow[];
  classrooms: Opt[];
  courses: CourseOpt[];
  teachers: (Opt & { branch: string; role: string })[];
  view: "sinif" | "ogretmen";
  /** Yeni ders formu için önceden seçili sınıf/öğretmen */
  defaults: { classroomId?: string; teacherId?: string };
  /** Çakışan program satırları: kesin çakışma (hard) ya da uyarı (soft) */
  clash?: Record<string, "hard" | "soft">;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  /** Sunucunun onay istediği uyarı (ör. ortak öğrenciler aynı saatte başka derste) */
  const [warn, setWarn] = useState("");
  const [busy, setBusy] = useState(false);

  const days = slots.some((s) => s.dayOfWeek === 7) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];

  const coursesOf = (classroomId: string) => courses.filter((c) => c.classroomId === classroomId);
  /** Ders seçilince: adı, türü (etüt dersi → Etüt) ve sınıf görünümünde öğretmeni dersin sorumlusundan gelir. */
  const fromCourse = (c: CourseOpt | undefined, teacherId: string): Partial<Draft> => ({
    courseId: c?.id ?? null,
    subject: c?.name ?? "",
    lessonType: c?.kind === "STUDY" ? "ETUT" : "GRUP",
    teacherId: view === "ogretmen" ? teacherId : c?.teacherId ?? teacherId,
  });
  /** Sınıfın ilk dersi; öğretmen görünümünde önce o öğretmenin dersi. */
  const firstCourse = (classroomId: string) => {
    const list = coursesOf(classroomId);
    return (defaults.teacherId && list.find((c) => c.teacherId === defaults.teacherId)) || list[0];
  };

  function openNew(day: number) {
    setError("");
    setWarn("");
    const classroomId = defaults.classroomId ?? classrooms[0]?.id ?? "";
    const teacherId = defaults.teacherId ?? teachers[0]?.id ?? "";
    setDraft({
      classroomId,
      teacherId,
      courseId: null,
      subject: "",
      lessonType: "GRUP",
      ...fromCourse(firstCourse(classroomId), teacherId),
      dayOfWeek: day,
      days: [day],
      startTime: "16:00",
      endTime: "16:40",
    });
  }

  async function save(confirm = false) {
    if (!draft) return;
    setBusy(true);
    setError("");
    setWarn("");
    const res = await fetch(draft.id ? `/api/kurum/program/${draft.id}` : "/api/kurum/program", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, dayOfWeeks: draft.days ?? [draft.dayOfWeek], confirm }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok && json.confirm) return setWarn(json.error);
    if (!res.ok) return setError(json.error ?? "Kaydedilemedi.");
    setDraft(null);
    router.refresh();
  }

  /** Yalnızca açılan günün ders saatini siler (serinin öbür günleri kalır). */
  async function remove() {
    if (!draft?.id || !confirm(`${DAYS[draft.dayOfWeek]} günündeki bu ders saati programdan silinsin mi? Ders ve geçmiş yoklamalar korunur.`)) return;
    setBusy(true);
    await fetch(`/api/kurum/program/${draft.id}`, { method: "DELETE" });
    setBusy(false);
    setDraft(null);
    router.refresh();
  }

  /** Düzenlemede seçimden çıkarılan (kaydedince silinecek) günler */
  const removedDays = draft?.id ? (draft.seriesDays ?? []).filter((d) => !draft.days?.includes(d)) : [];

  const set = (p: Partial<Draft>) => {
    setWarn("");
    setDraft((d) => (d ? { ...d, ...p } : d));
  };

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
                      setWarn("");
                      const seriesDays = [...new Set(slots.filter((x) => sameSeries(x, s)).map((x) => x.dayOfWeek))].sort((a, b) => a - b);
                      setDraft({ ...s, days: seriesDays, seriesDays });
                    }}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition hover:shadow ${TYPE_STYLE[s.lessonType] ?? TYPE_STYLE.GRUP} ${clash[s.id] === "hard" ? "ring-2 ring-red-500" : clash[s.id] === "soft" ? "ring-2 ring-amber-400" : ""}`}
                  >
                    {clash[s.id] && (
                      <div className={`mb-0.5 font-semibold ${clash[s.id] === "hard" ? "text-red-700" : "text-amber-700"}`}>
                        {clash[s.id] === "hard" ? "Çakışma" : "Uyarı"}
                      </div>
                    )}
                    <div className="num font-semibold">{s.startTime}–{s.endTime}</div>
                    <div className="mt-0.5 text-sm font-semibold">{s.subject}</div>
                    <div className="opacity-80">{view === "sinif" ? s.teacherName : `Sınıf ${s.classroomName}`}</div>
                    {s.lessonType !== "GRUP" && <div className="mt-0.5 font-medium">{LESSON_TYPES[s.lessonType]}</div>}
                  </button>
                ))}
                {list.length === 0 && <p className="py-4 text-center text-xs text-lead/70">Ders yok</p>}
              </div>
              <button className="mt-2 rounded-md py-1 text-xs font-medium text-brand-600 hover:bg-brand-50" onClick={() => openNew(day)} aria-label={`${DAYS[day]} gününe ders saati ekle`}>
                + Saat ekle
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
            <h2 className="text-lg font-bold">{draft.id ? "Ders saatini düzenle" : "Programa ders saati ekle"}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sınıf</label>
                <select
                  className="input"
                  value={draft.classroomId}
                  onChange={(e) => set({ classroomId: e.target.value, ...fromCourse(firstCourse(e.target.value), draft.teacherId) })}
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Ders</label>
                {coursesOf(draft.classroomId).length ? (
                  <select
                    className="input"
                    value={draft.courseId ?? ""}
                    onChange={(e) => set(fromCourse(courses.find((c) => c.id === e.target.value), draft.teacherId))}
                  >
                    {!draft.courseId && <option value="">— Ders seçin —</option>}
                    {coursesOf(draft.classroomId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="pt-2 text-sm text-amber-700">Bu sınıfın dersi yok.</p>
                )}
              </div>
              <p className="col-span-2 -mt-1 text-[12.5px] text-lead">
                Ders listede yok mu?{" "}
                <Link href={`/kurum/dersler?sinif=${draft.classroomId}&yeni=1`} className="font-medium text-brand-600 hover:underline">
                  Dersler sayfasında ekleyin
                </Link>
                ; programa oradaki dersler eklenir.
              </p>
              <div className="col-span-2">
                <label className="label">Öğretmen</label>
                <select className="input" value={draft.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({teacherSub(t)})</option>
                  ))}
                </select>
              </div>
              <fieldset className="col-span-2">
                  <legend className="label">Günler</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const on = draft.days?.includes(d) ?? false;
                      return (
                        <label key={d} title={DAYS[d]} className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 ${on ? "bg-graphite text-white ring-graphite" : "bg-surface ring-rule"}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => set({ days: on ? (draft.days ?? []).filter((x) => x !== d) : [...(draft.days ?? []), d].sort((a, b) => a - b) })}
                          />
                          {DAYS_SHORT[d]}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[12.5px] text-lead">
                    {draft.id
                      ? (draft.seriesDays?.length ?? 0) > 1
                        ? `Bu ders saati ${draft.seriesDays!.map((d) => DAYS_SHORT[d]).join(", ")} günlerinde var; değişiklik seçili günlerin hepsine uygulanır.`
                        : "Başka gün seçerseniz aynı saat o güne de eklenir."
                      : "Aynı saat seçilen her güne eklenir."}
                  </p>
                  {removedDays.length > 0 && (
                    <p className="mt-1 text-[12.5px] font-medium text-amber-700">
                      Silinecek: {removedDays.map((d) => DAYS[d]).join(", ")} (seçimden çıkardınız).
                    </p>
                  )}
              </fieldset>
              <div className="col-span-2">
                <label className="label">Tür</label>
                <select className="input" value={draft.lessonType} onChange={(e) => set({ lessonType: e.target.value })}>
                  {Object.entries(LESSON_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
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
            {warn && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p>{warn}</p>
                <button className="btn-secondary mt-2 py-1" disabled={busy} onClick={() => save(true)}>Yine de kaydet</button>
              </div>
            )}
            <div className="mt-5 flex items-center gap-2">
              {draft.id && (
                <button className="btn-danger" disabled={busy} onClick={remove}>
                  {(draft.seriesDays?.length ?? 0) > 1 ? `${DAYS_SHORT[draft.dayOfWeek]} gününü sil` : "Sil"}
                </button>
              )}
              <button className="btn-secondary ml-auto" onClick={() => setDraft(null)}>Vazgeç</button>
              <button className="btn-primary" disabled={busy || !teachers.length || !draft.courseId || !draft.days?.length} onClick={() => save()}>
                {busy ? "Kaydediliyor…" : (draft.days?.length ?? 0) > 1 ? `${draft.days!.length} güne kaydet` : "Kaydet"}
              </button>
            </div>
            {!teachers.length && <p className="mt-2 text-xs text-amber-600">Önce menüdeki “Personel” sayfasından öğretmen ekleyin.</p>}
          </div>
        </div>
      )}
    </>
  );
}
