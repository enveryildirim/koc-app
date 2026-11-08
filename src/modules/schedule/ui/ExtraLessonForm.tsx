"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LESSON_TYPES } from "@/modules/schedule";
import { Opt } from "../types";

type CourseOpt = { id: string; classroomId: string; name: string; teacherId: string | null };

/** Programda olmayan ek ders (etüt / özel ders) oluşturup yoklama ekranına geçer. Ders, sınıfın derslerinden seçilir. */
export default function ExtraLessonForm({ date, classrooms, teachers, courses }: { date: string; classrooms: Opt[]; teachers: Opt[]; courses: CourseOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const coursesOf = (classroomId: string) => courses.filter((c) => c.classroomId === classroomId);
  const pick = (c: CourseOpt | undefined, teacherId: string) => ({ courseId: c?.id ?? "", teacherId: c?.teacherId ?? teacherId });
  const [f, setF] = useState(() => {
    const classroomId = classrooms[0]?.id ?? "";
    return {
      classroomId,
      ...pick(coursesOf(classroomId)[0], teachers[0]?.id ?? ""),
      lessonType: "ETUT",
      startTime: "14:00",
      endTime: "14:40",
    };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)} disabled={!classrooms.length || !teachers.length}>
        Ek ders ekle
      </button>
    );
  }

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/kurum/yoklama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, extra: f, statuses: {} }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Oluşturulamadı.");
    router.push(`/kurum/yoklama/al?ders=${json.sessionId}`);
  }

  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Ek ders ({date})</h2>
        <p className="text-sm text-lead">Haftalık programda olmayan etüt veya özel ders için yoklama alın.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sınıf</label>
            <select className="input" value={f.classroomId} onChange={(e) => set({ classroomId: e.target.value, ...pick(coursesOf(e.target.value)[0], f.teacherId) })}>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Öğretmen</label>
            <select className="input" value={f.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Ders</label>
            {coursesOf(f.classroomId).length ? (
              <select className="input" value={f.courseId} onChange={(e) => set(pick(courses.find((c) => c.id === e.target.value), f.teacherId))}>
                {coursesOf(f.classroomId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <p className="text-sm text-amber-700">
                Bu sınıfın dersi yok.{" "}
                <Link href={`/kurum/dersler?sinif=${f.classroomId}&yeni=1`} className="font-medium text-brand-600 hover:underline">Dersler sayfasında ekleyin</Link>.
              </p>
            )}
          </div>
          <div className="col-span-2">
            <label className="label">Tür</label>
            <select className="input" value={f.lessonType} onChange={(e) => set({ lessonType: e.target.value })}>
              {Object.entries(LESSON_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Başlangıç</label>
            <input type="time" className="input" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="time" className="input" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Vazgeç</button>
          <button className="btn-primary" disabled={busy || !f.courseId} onClick={create}>Oluştur ve yoklama al</button>
        </div>
      </div>
    </div>
  );
}
