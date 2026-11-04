"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toInputDate } from "@/shared/date";

type Values = { classroomId: string; subject: string; title: string; description: string; dueDate: string };

/** Yeni ödev oluşturma veya mevcut ödevi düzenleme formu. */
export default function HomeworkForm({
  classrooms,
  subjects,
  initial,
  homeworkId,
  onDone,
}: {
  classrooms: { id: string; name: string }[];
  subjects: string[];
  initial?: Partial<Values>;
  homeworkId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const [v, setV] = useState<Values>({
    classroomId: initial?.classroomId ?? classrooms[0]?.id ?? "",
    subject: initial?.subject ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    dueDate: initial?.dueDate ?? toInputDate(week),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(homeworkId ? `/api/kurum/odevler/${homeworkId}` : "/api/kurum/odevler", {
      method: homeworkId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    if (homeworkId) {
      setMsg({ ok: true, text: "Ödev güncellendi." });
      router.refresh();
      onDone?.();
    } else {
      setMsg({ ok: true, text: `Ödev oluşturuldu ve ${json.students} öğrenciye atandı.` });
      setV({ ...v, title: "", description: "" });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      {!homeworkId && (
        <div>
          <label className="label">Sınıf</label>
          <select className="input" value={v.classroomId} onChange={set("classroomId")} required>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Ders</label>
        <input className="input" list="odev-dersler" value={v.subject} onChange={set("subject")} placeholder="Ör. Matematik" required />
        <datalist id="odev-dersler">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className={homeworkId ? "" : "md:col-span-2"}>
        <label className="label">Başlık</label>
        <input className="input" value={v.title} onChange={set("title")} placeholder="Ör. Üslü ifadeler – 40 soru" required />
      </div>
      <div className="md:col-span-2">
        <label className="label">Açıklama</label>
        <textarea className="input" rows={2} value={v.description} onChange={set("description")} />
      </div>
      <div>
        <label className="label">Teslim tarihi</label>
        <input type="date" className="input" value={v.dueDate} onChange={set("dueDate")} required />
      </div>
      <div className="flex items-end gap-3">
        <button className="btn-primary" disabled={busy || !classrooms.length}>
          {busy ? "Kaydediliyor…" : homeworkId ? "Değişiklikleri kaydet" : "Ödevi ver"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
