"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Drawer from "@/shared/ui/Drawer";
import { COURSE_KINDS, COURSE_KIND_KEYS, guessCourseKind } from "../labels";
import type { CourseRow } from "../types";

type Row = CourseRow & { classroomName: string };
type Teacher = { id: string; name: string; role: string };
type Draft = { name: string; kind: string; teacherId: string; external: boolean; classroomIds: string[] };

const hours = (min: number) => (min / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/**
 * Yönetim → Dersler: dersin oluştuğu tek yer. Bütün sınıfların dersleri tek listede (sayfa sınıfa göre süzer);
 * ekleme ve düzenleme yan panelde. Eklemede birden fazla sınıf seçilebilir (aynı ders birkaç sınıfa birden).
 * Panel `?yeni=1` ile ekleme, `?ders=<id>` ile düzenleme için açılır.
 */
export default function CourseAdmin({
  courses,
  classrooms,
  teachers,
  names,
  classroomId,
  open,
  editId,
}: {
  courses: Row[];
  classrooms: { id: string; name: string }[];
  teachers: Teacher[];
  /** Kurumdaki ders adları: aynı dersin sınıflarda aynı adla açılması için öneri */
  names: string[];
  /** Süzülen sınıf ("" = tümü); yeni derste ön seçili sınıf */
  classroomId: string;
  open: boolean;
  editId?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const empty = (): Draft => ({ name: "", kind: "SCHOOL", teacherId: "", external: false, classroomIds: classroomId ? [classroomId] : [] });
  const [draft, setDraft] = useState<Draft>(empty);
  const [kindTouched, setKindTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const editing = editId ? courses.find((c) => c.id === editId) : undefined;
  const [edit, setEdit] = useState<Draft | null>(() =>
    editing ? { name: editing.name, kind: editing.kind, teacherId: editing.teacherId ?? "", external: editing.external, classroomIds: [editing.classroomId] } : null,
  );

  /** Paneli kapatır: adresten `yeni` / `ders` kalkar, sınıf süzgeci kalır. */
  const close = () => {
    setError("");
    setEdit(null);
    router.replace(classroomId ? `${path}?sinif=${classroomId}` : path, { scroll: false });
  };
  const openEdit = (c: Row) => {
    setError("");
    setEdit({ name: c.name, kind: c.kind, teacherId: c.teacherId ?? "", external: c.external, classroomIds: [c.classroomId] });
    router.replace(`${path}?${new URLSearchParams({ ...(classroomId ? { sinif: classroomId } : {}), ders: c.id })}`, { scroll: false });
  };

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, json: await res.json().catch(() => ({})) };
  }

  async function add(again: boolean) {
    setBusy(true);
    setError("");
    const fails: string[] = [];
    const ok: string[] = [];
    for (const cid of draft.classroomIds) {
      const r = await call("/api/kurum/dersler", "POST", { classroomId: cid, name: draft.name, kind: draft.kind, teacherId: draft.teacherId || null, external: draft.external });
      if (r.ok) ok.push(r.json.id);
      else fails.push(`${classrooms.find((c) => c.id === cid)?.name}: ${r.json.error ?? "kaydedilemedi"}`);
    }
    setBusy(false);
    setAdded((a) => [...a, ...ok]);
    router.refresh();
    if (fails.length) return setError(fails.join(" "));
    // Arka arkaya giriş: sınıflar ve tür kalır, ad ve sorumlu boşalır
    setDraft(again ? { ...draft, name: "", teacherId: "" } : empty());
    setKindTouched(again ? kindTouched : false);
    if (!again) close();
  }

  async function saveEdit() {
    if (!edit || !editId) return;
    setBusy(true);
    setError("");
    const r = await call(`/api/kurum/dersler/${editId}`, "PATCH", { name: edit.name, kind: edit.kind, teacherId: edit.teacherId || null, external: edit.external });
    setBusy(false);
    if (!r.ok) return setError(r.json.error ?? "Kaydedilemedi.");
    router.refresh();
    close();
  }

  async function remove() {
    if (!editing || !confirm(`${editing.classroomName} · “${editing.name}” dersi silinsin mi?`)) return;
    setBusy(true);
    const r = await call(`/api/kurum/dersler/${editing.id}`, "DELETE");
    setBusy(false);
    if (!r.ok) return setError(r.json.error ?? "Silinemedi.");
    router.refresh();
    close();
  }

  const isNew = (id: string) => added.includes(id);
  const kindBadge = (c: Row) => (
    <>
      <span className={`badge ${COURSE_KINDS[c.kind]?.cls ?? ""}`}>{COURSE_KINDS[c.kind]?.label ?? c.kind}</span>
      {c.external && <span className="badge bg-zinc-100 text-zinc-700">Dışarıda</span>}
    </>
  );
  const program = (c: Row) => (c.slotCount ? `${c.slotCount} saat · ${hours(c.weeklyMinutes)} sa/hafta` : "Programda yok");

  /** Panel alanları (ekleme ve düzenleme ortak). */
  const fields = (d: Draft, set: (d: Draft) => void, adding: boolean) => (
    <div className="space-y-3">
      {adding ? (
        <fieldset>
          <legend className="label">Sınıf</legend>
          <div className="flex flex-wrap gap-1.5">
            {classrooms.map((c) => {
              const on = d.classroomIds.includes(c.id);
              return (
                <label key={c.id} className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 ${on ? "bg-graphite text-white ring-graphite" : "bg-surface ring-rule"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => set({ ...d, classroomIds: on ? d.classroomIds.filter((x) => x !== c.id) : [...d.classroomIds, c.id] })}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-[12.5px] text-lead">Birden fazla sınıf seçerseniz ders her birine ayrı ayrı eklenir.</p>
        </fieldset>
      ) : (
        <div>
          <span className="label">Sınıf</span>
          <p className="font-medium">{editing?.classroomName}</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="course-name">Ders adı</label>
        <input
          id="course-name"
          className="input"
          list="course-names"
          placeholder="ör. Fizik"
          value={d.name}
          onChange={(e) => set({ ...d, name: e.target.value, ...(adding && !kindTouched ? { kind: guessCourseKind(e.target.value) } : {}) })}
        />
        <datalist id="course-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <p className="mt-1 text-[12.5px] text-lead">Aynı ders her sınıfta aynı adla açılmalı; takip ve analiz dersleri adla birleştirir.</p>
      </div>
      <div>
        <label className="label" htmlFor="course-kind">Tür</label>
        <select
          id="course-kind"
          className="input"
          value={d.kind}
          onChange={(e) => {
            setKindTouched(true);
            set({ ...d, kind: e.target.value });
          }}
        >
          {COURSE_KIND_KEYS.map((k) => <option key={k} value={k}>{COURSE_KINDS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="course-teacher">Sorumlu</label>
        <select id="course-teacher" className="input" value={d.teacherId} onChange={(e) => set({ ...d, teacherId: e.target.value })}>
          <option value="">—</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.role === "MENTOR" ? " (etüt mesulü)" : ""}</option>)}
        </select>
        <p className="mt-1 text-[12.5px] text-lead">Ders programına eklerken öğretmen buradan gelir.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.external} onChange={(e) => set({ ...d, external: e.target.checked })} />
        Başka kurumda alınıyor
      </label>
      {d.external && <p className="text-[13px] text-lead">Bu dersin bilgilerini sorumlusu (genelde etüt mesulü) girer.</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {adding && added.length > 0 && !error && <p className="text-sm text-emerald-700">{added.length} ders eklendi.</p>}
    </div>
  );

  const canAdd = draft.name.trim() && draft.classroomIds.length > 0;

  return (
    <>
      {courses.length === 0 ? (
        <div className="card p-6 text-sm text-lead">
          {classroomId ? "Bu sınıfın dersi yok." : "Henüz ders yok."} Dersler sınıfa bağlıdır; ders programı, yoklama, sözlü / yazılı, ödev ve yıllık plan bu derslerden seçilir.
        </div>
      ) : (
        <>
          {/* Telefon: iki satırlık liste */}
          <ul className="card divide-y divide-rule/70 sm:hidden">
            {courses.map((c) => (
              <li key={c.id} className={isNew(c.id) ? "bg-emerald-50" : ""}>
                <button className="block w-full px-3.5 py-2.5 text-left active:bg-paper" onClick={() => openEdit(c)}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{c.name}</span>
                    {kindBadge(c)}
                    <span className="ml-auto text-[13px] font-semibold">{c.classroomName}</span>
                  </span>
                  <span className="block text-[13px] text-lead">{c.teacherName ?? "Sorumlu yok"} · {program(c)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs text-lead">
                <tr>
                  <th className="px-4 py-2.5">Sınıf</th>
                  <th className="px-4 py-2.5">Ders</th>
                  <th className="px-4 py-2.5">Sorumlu</th>
                  <th className="px-4 py-2.5">Programda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {courses.map((c) => (
                  <tr key={c.id} className={`cursor-pointer ${isNew(c.id) ? "bg-emerald-50" : "hover:bg-paper"}`} onClick={() => openEdit(c)}>
                    <td className="px-4 py-2.5 font-semibold">{c.classroomName}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <button className="font-medium hover:text-brand-600" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{c.name}</button>
                        {kindBadge(c)}
                        {isNew(c.id) && <span className="text-xs text-emerald-700">eklendi</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{c.teacherName ?? <span className="text-lead/70">yok</span>}</td>
                    <td className={`num px-4 py-2.5 ${c.slotCount ? "" : "text-lead"}`}>{program(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer
        open={open && !edit}
        title="Ders ekle"
        onClose={close}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !canAdd} onClick={() => add(false)}>Kaydet</button>
            <button className="btn-secondary" disabled={busy || !canAdd} onClick={() => add(true)}>Kaydet ve yenisini ekle</button>
            <button className="btn ml-auto text-lead" onClick={close}>Vazgeç</button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); if (canAdd) add(false); }}>
          {fields(draft, setDraft, true)}
          <button type="submit" className="sr-only" tabIndex={-1}>Kaydet</button>
        </form>
      </Drawer>

      <Drawer
        open={!!edit && !!editing}
        title="Dersi düzenle"
        onClose={close}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !edit?.name.trim()} onClick={saveEdit}>Kaydet</button>
            <button className="btn text-lead" onClick={close}>Vazgeç</button>
            <button className="ml-auto text-sm text-lead/70 hover:text-red-600" disabled={busy} onClick={remove}>Dersi sil</button>
          </>
        }
      >
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
            {fields(edit, setEdit, false)}
            {editing && editing.slotCount > 0 && (
              <p className="mt-3 text-[12.5px] text-lead">Programda {editing.slotCount} saati var; ad değişirse programdaki satırlar da değişir. Silmek için önce programdan kaldırın.</p>
            )}
            <button type="submit" className="sr-only" tabIndex={-1}>Kaydet</button>
          </form>
        )}
      </Drawer>
    </>
  );
}
