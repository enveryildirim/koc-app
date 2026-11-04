/** Ödev durum etiketleri (istemci + sunucu güvenli). */

export const STATUS: Record<string, { label: string; cls: string; on: string }> = {
  DONE: { label: "Yaptı", cls: "bg-emerald-50 text-emerald-700", on: "bg-emerald-600 text-white ring-emerald-600" },
  PARTIAL: { label: "Eksik", cls: "bg-amber-50 text-amber-700", on: "bg-amber-500 text-white ring-amber-500" },
  NOT_DONE: { label: "Yapmadı", cls: "bg-red-50 text-red-700", on: "bg-red-600 text-white ring-red-600" },
  PENDING: { label: "Bekliyor", cls: "bg-slate-100 text-slate-600", on: "bg-slate-600 text-white ring-slate-600" },
};
export const STATUS_ORDER = ["DONE", "PARTIAL", "NOT_DONE", "PENDING"] as const;

/** Rozet için kısa biçim (STATUS ile aynı kaynak). */
export const HOMEWORK: Record<string, { label: string; cls: string }> = STATUS;
