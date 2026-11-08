/** Yıllık ders planı: metinden haftalara dağıtım ve ilerleme hesabı (istemci + sunucu güvenli). */
import { addDays, dayOfWeek } from "@/shared/date";

export type PlanLine = { topic: string; weeks: number; sameWeek: boolean; unit: string };
export type PlanSlot = { order: number; topic: string; unit: string; week: string; endWeek: string };
export type Range = { start: string; end: string };

export const PLAN_HELP =
  "Her satıra bir konu yazın. Birden fazla hafta sürecekse sonuna | ve hafta sayısını ekleyin (Üslü Sayılar | 3). Önceki konuyla aynı haftada işlenecekse başına + koyun. # ile başlayan satır ünite başlığıdır (# Tecvid).";

/** Verilen günün haftasının Pazartesi'si. */
export const mondayOf = (date: string) => addDays(date, 1 - dayOfWeek(date));

/**
 * Metni satırlara ayrıştırır. Excel'den yapıştırmada sekme ayırıcısı da kabul edilir.
 * "# Ünite adı" satırı sonraki konuların ünitesini belirler ("#" tek başına üniteyi kapatır).
 */
export function parsePlan(source: string): { lines: PlanLine[]; errors: string[] } {
  const lines: PlanLine[] = [];
  const errors: string[] = [];
  let unit = "";
  source.split(/\r?\n/).forEach((raw, i) => {
    let text = raw.trim();
    if (!text) return;
    if (text.startsWith("#")) {
      unit = text.replace(/^#+/, "").trim().slice(0, 120);
      return;
    }
    const sameWeek = text.startsWith("+");
    if (sameWeek) text = text.slice(1).trim();
    const [topicPart, weeksPart] = text.split(/\s*[|\t]\s*/);
    const topic = (topicPart ?? "").trim();
    let weeks = 1;
    if (weeksPart !== undefined && weeksPart.trim() !== "") {
      weeks = Number(weeksPart.trim().replace(",", "."));
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > 20) {
        errors.push(`${i + 1}. satır: hafta sayısı 1–20 arası tam sayı olmalı.`);
        return;
      }
    }
    if (!topic) {
      errors.push(`${i + 1}. satır: konu adı boş.`);
      return;
    }
    if (sameWeek && !lines.some((l) => l.unit === unit)) {
      errors.push(`${i + 1}. satır: ${unit ? "ünitenin" : "planın"} ilk konusu "+" ile başlayamaz.`);
      return;
    }
    lines.push({ topic: topic.slice(0, 200), weeks: sameWeek ? 0 : weeks, sameWeek, unit });
  });
  return { lines, errors };
}

/** Hafta içinin (Pzt–Cum) tamamı tatilse o hafta ders haftası sayılmaz. */
export function isHolidayWeek(monday: string, holidays: Range[]) {
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    if (!holidays.some((h) => h.start <= d && d <= h.end)) return false;
  }
  return true;
}

/**
 * Konuları başlangıç haftasından itibaren sırayla ders haftalarına yerleştirir; tatil haftaları atlanır.
 * `+` ile başlayan konu önceki konunun haftalarını paylaşır.
 * `parallel`: her ünite başlangıç haftasından kendi sırasıyla ilerler (üniteler aynı haftalarda işlenir).
 */
export function layoutPlan(lines: PlanLine[], startDate: string, holidays: Range[], parallel = false): PlanSlot[] {
  const slots: PlanSlot[] = [];
  const start = mondayOf(startDate);
  /** Sıradaki boş hafta: paralelde ünite başına, değilse tek sıra */
  const nextOf = new Map<string, string>();
  const teachingWeek = (from: string) => {
    let w = from;
    for (let guard = 0; guard < 60 && isHolidayWeek(w, holidays); guard++) w = addDays(w, 7);
    return w;
  };
  lines.forEach((l, order) => {
    const lane = parallel ? l.unit : "";
    if (l.sameWeek) {
      const prev = [...slots].reverse().find((s) => s.unit === l.unit) ?? slots[slots.length - 1];
      if (prev) {
        slots.push({ order, topic: l.topic, unit: l.unit, week: prev.week, endWeek: prev.endWeek });
        return;
      }
    }
    const week = teachingWeek(nextOf.get(lane) ?? start);
    let end = week;
    for (let k = 1; k < l.weeks; k++) end = teachingWeek(addDays(end, 7));
    slots.push({ order, topic: l.topic, unit: l.unit, week, endWeek: end });
    nextOf.set(lane, addDays(end, 7));
  });
  return slots;
}

/** Plan metninde ünite başlığı var mı (paralel seçeneği yalnızca o zaman anlamlı). */
export const planUnits = (lines: PlanLine[]) => [...new Set(lines.map((l) => l.unit))].filter(Boolean);

/** Plan satırları hafta sırasıyla (paralel planlarda üniteler aynı haftada yan yana gelir). */
export const byWeek = <T extends { week: string; order: number }>(items: T[]) =>
  [...items].sort((a, b) => a.week.localeCompare(b.week) || a.order - b.order);

/** Konunun durumu bugüne göre. */
export function itemState(item: { week: string; endWeek: string; doneDate: string | null }, today: string) {
  if (item.doneDate) return "done" as const;
  const thisWeek = mondayOf(today);
  if (item.endWeek < thisWeek) return "late" as const;
  if (item.week <= thisWeek) return "current" as const;
  return "upcoming" as const;
}

/**
 * Planın ilerleme özeti. `behindWeeks`: işlenmemiş en eski konunun bitiş haftasından bu yana geçen
 * hafta sayısı (0 = plana uygun).
 */
export function planProgress(items: { week: string; endWeek: string; doneDate: string | null }[], today: string) {
  const thisWeek = mondayOf(today);
  const total = items.length;
  const done = items.filter((i) => i.doneDate).length;
  const due = items.filter((i) => i.endWeek < thisWeek).length;
  const late = items.filter((i) => !i.doneDate && i.endWeek < thisWeek);
  const oldest = late.reduce<string | null>((a, i) => (a === null || i.endWeek < a ? i.endWeek : a), null);
  const behindWeeks = oldest ? Math.round((Date.parse(thisWeek) - Date.parse(oldest)) / (7 * 86400000)) : 0;
  return { total, done, due, late: late.length, behindWeeks, rate: total ? Math.round((done / total) * 100) : 0 };
}

/** Eğitim yılı için önerilen başlangıç: 8 Eylül ve sonrasındaki ilk Pazartesi. */
export function defaultPlanStart(year: number) {
  const d = `${year}-09-08`;
  const dow = dayOfWeek(d);
  return dow === 1 ? d : addDays(d, 8 - dow);
}
