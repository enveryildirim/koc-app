"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Drawer, { enterSubmits } from "@/shared/ui/Drawer";
import { TeacherRow } from "../types";
import { TEACHER_ROLES, TEACHER_ROLE_KEYS } from "../labels";
import AccessLinkPanel from "./AccessLinkPanel";

type Role = "TEACHER" | "MENTOR";
type ClassOpt = { id: string; name: string; mentorId: string | null; mentorName: string | null };
type Form = { id?: string; name: string; role: Role; branch: string; classroomIds: string[] };

const empty = (role: Role): Form => ({ name: "", role, branch: "", classroomIds: [] });

/**
 * Personel: bir rolün listesi (Öğretmenler ya da Etüt mesulleri sekmesi) ve o rolün formu.
 * Öğretmen: ad + branş. Etüt mesulü: ad + sorumlu olduğu sınıflar (branşı yoktur).
 * Ekleme `?yeni=1` ile, düzenleme satırdaki "Düzenle" ile yan panelde. Rol değişince kişi öbür sekmeye geçer;
 * giriş linki korunur. Eklenenler listede vurgulanır.
 */
export default function PersonnelManager({ role, people, classes, open }: { role: Role; people: TeacherRow[]; classes: ClassOpt[]; open: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [form, setForm] = useState<Form>(empty(role));
  const [edit, setEdit] = useState<Form | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isMentor = role === "MENTOR";
  /** Ekleme paneli adresi: sekme (rol) korunur */
  const addHref = `?${new URLSearchParams({ ...Object.fromEntries(params), yeni: "1" })}`;
  const noun = isMentor ? "etüt mesulü" : "öğretmen";

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "İşlem başarısız.");
    return json as { id?: string };
  }
  /** Kişiyi kaydeder; etüt mesulüyse sınıflarını da yazar. Hata mesajını gösterir, başarıda kimliği döndürür. */
  async function persist(f: Form) {
    setBusy(true);
    setError("");
    try {
      const body = { name: f.name, role: f.role, branch: f.role === "MENTOR" ? "" : f.branch };
      const id = f.id ?? (await call("/api/kurum/ogretmenler", "POST", body)).id!;
      if (f.id) await call(`/api/kurum/ogretmenler/${f.id}`, "PUT", body);
      if (f.role === "MENTOR") await call(`/api/kurum/ogretmenler/${id}/siniflar`, "PUT", { classroomIds: f.classroomIds });
      router.refresh();
      return id;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const closeAdd = () => {
    setError("");
    const p = new URLSearchParams(params);
    p.delete("yeni");
    router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  async function add(again: boolean) {
    const id = await persist(form);
    if (!id) return;
    setAdded((a) => [...a, id]);
    setForm(empty(role));
    if (!again) closeAdd();
  }
  async function saveEdit() {
    if (!edit) return;
    if (await persist(edit)) setEdit(null);
  }
  async function remove(t: TeacherRow) {
    const msg = t.slotCount
      ? `${t.name} silinirse programdaki ${t.slotCount} dersi ve geçmiş ders kayıtları da silinir. Emin misiniz?`
      : `${t.name} silinsin mi?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await call(`/api/kurum/ogretmenler/${t.id}`, "DELETE");
      setEdit(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const startEdit = (t: TeacherRow) => {
    setError("");
    setEdit({ id: t.id, name: t.name, role: t.role === "MENTOR" ? "MENTOR" : "TEACHER", branch: t.role === "MENTOR" ? "" : t.branch, classroomIds: (t.classes ?? []).map((c) => c.id) });
  };

  const valid = (f: Form) => !!f.name.trim() && (f.role === "MENTOR" || !!f.branch.trim());
  const isNew = (id: string) => added.includes(id);
  const editing = edit ? people.find((p) => p.id === edit.id) : undefined;

  /** Sınıf seçimi (etüt mesulü): başka mesulü olan sınıf seçilirse ona geçer. */
  const classPicker = (f: Form, set: (f: Form) => void) => (
    <fieldset>
      <legend className="label">Sorumlu olduğu sınıflar</legend>
      {classes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => {
            const on = f.classroomIds.includes(c.id);
            const other = c.mentorId && c.mentorId !== f.id ? c.mentorName : null;
            return (
              <label key={c.id} className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 ${on ? "bg-graphite text-white ring-graphite" : "bg-surface ring-rule"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => set({ ...f, classroomIds: on ? f.classroomIds.filter((x) => x !== c.id) : [...f.classroomIds, c.id] })}
                />
                {c.name}
                {other && <span className={on ? "text-white/70" : "text-lead"}> · {other}</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-lead">
          Henüz sınıf yok. <Link href="/kurum/siniflar?yeni=1" className="font-medium text-brand-600 hover:underline">Sınıf ekleyin</Link>; sonra buradan atayın.
        </p>
      )}
      <p className="mt-1 text-[12.5px] text-lead">Başka mesulü olan sınıfı seçerseniz sınıf bu kişiye geçer. Sınıfın mesulü sınıf sayfasından da değiştirilebilir.</p>
    </fieldset>
  );

  /** Panel alanları (ekleme ve düzenleme). Düzenlemede rol de değiştirilebilir. */
  const fields = (f: Form, set: (f: Form) => void, withRole: boolean) => (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="p-name">Ad Soyad</label>
        <input id="p-name" className="input" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />
      </div>
      {withRole && (
        <div>
          <label className="label" htmlFor="p-role">Rol</label>
          <select id="p-role" className="input" value={f.role} onChange={(e) => set({ ...f, role: e.target.value as Role })}>
            {TEACHER_ROLE_KEYS.map((k) => <option key={k} value={k}>{TEACHER_ROLES[k]}</option>)}
          </select>
          {f.role !== role && (
            <p className="mt-1 text-[12.5px] text-amber-700">
              Kaydedince {f.role === "MENTOR" ? "Etüt mesulleri" : "Öğretmenler"} sekmesine geçer; giriş linki aynı kalır.
              {f.role === "TEACHER" && " Sorumlu olduğu sınıflar boşa çıkar."}
            </p>
          )}
        </div>
      )}
      {f.role === "MENTOR" ? (
        classPicker(f, set)
      ) : (
        <div>
          <label className="label" htmlFor="p-branch">Branş</label>
          <input id="p-branch" className="input" placeholder="Matematik" value={f.branch} onChange={(e) => set({ ...f, branch: e.target.value })} />
        </div>
      )}
      <p className="text-[12.5px] text-lead">
        {f.role === "MENTOR"
          ? "Etüt mesulü sınıflarının sorumlusudur; yönetici yetkisiyle öğretmenin yaptığı her şeyi yapabilir."
          : "Öğretmen telefondan kendi derslerinin yoklamasını, konusunu, sözlü / yazılısını ve ödevini girer."}{" "}
        Giriş linki listeden oluşturulur.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );

  const sub = (t: TeacherRow) =>
    isMentor ? ((t.classes ?? []).map((c) => c.name).join(", ") || "Sınıf atanmadı") : t.branch || "—";

  return (
    <>
      {/* Telefon: iki satırlık liste; giriş linki ve işlemler satırın içinde */}
      <ul className="card divide-y divide-rule/70 sm:hidden">
        {people.map((t) => (
          <li key={t.id} className={`space-y-2 px-3.5 py-3 ${isNew(t.id) ? "bg-emerald-50" : ""}`}>
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="font-medium">{t.name}</Link>
              <span className="shrink-0 text-[13px] text-lead">Haftada {t.slotCount} ders</span>
            </div>
            <div className="text-[13px] text-lead">{sub(t)}</div>
            <AccessLinkPanel teacherId={t.id} name={t.name} link={t.link ?? null} />
            <button className="text-sm text-lead hover:text-brand-600" onClick={() => startEdit(t)}>Düzenle</button>
          </li>
        ))}
        {people.length === 0 && (
          <li className="px-3.5 py-6 text-center text-lead">
            Henüz {noun} yok. <Link href={addHref} scroll={false} className="font-semibold text-brand-600">Ekleyin</Link>.
          </li>
        )}
      </ul>

      <div className="card hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs text-lead">
            <tr>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">{isMentor ? "Sınıfları" : "Branş"}</th>
              {!isMentor && <th className="whitespace-nowrap px-4 py-3">Dersleri</th>}
              <th className="whitespace-nowrap px-4 py-3">Haftalık ders</th>
              <th className="px-4 py-3">Giriş linki</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {people.map((t) => (
              <tr key={t.id} className={isNew(t.id) ? "bg-emerald-50" : "hover:bg-paper"}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="hover:text-brand-700 hover:underline">{t.name}</Link>
                  {isNew(t.id) && <span className="ml-2 text-xs font-normal text-emerald-700">eklendi</span>}
                </td>
                <td className={`px-4 py-3 ${isMentor && !t.classes?.length ? "text-amber-700" : ""}`}>{sub(t)}</td>
                {!isMentor && <td className="num px-4 py-3 text-lead">{t.courseCount ?? 0}</td>}
                <td className="num px-4 py-3 text-lead">{t.slotCount}</td>
                <td className="px-4 py-3"><AccessLinkPanel teacherId={t.id} name={t.name} link={t.link ?? null} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button className="text-sm text-lead hover:text-brand-600" onClick={() => startEdit(t)}>Düzenle</button>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-lead">
                  Henüz {noun} yok. <Link href={addHref} scroll={false} className="font-semibold text-brand-600">Ekleyin</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && !open && !edit && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Drawer
        open={open && !edit}
        title={isMentor ? "Etüt mesulü ekle" : "Öğretmen ekle"}
        onClose={closeAdd}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !valid(form)} onClick={() => add(false)}>Kaydet</button>
            <button className="btn-secondary" disabled={busy || !valid(form)} onClick={() => add(true)}>Kaydet ve yenisini ekle</button>
            <button className="btn ml-auto text-lead" onClick={closeAdd}>Vazgeç</button>
          </>
        }
      >
        <form onSubmit={(e) => e.preventDefault()} onKeyDown={enterSubmits(() => valid(form) && add(true))}>
          {fields(form, setForm, false)}
          {added.length > 0 && !error && <p className="mt-3 text-sm text-emerald-700">{added.length} kişi eklendi.</p>}
        </form>
      </Drawer>

      <Drawer
        open={!!edit}
        title={`${editing?.name ?? ""} · düzenle`}
        onClose={() => {
          setError("");
          setEdit(null);
        }}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !edit || !valid(edit)} onClick={saveEdit}>Kaydet</button>
            <button className="btn text-lead" onClick={() => setEdit(null)}>Vazgeç</button>
            {editing && (
              <button className="ml-auto text-sm text-lead/70 hover:text-red-600" disabled={busy} onClick={() => remove(editing)}>Sil</button>
            )}
          </>
        }
      >
        {edit && (
          <form onSubmit={(e) => e.preventDefault()} onKeyDown={enterSubmits(() => valid(edit) && saveEdit())}>
            {fields(edit, setEdit as (f: Form) => void, true)}
          </form>
        )}
      </Drawer>
    </>
  );
}
