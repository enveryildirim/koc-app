"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, STATUS_ORDER } from "./labels";

type Row = { studentId: string; studentNo: string; name: string; status: string; note: string };
type SaveState = "idle" | "saving" | "saved" | "error";

/** Öğrenci durumları: her değişiklik anında kaydedilir; satır yanında kayıt durumu görünür. */
export default function StatusEditor({ homeworkId, rows: initial }: { homeworkId: string; rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [state, setState] = useState<Record<string, SaveState>>({});
  const [bulk, setBulk] = useState<SaveState>("idle");

  const counts = useMemo(() => {
    const c: Record<string, number> = { DONE: 0, PARTIAL: 0, NOT_DONE: 0, PENDING: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  async function send(updates: { studentId: string; status?: string; note?: string }[]) {
    const res = await fetch(`/api/kurum/odevler/${homeworkId}/durum`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    return res.ok;
  }

  async function update(studentId: string, patch: { status?: string; note?: string }) {
    setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r)));
    setState((s) => ({ ...s, [studentId]: "saving" }));
    const ok = await send([{ studentId, ...patch }]);
    setState((s) => ({ ...s, [studentId]: ok ? "saved" : "error" }));
    if (ok) router.refresh();
  }

  async function markAll(status: string) {
    const prev = rows;
    setRows((rs) => rs.map((r) => ({ ...r, status })));
    setBulk("saving");
    const ok = await send(rows.map((r) => ({ studentId: r.studentId, status })));
    setBulk(ok ? "saved" : "error");
    if (!ok) setRows(prev);
    else {
      setState({});
      router.refresh();
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        {STATUS_ORDER.map((s) => (
          <span key={s} className={`badge px-3 py-1 text-sm ${STATUS[s].cls}`}>
            {STATUS[s].label}: <b className="ml-1">{counts[s]}</b>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {bulk === "saving" ? "Kaydediliyor…" : bulk === "saved" ? "Toplu işlem kaydedildi ✓" : bulk === "error" ? "Toplu işlem kaydedilemedi" : "Değişiklikler anında kaydedilir"}
          </span>
          <button className="btn-secondary py-1.5" onClick={() => markAll("DONE")} disabled={bulk === "saving"}>
            ✓ Tümünü “Yaptı” işaretle
          </button>
          <button className="btn-secondary py-1.5" onClick={() => markAll("PENDING")} disabled={bulk === "saving"}>
            Sıfırla
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Öğrenci</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Durum</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Not</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.studentNo}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => r.status !== s && update(r.studentId, { status: s })}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${r.status === s ? STATUS[s].on : "text-slate-500 ring-slate-200 hover:bg-slate-50"}`}
                      >
                        {STATUS[s].label}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <NoteInput value={r.note} onSave={(note) => update(r.studentId, { note })} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {state[r.studentId] === "saving" && <span className="text-slate-400">Kaydediliyor…</span>}
                  {state[r.studentId] === "saved" && <span className="text-emerald-600">Kaydedildi ✓</span>}
                  {state[r.studentId] === "error" && <span className="text-red-600">Hata!</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoteInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      className="input py-1 text-xs"
      placeholder="Not ekle…"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
