"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeacherRow } from "../types";

export default function TeacherManager({ teachers }: { teachers: TeacherRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", branch: "" });
  const [edit, setEdit] = useState<{ id: string; name: string; branch: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body?: unknown) {
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
    return true;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs text-lead">
            <tr>
              <th className="px-4 py-3">Öğretmen</th>
              <th className="px-4 py-3">Branş</th>
              <th className="px-4 py-3">Haftalık ders</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {teachers.map((t) =>
              edit?.id === t.id ? (
                <tr key={t.id}>
                  <td className="px-4 py-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
                  <td className="px-4 py-2"><input className="input" value={edit.branch} onChange={(e) => setEdit({ ...edit, branch: e.target.value })} /></td>
                  <td className="px-4 py-2 text-lead">{t.slotCount}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button className="btn-primary py-1" disabled={busy} onClick={async () => (await send(`/api/kurum/ogretmenler/${t.id}`, "PUT", edit)) && setEdit(null)}>Kaydet</button>
                    <button className="btn py-1 text-lead" onClick={() => setEdit(null)}>Vazgeç</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="hover:bg-paper">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="hover:text-brand-700 hover:underline">{t.name}</Link>
                  </td>
                  <td className="px-4 py-3">{t.branch}</td>
                  <td className="px-4 py-3 text-lead">{t.slotCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="text-sm text-lead hover:text-brand-600" onClick={() => setEdit({ id: t.id, name: t.name, branch: t.branch })}>Düzenle</button>
                    <button
                      className="ml-3 text-sm text-lead/70 hover:text-red-600"
                      onClick={() => {
                        const msg = t.slotCount
                          ? `${t.name} silinirse programdaki ${t.slotCount} dersi ve geçmiş ders kayıtları da silinir. Emin misiniz?`
                          : `${t.name} silinsin mi?`;
                        if (confirm(msg)) send(`/api/kurum/ogretmenler/${t.id}`, "DELETE");
                      }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ),
            )}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-lead">Henüz öğretmen yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        className="card space-y-3 self-start p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/kurum/ogretmenler", "POST", form)) setForm({ name: "", branch: "" });
        }}
      >
        <h3 className="font-semibold">Öğretmen ekle</h3>
        <div>
          <label className="label">Ad Soyad</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">Branş</label>
          <input className="input" placeholder="Matematik" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>Ekle</button>
      </form>
    </div>
  );
}
