"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toInputDate } from "@/shared/date";

type Values = { classroomId: string; subject: string; title: string; description: string; dueDate: string };

/** Yeni ödev oluşturma veya mevcut ödevi düzenleme formu. */
export default function HomeworkForm({
  classrooms,
  subjects,
  subjectsByClass,
  initial,
  homeworkId,
  onDone,
}: {
  classrooms: { id: string; name: string }[];
  /** Ders seçenekleri; `subjectsByClass` verilmişse kullanılmaz */
  subjects: string[];
  /** Sınıfın dersleri (ders kaydından): ders yalnızca seçili sınıfın derslerinden seçilir */
  subjectsByClass?: Record<string, string[]>;
  initial?: Partial<Values>;
  homeworkId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const week = new Date();
  week.setDate(week.getDate() + 7);
  /** Sınıfın dersleri; düzenlenen eski ödevin dersi listede yoksa o da seçenek olur. */
  const optionsFor = (classroomId: string) => {
    const list = subjectsByClass ? subjectsByClass[classroomId] ?? [] : subjects;
    return initial?.subject && !list.includes(initial.subject) && (homeworkId || classroomId === initial.classroomId) ? [initial.subject, ...list] : list;
  };
  const firstClass = initial?.classroomId ?? classrooms[0]?.id ?? "";
  const [v, setV] = useState<Values>({
    classroomId: firstClass,
    subject: initial?.subject ?? optionsFor(firstClass)[0] ?? "",
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
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {!homeworkId && (
        <div>
          <label className="label">Sınıf</label>
          <select
            className="input"
            value={v.classroomId}
            onChange={(e) => {
              const opts = optionsFor(e.target.value);
              setV({ ...v, classroomId: e.target.value, subject: opts.includes(v.subject) ? v.subject : opts[0] ?? "" });
            }}
            required
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Ders</label>
        {optionsFor(v.classroomId).length ? (
          <select className="input" value={v.subject} onChange={set("subject")} required>
            {optionsFor(v.classroomId).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <p className="pt-2 text-sm text-amber-700">
            Bu sınıfın dersi yok.{" "}
            {subjectsByClass && <Link href={`/kurum/dersler?sinif=${v.classroomId}&yeni=1`} className="font-medium text-brand-600 hover:underline">Dersler sayfasında ekleyin</Link>}
          </p>
        )}
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
        <button className="btn-primary" disabled={busy || (!homeworkId && !classrooms.length) || !v.subject}>
          {busy ? "Kaydediliyor…" : homeworkId ? "Değişiklikleri kaydet" : "Ödevi ver"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
