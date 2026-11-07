"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Denemenin bağlı olduğu ders (hocanın sınavı) ya da kurum denemesi. */
export default function ExamCourse({ examId, courseId, courses }: { examId: string; courseId: string | null; courses: { id: string; label: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(courseId ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <select
      className="input w-auto"
      aria-label="Bağlı ders"
      value={v}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value;
        setV(next);
        setBusy(true);
        const res = await fetch(`/api/kurum/denemeler/${examId}/ders`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: next || null }),
        });
        setBusy(false);
        if (!res.ok) {
          setV(courseId ?? "");
          return alert((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
        }
        router.refresh();
      }}
    >
      <option value="">Kurum denemesi</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>{c.label}</option>
      ))}
    </select>
  );
}
