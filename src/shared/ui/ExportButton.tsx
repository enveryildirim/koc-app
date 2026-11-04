"use client";
import { useState } from "react";

export type ExportCell = string | number | null;

/**
 * Tabloyu Excel (.xlsx) olarak indirir. Sunucu bileşenleri başlık + satırları düz veri olarak verir.
 * Sayılar Excel'de sayı olarak kalır (toplama/sıralama yapılabilir).
 */
export default function ExportButton({
  fileName,
  headers,
  rows,
  label = "⬇ Excel'e aktar",
  sheet = "Rapor",
}: {
  fileName: string;
  headers: string[];
  rows: ExportCell[][];
  label?: string;
  sheet?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file");
      const head = headers.map((h) => ({ value: h, fontWeight: "bold" as const, backgroundColor: "#E5EDFF" }));
      const body = rows.map((r) =>
        r.map((c) => (c === null || c === "" ? null : typeof c === "number" ? { type: Number, value: c } : { type: String, value: String(c) })),
      );
      const safe = fileName.replace(/[\\/:*?"<>|]+/g, "_");
      await writeXlsxFile([head, ...body], {
        fileName: safe.endsWith(".xlsx") ? safe : `${safe}.xlsx`,
        sheet: sheet.slice(0, 31),
        columns: headers.map((h, i) => ({
          width: Math.min(40, Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))),
        })),
      });
    } catch (e) {
      alert("Excel dosyası oluşturulamadı: " + (e instanceof Error ? e.message : ""));
    }
    setBusy(false);
  }
  return (
    <button className="btn-secondary no-print" disabled={busy || rows.length === 0} onClick={run}>
      {busy ? "Hazırlanıyor…" : label}
    </button>
  );
}
