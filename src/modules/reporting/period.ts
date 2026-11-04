/** Rapor dönemleri (YYYY-MM-DD) — istemci + sunucu güvenli. */

/** Varsayılan dönem: son 30 gün (YYYY-MM-DD). */
export function defaultPeriod() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 86400000);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: f(from), to: f(to) };
}

/** Geçersiz/eksik tarihleri varsayılana çeker; from > to ise yer değiştirir. */
export function normalizePeriod(from?: string, to?: string) {
  const d = defaultPeriod();
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  let f = ok(from) ? from! : d.from;
  let t = ok(to) ? to! : d.to;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}
