/**
 * Haftalık veli raporu — saf fonksiyonlar (istemci + sunucu güvenli).
 * Sunucu her öğrenci için haftanın özetini (`WeeklyDigest`) hazırlar; mesaj metni burada,
 * kurumun şablonu ve haftanın öğretmen notuyla birleştirilerek üretilir. Not yazılırken
 * önizleme tarayıcıda aynı fonksiyonla güncellenir.
 */
import { addDays, dayOfWeek, ymd } from "@/shared/date";
import { fmtNet } from "@/modules/exams";

export type WeeklyDigest = {
  exams: { name: string; totalNet: number; classAvg: number; score: number }[];
  /** Sözlü / yazılı / uygulama notları (yüzde; gelmediyse null). Eski kayıtlarda olmayabilir. */
  assessments?: { course: string; title: string; percent: number | null }[];
  homework: { done: number; partial: number; notDone: number };
  attendance: { total: number; absent: number; late: number; excused: number; absentSubjects: string[] };
  /** Rapor gününden sonraki 7 gün içinde velilere açık takvim kayıtları. */
  upcoming: { title: string; start: string }[];
};

export type WeeklyTemplate = { intro: string; outro: string };

/** Yer tutucular: {veli}, {ogrenci}, {hafta}, {kurum}. */
export const DEFAULT_WEEKLY_TEMPLATE: WeeklyTemplate = {
  intro: "Sayın {veli}, {ogrenci} için {hafta} haftasının özeti:",
  outro: "İyi haftalar dileriz.\n{kurum}",
};

export const DISPATCH_CHANNELS = {
  WHATSAPP: "WhatsApp",
  COPY: "Kopyalandı",
  PRINT: "Basılı",
} as const;
export type DispatchChannel = keyof typeof DISPATCH_CHANNELS;

/** Tarihin haftasının Pazartesi'si. */
export const mondayOf = (date: string) => addDays(date, 1 - dayOfWeek(date));

/** Varsayılan rapor haftası: içinde bulunulan haftadan önceki (tamamlanmış) hafta. */
export const lastWeekStart = (today = ymd()) => addDays(mondayOf(today), -7);

export const isWeekStart = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && dayOfWeek(s) === 1;

const dm = (d: string, month: "long" | "short" = "long") => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month });

/** "28 Ekim – 3 Kasım" */
export function weekLabel(weekStart: string) {
  return `${dm(weekStart)} – ${dm(addDays(weekStart, 6))}`;
}

/** Özetin madde satırları (başında "• "). */
export function weeklyLines(d: WeeklyDigest): string[] {
  const lines: string[] = [];
  for (const e of d.exams) {
    lines.push(`• ${e.name}: ${fmtNet(e.totalNet)} net (sınıf ortalaması ${fmtNet(e.classAvg)})${e.score > 0 ? `, tahmini puan ${fmtNet(e.score)}` : ""}`);
  }
  for (const a of d.assessments ?? []) {
    lines.push(`• ${a.course} (${a.title}): ${a.percent === null ? "gelmedi" : `%${Math.round(a.percent)}`}`);
  }
  const h = d.homework;
  const graded = h.done + h.partial + h.notDone;
  if (graded === 1) {
    lines.push(`• Ödev: verilen ödev ${h.done ? "yapıldı" : h.partial ? "eksik yapıldı" : "yapılmadı"}.`);
  } else if (graded && h.done === graded) {
    lines.push(`• Ödevler: verilen ${graded} ödevin hepsi yapıldı.`);
  } else if (graded) {
    lines.push(
      `• Ödevler: ${graded} ödevden ${h.done} tanesi yapıldı` +
        (h.partial ? `, ${h.partial} eksik` : "") +
        (h.notDone ? `, ${h.notDone} yapılmadı` : ""),
    );
  }
  const a = d.attendance;
  if (a.total) {
    if (!a.absent && !a.late) lines.push(`• Devam: bütün derslere katıldı${a.excused ? ` (${a.excused} ders izinli)` : ""}.`);
    else {
      const parts = [];
      if (a.absent) parts.push(`${a.absent} derse gelmedi${a.absentSubjects.length ? ` (${a.absentSubjects.join(", ")})` : ""}`);
      if (a.late) parts.push(`${a.late} derse geç kaldı`);
      if (a.excused) parts.push(`${a.excused} ders izinli`);
      lines.push(`• Devam: ${parts.join(", ")}.`);
    }
  }
  if (!lines.length) lines.push("• Bu hafta deneme, sözlü/yazılı, ödev ve yoklama kaydı yok.");
  if (d.upcoming.length) {
    lines.push(`• Önümüzdeki günlerde: ${d.upcoming.map((u) => `${u.title} (${dm(u.start, "short")})`).join(", ")}`);
  }
  return lines;
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(veli|ogrenci|hafta|kurum)\}/g, (_, k: string) => v[k] ?? "");

export function weeklyMessage(p: {
  digest: WeeklyDigest;
  template: WeeklyTemplate;
  weekStart: string;
  studentName: string;
  parentName: string;
  institution: string;
  note: string;
  url: string | null;
}) {
  const vars = { veli: p.parentName || "Velimiz", ogrenci: p.studentName, hafta: weekLabel(p.weekStart), kurum: p.institution };
  const parts = [fill(p.template.intro, vars).trim(), weeklyLines(p.digest).join("\n")];
  if (p.note.trim()) parts.push(`Öğretmen notu: ${p.note.trim()}`);
  if (p.url) parts.push(`Ayrıntılı karne: ${p.url}`);
  const outro = fill(p.template.outro, vars).trim();
  if (outro) parts.push(outro);
  return parts.filter(Boolean).join("\n\n");
}

export function normalizeWeeklyTemplate(raw: unknown): WeeklyTemplate {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<WeeklyTemplate>;
  const str = (v: unknown, def: string) => (typeof v === "string" ? v.slice(0, 500) : def);
  return { intro: str(o.intro, DEFAULT_WEEKLY_TEMPLATE.intro), outro: str(o.outro, DEFAULT_WEEKLY_TEMPLATE.outro) };
}
