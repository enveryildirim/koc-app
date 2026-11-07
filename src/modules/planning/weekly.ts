/**
 * Haftalık plan içe aktarma (istemci + sunucu güvenli, saf fonksiyonlar).
 *
 * Tablo: ilk sütun hafta (tarih), diğer sütunlar dersler; hücre = o hafta işlenecek konu.
 *  - Her ders sütunu bir yıllık plana dönüşür (mevcut "Konu | hafta" metin biçimi).
 *  - Art arda aynı konu tek konu sayılır (ör. iki hafta "Maharic-i huruf" → "Maharic-i huruf | 2").
 *  - Boş hücre önceki konunun süresini bir hafta uzatır; böylece tarihler tablodakiyle aynı kalır.
 *  - Bütün ders hücreleri boş ya da "izin / tatil" yazan satır izin haftasıdır: takvime tatil olarak eklenir,
 *    plan dağıtımı tatil haftalarını zaten atladığı için sayılmaz.
 */
import { addDays } from "@/shared/date";
import { mondayOf } from "./plan";

const MONTHS = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
/** "izin", "izni", "tatil", "tatili" … (Türkçe ekler; \b Türkçe harflerde güvenilir değil) */
const IZIN = /(^|[\s(])(izin|izni|tatil)/i;

/** "2025-09-08", "08.09.2025", "8/9/2025", "8 Eylül 2025" ya da Excel tarihi → YYYY-MM-DD; tanınmazsa null. */
export function parseWeekDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return fmt(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[2]);
    if (mi >= 0) return fmt(+m[3], mi + 1, +m[1]);
  }
  return null;
}

function fmt(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}`;
}

/** Hücre metni: satır sonları ve çoklu boşluk tek boşluk; plan metnini bozan "|", sekme ve baştaki "+" temizlenir. */
export function cleanCell(v: unknown) {
  return String(v ?? "")
    .replace(/[\t|]/g, " / ")
    .replace(/\s+/g, " ")
    .replace(/^\+\s*/, "")
    .trim()
    .slice(0, 200);
}

export type WeekRow = { monday: string; label: string; cells: string[]; izin: boolean };
export type WeeklyTable = { subjects: string[]; weeks: WeekRow[]; errors: string[] };

/** Ham tabloyu (ilk satır başlık) haftalara çevirir. Tarihi okunamayan satırlar hata olarak bildirilir. */
export function parseWeeklyTable(table: unknown[][]): WeeklyTable {
  const errors: string[] = [];
  const rows = table.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (rows.length < 2) return { subjects: [], weeks: [], errors: ["Tabloda başlık ve en az bir hafta satırı olmalı."] };
  const header = rows[0].map((c) => cleanCell(c));
  const cols = header.map((h, i) => ({ h, i })).filter((x) => x.i > 0 && x.h);
  if (!cols.length) errors.push("Başlık satırında ders sütunu yok (ilk sütun hafta, sonrakiler ders adları).");
  const weeks: WeekRow[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, k) => {
    const date = parseWeekDate(r[0]);
    if (!date) {
      errors.push(`${k + 2}. satır: hafta tarihi okunamadı (“${String(r[0] ?? "").slice(0, 30)}”).`);
      return;
    }
    const monday = mondayOf(date);
    if (seen.has(monday)) {
      errors.push(`${k + 2}. satır: aynı hafta iki kez var (${monday}).`);
      return;
    }
    seen.add(monday);
    const cells = cols.map((c) => cleanCell(r[c.i]));
    const label = cleanCell(r[0]);
    const izin = cells.every((c) => !c || IZIN.test(c)) || (IZIN.test(label) && cells.every((c) => !c));
    // İzin satırının etiketi: hücredeki açıklama ("Yaz talebe izni"), yoksa hafta sütunu
    weeks.push({ monday, label: izin ? cells.find(Boolean) || label : label, cells: izin ? cells.map(() => "") : cells, izin });
  });
  weeks.sort((a, b) => a.monday.localeCompare(b.monday));
  return { subjects: cols.map((c) => c.h), weeks, errors };
}

export type SubjectPlan = { subject: string; startDate: string; source: string; topics: number; weeks: number };

/**
 * Her ders için plan metni. İzin haftaları sayılmaz (takvimde tatil olacak). Dersin ilk dolu haftasından başlar;
 * aradaki boş haftalar önceki konuya eklenir. Hiç konusu olmayan ders atlanır.
 */
export function buildSubjectPlans(t: WeeklyTable): SubjectPlan[] {
  const teach = t.weeks.filter((w) => !w.izin);
  return t.subjects
    .map((subject, si) => {
      const lines: { topic: string; weeks: number }[] = [];
      let start = "";
      for (const w of teach) {
        const c = w.cells[si];
        if (!lines.length) {
          if (!c) continue;
          start = w.monday;
          lines.push({ topic: c, weeks: 1 });
          continue;
        }
        const last = lines[lines.length - 1];
        if (!c || c === last.topic) last.weeks++;
        else lines.push({ topic: c, weeks: 1 });
      }
      // Sondaki boş haftalar plana eklenmez (dersin son konusu son dolu haftada biter)
      const lastFilled = [...teach].reverse().find((w) => w.cells[si]);
      if (lines.length && lastFilled) {
        const after = teach.filter((w) => w.monday > lastFilled.monday).length;
        const tail = lines[lines.length - 1];
        tail.weeks = Math.max(1, tail.weeks - after);
      }
      return {
        subject,
        startDate: start,
        source: lines.map((l) => (l.weeks > 1 ? `${l.topic} | ${Math.min(l.weeks, 20)}` : l.topic)).join("\n"),
        topics: lines.length,
        weeks: lines.reduce((a, l) => a + l.weeks, 0),
      };
    })
    .filter((p) => p.topics > 0);
}

/** İzin haftalarının Pazartesi–Pazar aralıkları (takvime tatil olarak eklenecek). */
export function izinRanges(t: WeeklyTable) {
  return t.weeks.filter((w) => w.izin).map((w) => ({ start: w.monday, end: addDays(w.monday, 6), label: w.label }));
}

/** Basit ayraçlı metin (sekme, noktalı virgül ya da virgül) → tablo. Excel'den yapıştırma sekmeli gelir. */
export function parseDelimitedTable(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
}
