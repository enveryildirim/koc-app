/** assessment — sözlü / yazılı / uygulama değerlendirmesi ve puan cetvelleri (istemci + sunucu güvenli). */

export type Criterion = { name: string; max: number };

export const ASSESSMENT_TYPES: Record<string, { label: string; short: string }> = {
  ORAL: { label: "Sözlü", short: "Sözlü" },
  WRITTEN: { label: "Yazılı", short: "Yazılı" },
  PRACTICE: { label: "Uygulama / proje", short: "Uygulama" },
};
export const ASSESSMENT_TYPE_KEYS = Object.keys(ASSESSMENT_TYPES);

/** Yöneticinin tek dokunuşla ekleyebileceği örnek cetveller. Kurum değiştirebilir. */
export const RUBRIC_PRESETS: { name: string; kind: string; criteria: Criterion[] }[] = [
  { name: "Kur'an okuma", kind: "RELIGIOUS", criteria: [{ name: "Mahreç", max: 30 }, { name: "Tecvid", max: 30 }, { name: "Akıcılık", max: 20 }, { name: "Adab", max: 20 }] },
  { name: "Ezber", kind: "RELIGIOUS", criteria: [{ name: "Doğruluk", max: 60 }, { name: "Akıcılık", max: 20 }, { name: "Tecvid", max: 20 }] },
  { name: "Bilgi sözlüsü", kind: "", criteria: [{ name: "Bilgi", max: 70 }, { name: "İfade", max: 30 }] },
  { name: "Proje / uygulama", kind: "VOCATIONAL", criteria: [{ name: "Tasarım", max: 30 }, { name: "Uygulama", max: 40 }, { name: "Sunum", max: 30 }] },
  { name: "Yazılı (100 puan)", kind: "", criteria: [{ name: "Puan", max: 100 }] },
];

/** Kriter listesini doğrular: 1–8 kriter, ad dolu, en yüksek puan 1–100 tam sayı. Hatalıysa mesaj, değilse null. */
export function criteriaError(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return "En az bir kriter girin.";
  if (list.length > 8) return "En fazla 8 kriter olabilir.";
  for (const c of list) {
    const name = String((c as Criterion)?.name ?? "").trim();
    const max = Number((c as Criterion)?.max);
    if (!name) return "Kriter adı boş olamaz.";
    if (!Number.isInteger(max) || max < 1 || max > 100) return `“${name}” için en yüksek puan 1–100 arası tam sayı olmalı.`;
  }
  return null;
}

export function parseCriteria(json: string): Criterion[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((c) => ({ name: String(c.name), max: Number(c.max) })) : [];
  } catch {
    return [];
  }
}

export const maxTotalOf = (c: Criterion[]) => c.reduce((s, x) => s + x.max, 0);

/** Telefonda hızlı giriş düğmeleri: küçük ölçekte bütün değerler, büyükte beş basamak. */
export function quickValues(max: number) {
  if (max <= 10) return Array.from({ length: max + 1 }, (_, i) => i);
  return [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
}

/** Yüzde etiketinin rengi (takibat ekranlarında ortak). */
export function percentTone(p: number | null | undefined) {
  if (p === null || p === undefined) return "text-lead";
  if (p >= 85) return "text-emerald-700";
  if (p >= 70) return "text-graphite";
  if (p >= 50) return "text-amber-700";
  return "text-red-700";
}

export const fmtPercent = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `%${Math.round(p)}`);
