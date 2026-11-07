"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE } from "../labels";

type Stu = { id: string; no: string; name: string; guest?: string | null };

const OTHER = ["LATE", "EXCUSED"] as const;

/**
 * Telefon için yoklama: herkes "Geldi" varsayılır. Satıra dokunmak Geldi ↔ Gelmedi değiştirir;
 * Geç ve İzinli sağdaki küçük düğmelerle seçilir. Kaydet düğmesi ekranın altında sabit durur.
 */
export default function QuickAttendance({
  students,
  initial,
  target,
  date,
  doneHref,
}: {
  students: Stu[];
  initial: Record<string, string>;
  target: { slotId?: string; sessionId?: string };
  date: string;
  doneHref: string;
}) {
  const router = useRouter();
  const [st, setSt] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, initial[s.id] ?? "PRESENT"])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const absent = Object.values(st).filter((v) => v === "ABSENT").length;
  const other = Object.values(st).filter((v) => v === "LATE" || v === "EXCUSED").length;

  const set = (id: string, v: string) => setSt((p) => ({ ...p, [id]: p[id] === v ? "PRESENT" : v }));

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/kurum/yoklama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, date, statuses: st }),
    });
    setBusy(false);
    if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
    router.push(doneHref);
    router.refresh();
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-rule/70 px-3.5 py-2.5">
        <h2 className="font-semibold">Yoklama</h2>
        <span className="text-[13px] text-lead">Gelmeyene dokunun</span>
      </div>
      <ul className="divide-y divide-rule/70">
        {students.map((s) => {
          const v = st[s.id];
          return (
            <li key={s.id} className={`flex items-stretch ${v === "ABSENT" ? "bg-red-50" : ""}`}>
              <button className="min-w-0 flex-1 px-3.5 py-3 text-left active:bg-paper" onClick={() => set(s.id, "ABSENT")}>
                <span className={`block font-medium ${v === "ABSENT" ? "text-red-700 line-through decoration-red-300" : ""}`}>{s.name}</span>
                <span className="text-[12.5px] text-lead">
                  <span className="num">{s.no}</span>
                  {s.guest && <span> · {s.guest}</span>}
                  {v !== "PRESENT" && <span className="font-semibold"> · {ATTENDANCE[v]?.label}</span>}
                </span>
              </button>
              <div className="flex items-center gap-1 pr-2.5">
                {OTHER.map((k) => (
                  <button
                    key={k}
                    onClick={() => set(s.id, k)}
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold ${v === k ? ATTENDANCE[k].cls + " ring-2 ring-current" : "text-lead ring-1 ring-rule"}`}
                  >
                    {k === "LATE" ? "Geç" : "İzinli"}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
        {students.length === 0 && <li className="p-6 text-center text-sm text-lead">Bu sınıfta öğrenci yok.</li>}
      </ul>
      <div className="sticky bottom-0 flex items-center gap-3 rounded-b-lg border-t border-rule bg-surface px-3.5 py-3">
        <span className="text-sm text-lead">
          <span className="num font-semibold text-graphite">{students.length - absent - other}</span> geldi
          {absent > 0 && <>, <span className="num font-semibold text-red-700">{absent}</span> gelmedi</>}
          {other > 0 && <>, <span className="num">{other}</span> geç/izinli</>}
        </span>
        {msg && <span className="text-sm text-red-600">{msg}</span>}
        <button className="btn-primary ml-auto px-5 py-2.5" disabled={busy || !students.length} onClick={save}>
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </section>
  );
}
