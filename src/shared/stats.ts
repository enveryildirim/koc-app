/**
 * Uç değer (outlier) tespiti: kutu grafiği kuralı (Tukey, 1,5 × IQR).
 *
 * Neden bu kural: grubun ortadaki yarısına (1. ve 3. çeyrek) bakar, uç değerin kendisinden etkilenmez.
 * "Ortalamadan 2 standart sapma" küçük sınıflarda işe yaramaz: uç değer ortalamayı ve sapmayı kaydırıp kendini gizler.
 *
 * Uç değerler silinmez; yalnızca ortalamadan ayrılır ve ayrıca gösterilir (ekstrem durumlar takip edilir).
 */

/** Bu sayıdan az kişilik grupta tespit yapılmaz: o kadar az veriyle "uç" demek anlamsız. */
export const OUTLIER_MIN_N = 8;
/** Çeyrekler arası aralığın kaç katı dışı uç sayılır. */
export const OUTLIER_K = 1.5;

/** Sıralı dizide q. çeyrek (doğrusal ara değer; Excel'in ÇEYREK.DAHİL işleviyle aynı). */
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type Fences = { lo: number; hi: number; q1: number; q3: number };

/**
 * Alt ve üst sınır. Grup küçükse ya da sonuçların yarısından fazlası aynıysa (IQR = 0) null:
 * o durumda farklı her sonuç "uç" çıkardı, bu da yanıltıcı olur.
 */
export function tukeyFences(values: number[], k = OUTLIER_K): Fences | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < OUTLIER_MIN_N) return null;
  const q1 = quantile(v, 0.25);
  const q3 = quantile(v, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return null;
  return { lo: q1 - k * iqr, hi: q3 + k * iqr, q1, q3 };
}

export type OutlierSplit<T> = { kept: T[]; low: T[]; high: T[]; fences: Fences | null };

/** Grubu üçe ayırır: ortalamaya girenler, çok düşükler, çok yüksekler. Sınır yoksa herkes ortalamaya girer. */
export function splitOutliers<T>(items: T[], value: (t: T) => number, k = OUTLIER_K): OutlierSplit<T> {
  const fences = tukeyFences(items.map(value), k);
  if (!fences) return { kept: items, low: [], high: [], fences: null };
  const kept: T[] = [];
  const low: T[] = [];
  const high: T[] = [];
  for (const it of items) {
    const x = value(it);
    if (x < fences.lo) low.push(it);
    else if (x > fences.hi) high.push(it);
    else kept.push(it);
  }
  return { kept, low, high, fences };
}

/** Sayfa adresindeki "uc=1": uç değerleri ayır düğmesi açık mı. */
export const outliersOn = (v: string | string[] | undefined) => v === "1";
