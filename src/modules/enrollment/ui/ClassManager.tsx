"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Drawer from "@/shared/ui/Drawer";

export type ClassRow = { id: string; name: string; level: string; students: number; members: number; courses: number; mentor: string | null };

/**
 * Sınıflar listesi (masaüstünde tablo, telefonda iki satırlık liste) ve "Yeni sınıf" paneli.
 * Panel, sayfa başlığındaki "+ Yeni sınıf" bağlantısıyla (`?yeni=1`) açılır; kaydedilen sınıf listede vurgulanır.
 */
export default function ClassManager({ classes, open }: { classes: ClassRow[]; open: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const close = () => {
    setErr("");
    router.replace(path, { scroll: false });
  };

  async function add(again: boolean) {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/kurum/siniflar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, level }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(json.error ?? "Kaydedilemedi.");
    setAdded((a) => [...a, json.id]);
    setName("");
    if (!again) {
      setLevel("");
      close();
    }
    router.refresh();
  }

  async function del(c: ClassRow) {
    if (!confirm(`${c.name} silinsin mi? Dersleri ve programı da silinir.`)) return;
    const res = await fetch(`/api/kurum/siniflar/${c.id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json()).error);
    router.refresh();
  }

  const isNew = (id: string) => added.includes(id);
  const counts = (c: ClassRow) => `${c.students} öğrenci${c.members ? ` + ${c.members} ek üye` : ""} · ${c.courses} ders`;
  const canDelete = (c: ClassRow) => c.students === 0 && c.members === 0;

  return (
    <>
      {classes.length === 0 ? (
        <div className="card p-6 text-sm text-lead">
          Henüz sınıf yok. Sınıflar öğrenci, ders ve ders programının temelidir.{" "}
          <Link href="?yeni=1" scroll={false} className="font-semibold text-brand-600">İlk sınıfı ekleyin</Link>.
        </div>
      ) : (
        <>
          {/* Telefon: iki satırlık liste */}
          <ul className="card divide-y divide-rule/70 sm:hidden">
            {classes.map((c) => (
              <li key={c.id} className={isNew(c.id) ? "bg-emerald-50" : ""}>
                <Link href={`/kurum/siniflar/${c.id}`} className="block px-3.5 py-2.5 active:bg-paper">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{c.name}</span>
                    {c.level && <span className="shrink-0 text-[13px] text-lead">Düzey {c.level}</span>}
                  </div>
                  <div className="text-[13px] text-lead">{counts(c)}</div>
                  <div className="text-[13px] text-lead">{c.mentor ? `Etüt mesulü: ${c.mentor}` : "Etüt mesulü atanmadı"}</div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs text-lead">
                <tr>
                  <th className="px-4 py-2.5">Sınıf</th>
                  <th className="px-4 py-2.5">Düzey</th>
                  <th className="px-4 py-2.5 text-right">Öğrenci</th>
                  <th className="px-4 py-2.5 text-right">Ek üye</th>
                  <th className="px-4 py-2.5 text-right">Ders</th>
                  <th className="px-4 py-2.5">Etüt mesulü</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {classes.map((c) => (
                  <tr key={c.id} className={isNew(c.id) ? "bg-emerald-50" : "hover:bg-paper"}>
                    <td className="px-4 py-2.5">
                      <Link href={`/kurum/siniflar/${c.id}`} className="font-semibold hover:text-brand-600">{c.name}</Link>
                      {isNew(c.id) && <span className="ml-2 text-xs text-emerald-700">eklendi</span>}
                    </td>
                    <td className="px-4 py-2.5 text-lead">{c.level || "—"}</td>
                    <td className="num px-4 py-2.5 text-right">{c.students}</td>
                    <td className="num px-4 py-2.5 text-right text-lead">{c.members || "—"}</td>
                    <td className="num px-4 py-2.5 text-right">{c.courses}</td>
                    <td className="px-4 py-2.5">{c.mentor ?? <span className="text-lead/70">atanmadı</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canDelete(c) && (
                        <button className="text-sm text-lead/70 hover:text-red-600" onClick={() => del(c)}>Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer
        open={open}
        title="Yeni sınıf"
        onClose={close}
        footer={
          <>
            <button className="btn-primary" disabled={busy || !name.trim()} onClick={() => add(false)}>Kaydet</button>
            <button className="btn-secondary" disabled={busy || !name.trim()} onClick={() => add(true)}>Kaydet ve yenisini ekle</button>
            <button className="btn ml-auto text-lead" onClick={close}>Vazgeç</button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add(false);
          }}
        >
          <div>
            <label className="label" htmlFor="cls-name">Sınıf / şube adı</label>
            <input id="cls-name" className="input" placeholder="ör. 9-A" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="cls-level">Düzey</label>
            <input id="cls-level" className="input" placeholder="ör. 9 ya da Seviye-2" value={level} onChange={(e) => setLevel(e.target.value)} />
            <p className="mt-1 text-[12.5px] text-lead">Aynı düzeydeki sınıflar müfredatı ve karşılaştırmaları paylaşır. “Kaydet ve yenisini ekle” düzeyi korur.</p>
          </div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {added.length > 0 && !err && <p className="text-sm text-emerald-700">{added.length} sınıf eklendi.</p>}
          <button type="submit" className="sr-only" tabIndex={-1}>Kaydet</button>
        </form>
      </Drawer>
    </>
  );
}
