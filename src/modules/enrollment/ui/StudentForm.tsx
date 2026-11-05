"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type StudentValues = {
  studentNo: string;
  firstName: string;
  lastName: string;
  classroomId: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  external: boolean;
};

const EMPTY: StudentValues = { studentNo: "", firstName: "", lastName: "", classroomId: "", phone: "", parentName: "", parentPhone: "", external: false };

export default function StudentForm({
  classes,
  initial,
  studentId,
}: {
  classes: { id: string; name: string }[];
  initial?: StudentValues;
  studentId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<StudentValues>(initial ?? EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof StudentValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(studentId ? `/api/kurum/ogrenciler/${studentId}` : "/api/kurum/ogrenciler", {
      method: studentId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    if (studentId) {
      setMsg({ ok: true, text: "Kaydedildi." });
      router.refresh();
    } else {
      setMsg({ ok: true, text: `${v.firstName} ${v.lastName} eklendi.` });
      setV({ ...EMPTY, classroomId: v.classroomId });
      router.refresh();
    }
  }

  async function remove() {
    if (!studentId || !confirm("Öğrenci ve tüm sınav/ödev/yoklama kayıtları silinsin mi?")) return;
    await fetch(`/api/kurum/ogrenciler/${studentId}`, { method: "DELETE" });
    router.push("/kurum/ogrenciler");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Öğrenci no *</label>
        <input className="input num" value={v.studentNo} onChange={set("studentNo")} required maxLength={6} inputMode="numeric" />
      </div>
      <div>
        <label className="label">Sınıf</label>
        <select className="input" value={v.classroomId} onChange={set("classroomId")}>
          <option value="">— Sınıfsız —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Ad *</label>
        <input className="input" value={v.firstName} onChange={set("firstName")} required />
      </div>
      <div>
        <label className="label">Soyad *</label>
        <input className="input" value={v.lastName} onChange={set("lastName")} required />
      </div>
      <div>
        <label className="label">Telefon</label>
        <input className="input" value={v.phone} onChange={set("phone")} />
      </div>
      <div />
      <div>
        <label className="label">Veli adı</label>
        <input className="input" value={v.parentName} onChange={set("parentName")} />
      </div>
      <div>
        <label className="label">Veli telefonu</label>
        <input className="input" value={v.parentPhone} onChange={set("parentPhone")} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={v.external} onChange={set("external")} className="accent-brand-600" />
        Kurum dışı öğrenci (STS – yalnızca sınavlara katılır)
      </label>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>{studentId ? "Kaydet" : "Öğrenciyi ekle"}</button>
        {studentId && <button type="button" className="btn-danger ml-auto" onClick={remove}>Öğrenciyi sil</button>}
      </div>
    </form>
  );
}
