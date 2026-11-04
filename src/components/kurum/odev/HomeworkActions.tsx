"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import HomeworkForm from "./HomeworkForm";

/** Ödev detay sayfasında düzenle / sil. */
export default function HomeworkActions({
  homework,
  subjects,
}: {
  homework: { id: string; subject: string; title: string; description: string; dueDate: string };
  subjects: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Bu ödev ve tüm öğrenci durumları silinsin mi?")) return;
    setBusy(true);
    const res = await fetch(`/api/kurum/odevler/${homework.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/kurum/odevler");
      router.refresh();
    } else {
      setBusy(false);
      alert("Silinemedi.");
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={() => setEditing(!editing)}>{editing ? "Düzenlemeyi kapat" : "✏️ Düzenle"}</button>
        <button className="btn-danger" onClick={remove} disabled={busy}>Sil</button>
      </div>
      {editing && (
        <div className="card mt-4 w-full basis-full p-5">
          <HomeworkForm
            classrooms={[]}
            subjects={subjects}
            homeworkId={homework.id}
            initial={homework}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </>
  );
}
