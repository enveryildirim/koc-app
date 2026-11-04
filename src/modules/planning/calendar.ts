/** Takvim türleri ve tarih yardımcıları (istemci + sunucu güvenli). */

/** Elle girilen etkinlik türleri. */
/** parentDefault: yeni etkinlikte "velilere göster" seçeneğinin varsayılanı. */
export const EVENT_KINDS: Record<string, { label: string; cls: string; dot: string; parentDefault: boolean }> = {
  HOLIDAY: { parentDefault: true, label: "Tatil", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  EXAM: { parentDefault: true, label: "Sınav / deneme planı", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-400" },
  MEETING: { parentDefault: false, label: "Toplantı", cls: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  EVENT: { parentDefault: true, label: "Etkinlik", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  OTHER: { parentDefault: false, label: "Diğer", cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

/** Diğer modüllerden otomatik gelen kayıtlar (takvimden düzenlenmez). */
export const FEED_KINDS: Record<string, { label: string; cls: string; dot: string }> = {
  DENEME: { label: "Deneme", cls: "bg-violet-600 text-white ring-violet-600", dot: "bg-violet-700" },
  ODEV: { label: "Ödev teslimi", cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
};

export const ALL_KINDS = { ...EVENT_KINDS, ...FEED_KINDS };

/** Takvimde gösterilen tek kayıt. `eventId` varsa elle girilmiş, düzenlenebilir etkinliktir. */
export type CalendarItem = {
  key: string;
  kind: string;
  title: string;
  start: string;
  end: string;
  classroomId: string | null;
  classroom: string | null;
  note: string;
  href: string | null;
  eventId: string | null;
  /** Veli karnesinde gösterilebilir mi (etkinlikte ayar; ödev ve denemede her zaman) */
  parentVisible: boolean;
  /** Ödev teslimlerinde ders adı */
  subject: string | null;
};

export const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Eğitim yılı: Eylül–Ağustos. 2026 = 2026-2027 eğitim yılı. */
export function schoolYearOf(date: string) {
  const [y, m] = date.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}

export const schoolYearRange = (year: number) => ({ from: `${year}-09-01`, to: `${year + 1}-08-31` });
export const schoolYearLabel = (year: number) => `${year}–${year + 1}`;

/** Eğitim yılının ayları sırayla: ["2026-09", …, "2027-08"]. */
export function schoolYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((8 + i) % 12) + 1;
    return `${m >= 9 ? year : year + 1}-${String(m).padStart(2, "0")}`;
  });
}

/**
 * Tarihi sabit resmî tatiller (eğitim yılına göre). Dinî bayramlar her yıl kaydığı ve
 * MEB ara tatilleri her yıl ayrıca ilan edildiği için listede yok; elle eklenir.
 */
export function nationalHolidays(year: number) {
  const n = year + 1;
  return [
    { date: `${year}-10-29`, title: "Cumhuriyet Bayramı" },
    { date: `${n}-01-01`, title: "Yılbaşı" },
    { date: `${n}-04-23`, title: "Ulusal Egemenlik ve Çocuk Bayramı" },
    { date: `${n}-05-01`, title: "Emek ve Dayanışma Günü" },
    { date: `${n}-05-19`, title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
    { date: `${n}-07-15`, title: "Demokrasi ve Millî Birlik Günü" },
    { date: `${n}-08-30`, title: "Zafer Bayramı" },
  ];
}

/** Bir kayıt verilen günü kapsıyor mu? */
export const covers = (i: { start: string; end: string }, date: string) => i.start <= date && date <= i.end;
