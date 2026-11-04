/** Ödev durum etiketleri (istemci + sunucu güvenli). */

export const STATUS: Record<string, { label: string; cls: string; on: string }> = {
  DONE: { label: "Yaptı", cls: "bg-emerald-50 text-emerald-700", on: "bg-emerald-600 text-white ring-emerald-600" },
  PARTIAL: { label: "Eksik", cls: "bg-amber-50 text-amber-700", on: "bg-amber-500 text-white ring-amber-500" },
  NOT_DONE: { label: "Yapmadı", cls: "bg-red-50 text-red-700", on: "bg-red-600 text-white ring-red-600" },
  PENDING: { label: "Bekliyor", cls: "bg-mist text-lead", on: "bg-slate-600 text-white ring-slate-600" },
};
export const STATUS_ORDER = ["DONE", "PARTIAL", "NOT_DONE", "PENDING"] as const;

/** Rozet için kısa biçim (STATUS ile aynı kaynak). */
export const HOMEWORK: Record<string, { label: string; cls: string }> = STATUS;

/** Öğrenci durumlarının dağılımı; `total` tüm kayıtlar. */
export type StatusCounts = { DONE: number; PARTIAL: number; NOT_DONE: number; PENDING: number; total: number };

export const emptyCounts = (): StatusCounts => ({ DONE: 0, PARTIAL: 0, NOT_DONE: 0, PENDING: 0, total: 0 });

/** Bir durumu sayaca ekler. */
export function tally(c: StatusCounts, status: string) {
  c.total++;
  if (status === "DONE" || status === "PARTIAL" || status === "NOT_DONE" || status === "PENDING") c[status]++;
  return c;
}

export const countStatuses = (statuses: { status: string }[]) => statuses.reduce((c, s) => tally(c, s.status), emptyCounts());

/** Yapma oranı (%) = Yaptı / (Yaptı + Eksik + Yapmadı); "Bekliyor" orana katılmaz. Değerlendirme yoksa null. */
export function doneRate(c: Pick<StatusCounts, "DONE" | "PARTIAL" | "NOT_DONE">) {
  const evaluated = c.DONE + c.PARTIAL + c.NOT_DONE;
  return evaluated ? Math.round((c.DONE / evaluated) * 100) : null;
}
