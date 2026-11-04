"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  name: string;
  studentNo: string;
  source: string;
  score: number;
  maxScore: number;
  finishedAt: string | null;
  durationMin: number | null;
};

export default function AttemptsTable({ rows, passPercent, testTitle }: { rows: Row[]; passPercent: number; testTitle: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("ALL");
  const [sort, setSort] = useState<"date" | "score" | "name">("date");

  const pct = (r: Row) => (r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0);
  const shown = useMemo(() => {
    const f = rows.filter(
      (r) =>
        (source === "ALL" || r.source === source) &&
        (r.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")) || r.studentNo.includes(q)),
    );
    return f.sort((a, b) =>
      sort === "score" ? pct(b) - pct(a) : sort === "name" ? a.name.localeCompare(b.name, "tr") : (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""),
    );
  }, [rows, q, source, sort]);

  function exportCsv() {
    const head = ["Ad Soyad", "Öğrenci No", "Kaynak", "Puan", "Maks. Puan", "Yüzde", "Durum", "Tarih"];
    const lines = shown.map((r) => [
      r.name,
      r.studentNo,
      r.source === "OMR" ? "Optik form" : "Online",
      r.score,
      r.maxScore,
      pct(r),
      pct(r) >= passPercent ? "Geçti" : "Kaldı",
      r.finishedAt ? new Date(r.finishedAt).toLocaleString("tr-TR") : "",
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${testTitle.replace(/[^\p{L}\p{N}]+/gu, "_")}_sonuclar.csv`;
    a.click();
  }

  async function del(id: string) {
    if (!confirm("Bu katılım silinsin mi?")) return;
    await fetch(`/api/attempts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        <input className="input max-w-xs" placeholder="Ad veya numara ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="ALL">Tüm kaynaklar</option>
          <option value="ONLINE">Online</option>
          <option value="OMR">Optik form</option>
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="date">Tarihe göre</option>
          <option value="score">Puana göre</option>
          <option value="name">Ada göre</option>
        </select>
        <button className="btn-secondary ml-auto" onClick={exportCsv}>⬇ CSV indir</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Katılımcı</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Puan</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Süre</th>
              <th className="px-4 py-3">Tarih</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/sonuc/${r.id}`} className="font-medium hover:text-brand-600">{r.name}</Link>
                  {r.studentNo && <div className="text-xs text-slate-400">No: {r.studentNo}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${r.source === "OMR" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>
                    {r.source === "OMR" ? "Optik form" : "Online"}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {r.score}/{r.maxScore} <span className="font-normal text-slate-500">(%{pct(r)})</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${pct(r) >= passPercent ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {pct(r) >= passPercent ? "Geçti" : "Kaldı"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{r.source === "OMR" || r.durationMin === null ? "—" : `${r.durationMin} dk`}</td>
                <td className="px-4 py-3 text-slate-500">{r.finishedAt ? new Date(r.finishedAt).toLocaleString("tr-TR") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-slate-400 hover:text-red-600" title="Sil" onClick={() => del(r.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
