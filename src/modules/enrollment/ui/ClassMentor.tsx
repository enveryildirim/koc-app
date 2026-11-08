"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Sınıfın etüt mesulünü seçme. Yalnızca etüt mesulü rolündeki öğretmenler listelenir. */
export default function ClassMentor({ classroomId, mentorId, mentors }: { classroomId: string; mentorId: string | null; mentors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState(mentorId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string) {
    setValue(next);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/kurum/siniflar/${classroomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: next || null }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
      setValue(mentorId ?? "");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <label className="label" htmlFor="mentor">Etüt mesulü</label>
      <select id="mentor" className="input" value={value} disabled={busy} onChange={(e) => save(e.target.value)}>
        <option value="">— Atanmadı —</option>
        {mentors.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      {!mentors.length && (
        <p className="mt-1 text-[13px] text-lead">Listede kimse yok. Menüdeki Öğretmenler sayfasında bir kişinin rolünü “Etüt mesulü” yapın.</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
