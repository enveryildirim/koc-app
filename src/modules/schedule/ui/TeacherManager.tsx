"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Drawer, { enterSubmits } from "@/shared/ui/Drawer";
import { TeacherRow } from "../types";
import { TEACHER_ROLES, TEACHER_ROLE_KEYS } from "../labels";
import AccessLinkPanel from "./AccessLinkPanel";

type Form = { name: string; branch: string; role: string };

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {TEACHER_ROLE_KEYS.map((k) => (
        <option key={k} value={k}>{TEACHER_ROLES[k]}</option>
      ))}
    </select>
  );
}

const RoleBadge = ({ role }: { role: string }) =>
  role === "MENTOR" ? <span className="badge bg-orange-50 text-orange-700">Etüt mesulü</span> : <span className="text-lead">Öğretmen</span>;

/** Etüt mesulünün branşı yoktur; tabloda "—". */
const branchOf = (t: { branch: string; role: string }) => (t.role === "MENTOR" || !t.branch ? "—" : t.branch);

/**
 * Öğretmen ve etüt mesulleri: liste (masaüstünde tablo, telefonda iki satır), düzenleme satırda,
 * ekleme yan panelde (`?yeni=1`, başlıktaki "+ Öğretmen ekle"). Eklenenler listede vurgulanır.
 */
export default function TeacherManager({ teachers, open = false }: { teachers: TeacherRow[]; open?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [added, setAdded] = useState<string[]>([]);
  const [form, setForm] = useState<Form>({ name: "", branch: "", role: "TEACHER" });
  const [edit, setEdit] = useState<(Form & { id: string }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body?: unknown): Promise<false | { id?: string }> {
    setBusy(true);
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "İşlem başarısız.");
      return false;
    }
    router.refresh();
    return json;
  }

  const closeAdd = () => {
    setError("");
    router.replace(path, { scroll: false });
  };
  /** Ekler; `again` ise panel açık kalır, rol korunur. */
  async function add(again: boolean) {
    const r = await send("/api/kurum/ogretmenler", "POST", form);
    if (!r) return;
    if (r.id) setAdded((a) => [...a, r.id!]);
    setForm({ name: "", branch: "", role: form.role });
    if (!again) closeAdd();
  }
  const canAdd = form.name.trim() && (form.role === "MENTOR" || form.branch.trim());
  const isNew = (id: string) => added.includes(id);

  const startEdit = (t: TeacherRow) => {
    setError("");
    setEdit({ id: t.id, name: t.name, branch: t.role === "MENTOR" ? "" : t.branch, role: t.role });
  };
  const saveEdit = async () => edit && (await send(`/api/kurum/ogretmenler/${edit.id}`, "PUT", edit)) && setEdit(null);
  const remove = (t: TeacherRow) => {
    const msg = t.slotCount
      ? `${t.name} silinirse programdaki ${t.slotCount} dersi ve geçmiş ders kayıtları da silinir. Emin misiniz?`
      : `${t.name} silinsin mi?`;
    if (confirm(msg)) send(`/api/kurum/ogretmenler/${t.id}`, "DELETE");
  };

  /** Düzenleme alanları (masaüstünde tablo satırında, telefonda liste satırında). */
  const editFields = (e: Form & { id: string }) => (
    <>
      <input className="input" aria-label="Ad soyad" value={e.name} onChange={(x) => setEdit({ ...e, name: x.target.value })} />
      <RoleSelect value={e.role} onChange={(role) => setEdit({ ...e, role })} />
      {e.role !== "MENTOR" && (
        <input className="input" aria-label="Branş" placeholder="Branş" value={e.branch} onChange={(x) => setEdit({ ...e, branch: x.target.value })} />
      )}
    </>
  );

  return (
    <>
      <div>
        {/* Telefon: iki satırlık liste; giriş linki ve işlemler satırın içinde */}
        <ul className="card divide-y divide-rule/70 sm:hidden">
          {teachers.map((t) => (
            <li key={t.id} className={`space-y-2 px-3.5 py-3 ${isNew(t.id) ? "bg-emerald-50" : ""}`}>
              {edit?.id === t.id ? (
                <div className="space-y-2">
                  {editFields(edit)}
                  <div className="flex gap-2">
                    <button className="btn-primary py-1" disabled={busy} onClick={saveEdit}>Kaydet</button>
                    <button className="btn py-1 text-lead" onClick={() => setEdit(null)}>Vazgeç</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="font-medium">{t.name}</Link>
                    <span className="shrink-0 text-[13px]"><RoleBadge role={t.role} /></span>
                  </div>
                  <div className="text-[13px] text-lead">
                    {t.role !== "MENTOR" && t.branch ? `${t.branch} · ` : ""}Haftada {t.slotCount} ders
                  </div>
                  <AccessLinkPanel teacherId={t.id} name={t.name} link={t.link ?? null} />
                  <div className="flex gap-4 text-sm">
                    <button className="text-lead hover:text-brand-600" onClick={() => startEdit(t)}>Düzenle</button>
                    <button className="text-lead/70 hover:text-red-600" onClick={() => remove(t)}>Sil</button>
                  </div>
                </>
              )}
            </li>
          ))}
          {teachers.length === 0 && (
            <li className="px-3.5 py-6 text-center text-lead">
              Henüz öğretmen yok. <Link href="?yeni=1" scroll={false} className="font-semibold text-brand-600">İlk öğretmeni ekleyin</Link>.
            </li>
          )}
        </ul>

        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-lead">
              <tr>
                <th className="px-4 py-3">Ad Soyad</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Branş</th>
                <th className="whitespace-nowrap px-4 py-3">Haftalık ders</th>
                <th className="px-4 py-3">Giriş linki</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {teachers.map((t) =>
                edit?.id === t.id ? (
                  <tr key={t.id}>
                    <td className="px-4 py-2"><input className="input" aria-label="Ad soyad" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
                    <td className="px-4 py-2"><RoleSelect value={edit.role} onChange={(role) => setEdit({ ...edit, role })} /></td>
                    <td className="px-4 py-2">
                      {edit.role === "MENTOR" ? (
                        <span className="text-lead">—</span>
                      ) : (
                        <input className="input" aria-label="Branş" value={edit.branch} onChange={(e) => setEdit({ ...edit, branch: e.target.value })} />
                      )}
                    </td>
                    <td className="px-4 py-2 text-lead">{t.slotCount}</td>
                    <td className="px-4 py-2" />
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button className="btn-primary py-1" disabled={busy} onClick={saveEdit}>Kaydet</button>
                      <button className="btn py-1 text-lead" onClick={() => setEdit(null)}>Vazgeç</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className={isNew(t.id) ? "bg-emerald-50" : "hover:bg-paper"}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="hover:text-brand-700 hover:underline">{t.name}</Link>
                      {isNew(t.id) && <span className="ml-2 text-xs font-normal text-emerald-700">eklendi</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><RoleBadge role={t.role} /></td>
                    <td className="px-4 py-3">{branchOf(t)}</td>
                    <td className="px-4 py-3 text-lead">{t.slotCount}</td>
                    <td className="px-4 py-3"><AccessLinkPanel teacherId={t.id} name={t.name} link={t.link ?? null} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button className="text-sm text-lead hover:text-brand-600" onClick={() => startEdit(t)}>Düzenle</button>
                      <button className="ml-3 text-sm text-lead/70 hover:text-red-600" onClick={() => remove(t)}>Sil</button>
                    </td>
                  </tr>
                ),
              )}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-lead">
                    Henüz öğretmen yok. <Link href="?yeni=1" scroll={false} className="font-semibold text-brand-600">İlk öğretmeni ekleyin</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && !open && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <Drawer
        open={open}
        title="Öğretmen ekle"
        onClose={closeAdd}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !canAdd} onClick={() => add(false)}>Kaydet</button>
            <button className="btn-secondary" disabled={busy || !canAdd} onClick={() => add(true)}>Kaydet ve yenisini ekle</button>
            <button className="btn ml-auto text-lead" onClick={closeAdd}>Vazgeç</button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={enterSubmits(() => canAdd && add(true))}
        >
          <div>
            <label className="label" htmlFor="t-name">Ad Soyad</label>
            <input id="t-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="t-role">Rol</label>
            <RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} />
            <p className="mt-1 text-[13px] text-lead">
              {form.role === "MENTOR"
                ? "Etüt mesulü sınıfların sorumlusudur; yönetici yetkisiyle öğretmenin yaptığı her şeyi yapabilir. Branşı yoktur."
                : "Öğretmen telefondan kendi derslerinin yoklamasını, konusunu, sözlü / yazılısını ve ödevini girer."}
            </p>
          </div>
          {form.role !== "MENTOR" && (
            <div>
              <label className="label" htmlFor="t-branch">Branş</label>
              <input id="t-branch" className="input" placeholder="Matematik" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
            </div>
          )}
          {error && !edit && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {added.length > 0 && !error && <p className="text-sm text-emerald-700">{added.length} kişi eklendi. Giriş linkini listeden oluşturun.</p>}
        </form>
      </Drawer>
    </>
  );
}
