"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE } from "./labels";

type Stu = { id: string; no: string; name: string };

export default function AttendanceForm({
  students,
  initial,
  target,
  date,
  backHref,
  deletable,
}: {
  students: Stu[];
  initial: Record<string, string>;
  /** API'ye gönderilecek ders kimliği */
  target: { slotId?: string; sessionId?: string };
  date: string;
  backHref: string;
  /** Ek ders ise oturum silinebilir */
  deletable?: string;
}) {
  const router = useRouter();
  const [st, setSt] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, initial[s.id] ?? "PRESENT"])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const counts = Object.values(st).reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/kurum/yoklama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, date, statuses: st }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setMsg(j.error ?? "Kaydedilemedi.");
    }
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        {Object.entries(ATTENDANCE).map(([k, v]) => (
          <span key={k} className={`badge px-3 py-1 text-sm ${v.cls}`}>{v.label}: {counts[k] ?? 0}</span>
        ))}
        <button className="btn-secondary ml-auto" onClick={() => setSt(Object.fromEntries(students.map((s) => [s.id, "PRESENT"])))}>
          Tümü geldi
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {students.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="w-6 text-right text-xs text-slate-400">{i + 1}</span>
            <span className="w-14 font-mono text-xs text-slate-500">{s.no}</span>
            <span className="min-w-40 flex-1 font-medium">{s.name}</span>
            <div className="flex gap-1">
              {Object.entries(ATTENDANCE).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setSt({ ...st, [s.id]: k })}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${st[s.id] === k ? v.cls + " ring-2 ring-current" : "text-slate-400 ring-1 ring-slate-200 hover:text-slate-700"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </li>
        ))}
        {students.length === 0 && <li className="p-8 text-center text-sm text-slate-500">Bu sınıfta öğrenci yok.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
        {deletable && (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Bu ders ve yoklaması silinsin mi?")) return;
              await fetch(`/api/kurum/yoklama/${deletable}`, { method: "DELETE" });
              router.push(backHref);
              router.refresh();
            }}
          >
            Dersi sil
          </button>
        )}
        {msg && <span className="text-sm text-red-600">{msg}</span>}
        <button className="btn-secondary ml-auto" onClick={() => router.push(backHref)}>Vazgeç</button>
        <button className="btn-primary" disabled={busy || !students.length} onClick={save}>
          {busy ? "Kaydediliyor…" : "Yoklamayı kaydet"}
        </button>
      </div>
    </div>
  );
}
