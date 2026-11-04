/** Tarih yardımcıları (istemci + sunucu güvenli). */

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
