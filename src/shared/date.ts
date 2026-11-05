/** Tarih yardımcıları (istemci + sunucu güvenli). */

/**
 * Uygulamanın saat dilimi. Sunucu instrumentation.ts ile bu dilimde çalışır; tarayıcıda biçimlendirilen
 * anlık zamanlar (createdAt gibi) da bu dilimle gösterilir. Böylece sunucu ve tarayıcı aynı metni üretir.
 */
export const APP_TIME_ZONE = "Europe/Istanbul";

/** Anlık zamanı (ISO / Date) uygulama saat diliminde "gg.aa.yyyy ss:dd:sn" biçiminde gösterir. */
export function fmtDateTime(d: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(d).toLocaleString("tr-TR", { timeZone: APP_TIME_ZONE, ...opts });
}

/** Yerel saat diliminde YYYY-MM-DD */
export function ymd(d: Date | string = new Date()) {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

/** Date → YYYY-MM-DD (form input değeri için; ymd ile aynı). */
export const toInputDate = (d: Date | string) => ymd(d);

/** YYYY-MM-DD için 1 = Pazartesi … 7 = Pazar */
export function dayOfWeek(date: string) {
  const d = new Date(date + "T12:00:00");
  return ((d.getDay() + 6) % 7) + 1;
}

/** YYYY-MM-DD tarihine gün ekler (yerel saat; yaz saati kaymasından etkilenmez). */
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Ayın takvim ızgarası: Pazartesi ile başlayan tam haftalar (YYYY-MM-DD dizileri). month = "YYYY-MM" */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, 1 - dayOfWeek(first));
  const weeks: string[][] = [];
  for (let d = start; weeks.length < 6; ) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(d, i));
    if (weeks.length > 0 && !week[0].startsWith(month)) break;
    weeks.push(week);
    d = addDays(d, 7);
  }
  return weeks;
}

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (month: string) =>
  new Date(month + "-01T12:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
