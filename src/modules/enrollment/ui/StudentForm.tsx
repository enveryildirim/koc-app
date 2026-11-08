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

export const EMPTY_STUDENT: StudentValues = { studentNo: "", firstName: "", lastName: "", classroomId: "", phone: "", parentName: "", parentPhone: "", external: false };

/**
 * Öğrenci alanları (ekleme panelinde ve profildeki düzenleme formunda ortak).
 * `wide`: profilde iki sütun; panelde tek sütun.
 */
export function StudentFields({
  v,
  onChange,
  classes,
  noHint,
  wide = false,
}: {
  v: StudentValues;
  onChange: (v: StudentValues) => void;
  classes: { id: string; name: string }[];
  /** Numara kutusunun altındaki açıklama (yeni öğrencide) */
  noHint?: string;
  wide?: boolean;
}) {
  const set = (k: keyof StudentValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  return (
    <div className={`grid grid-cols-1 gap-4 ${wide ? "sm:grid-cols-2" : ""}`}>
      <div>
        <label className="label" htmlFor="st-no">Öğrenci no *</label>
        <input id="st-no" className="input num" value={v.studentNo} onChange={set("studentNo")} required maxLength={6} inputMode="numeric" />
        {noHint && <p className="mt-1 text-[12.5px] text-lead">{noHint}</p>}
      </div>
      <div>
        <label className="label" htmlFor="st-class">Sınıf</label>
        <select id="st-class" className="input" value={v.classroomId} onChange={set("classroomId")}>
          <option value="">— Sınıfsız —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="st-first">Ad *</label>
        <input id="st-first" className="input" value={v.firstName} onChange={set("firstName")} required />
      </div>
      <div>
        <label className="label" htmlFor="st-last">Soyad *</label>
        <input id="st-last" className="input" value={v.lastName} onChange={set("lastName")} required />
      </div>
      <div className={wide ? "sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]" : ""}>
        <label className="label" htmlFor="st-phone">Telefon</label>
        <input id="st-phone" className="input" value={v.phone} onChange={set("phone")} inputMode="tel" />
      </div>
      <div>
        <label className="label" htmlFor="st-parent">Veli adı</label>
        <input id="st-parent" className="input" value={v.parentName} onChange={set("parentName")} />
      </div>
      <div>
        <label className="label" htmlFor="st-parent-phone">Veli telefonu</label>
        <input id="st-parent-phone" className="input" value={v.parentPhone} onChange={set("parentPhone")} inputMode="tel" />
      </div>
      <label className={`flex items-center gap-2 text-sm ${wide ? "sm:col-span-2" : ""}`}>
        <input type="checkbox" checked={v.external} onChange={set("external")} className="accent-brand-600" />
        Kurum dışı öğrenci (STS – yalnızca sınavlara katılır)
      </label>
    </div>
  );
}

/** Öğrenci profilindeki düzenleme formu. Yeni öğrenci Öğrenciler sayfasındaki yan panelden eklenir (`StudentAdd`). */
export default function StudentForm({ classes, initial, studentId }: { classes: { id: string; name: string }[]; initial: StudentValues; studentId: string }) {
  const router = useRouter();
  const [v, setV] = useState<StudentValues>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/kurum/ogrenciler/${studentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    setMsg({ ok: true, text: "Kaydedildi." });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Öğrenci ve tüm sınav/ödev/yoklama kayıtları silinsin mi?")) return;
    await fetch(`/api/kurum/ogrenciler/${studentId}`, { method: "DELETE" });
    router.push("/kurum/ogrenciler");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <StudentFields v={v} onChange={setV} classes={classes} wide />
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>Kaydet</button>
        <button type="button" className="btn-danger ml-auto" onClick={remove}>Öğrenciyi sil</button>
      </div>
    </form>
  );
}
