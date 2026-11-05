"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClassManager({ classes }: { classes: { id: string; name: string; level: string; students: number }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [err, setErr] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/kurum/siniflar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, level }) });
    const json = await res.json();
    if (!res.ok) return setErr(json.error);
    setName("");
    setLevel("");
    router.refresh();
  }
  async function del(id: string) {
    const res = await fetch(`/api/kurum/siniflar/${id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json()).error);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-4">
            <div>
              <Link href={`/kurum/ogrenciler?sinif=${c.id}`} className="text-lg font-bold hover:text-brand-600">{c.name}</Link>
              <div className="text-xs text-lead">{c.level ? `${c.level}. seviye · ` : ""}{c.students} öğrenci</div>
            </div>
            {c.students === 0 && (
              <button className="text-sm text-lead/70 hover:text-red-600" onClick={() => del(c.id)}>Sil</button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={add} className="card h-fit space-y-3 p-5">
        <h2 className="font-semibold">Yeni sınıf</h2>
        <div>
          <label className="label">Sınıf / şube adı</label>
          <input className="input" placeholder="ör. 8-C" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Seviye</label>
          <input className="input" placeholder="ör. 8" value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full">Ekle</button>
      </form>
    </div>
  );
}
