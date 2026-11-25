/**
 * Haftalık veli raporu — veri katmanı (sunucu).
 * Haftanın özeti mevcut veli karnesi hesabından (`parentReports`) türetilir; ParentDispatch tablosu
 * haftanın öğretmen notunu ve gönderim kaydını tutar. Gerçek gönderim (WhatsApp, kopyalama) tarayıcıda
 * kullanıcı tarafından yapılır; burada yalnızca kaydı işlenir. SMS sağlayıcısı eklendiğinde
 * `channel` için yeni bir değer ve gönderen fonksiyon eklenecek.
 */
import { prisma } from "@/shared/db";
import { invalid } from "@/shared/errors";
import { addDays, ymd } from "@/shared/date";
import type { StudentFilter } from "@/modules/enrollment/server";
import { parentReports, parentShares } from "./parentReport";
import {
  DISPATCH_CHANNELS,
  isWeekStart,
  normalizeWeeklyTemplate,
  type WeeklyDigest,
  type WeeklyTemplate,
} from "../weekly";

const TEMPLATE_KEY = "weekly";

export async function weeklyTemplate(ownerId: string): Promise<WeeklyTemplate> {
  const row = await prisma.setting.findUnique({ where: { ownerId_key: { ownerId, key: TEMPLATE_KEY } } });
  try {
    return normalizeWeeklyTemplate(row ? JSON.parse(row.value) : null);
  } catch {
    return normalizeWeeklyTemplate(null);
  }
}

/** Filtredeki öğrencilerin hafta özeti, paylaşım bilgisi ve o haftanın gönderim kaydı. */
export async function weeklyReports(ownerId: string, filter: StudentFilter, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const today = ymd();
  const horizon = addDays(today > weekEnd ? today : weekEnd, 7);
  const [reports, shares] = await Promise.all([parentReports(ownerId, filter, weekStart, weekEnd), parentShares(ownerId, filter)]);
  const dispatches = await prisma.parentDispatch.findMany({
    where: { ownerId, weekStart, studentId: { in: shares.map((s) => s.id) } },
  });
  const byStudent = new Map(dispatches.map((d) => [d.studentId, d]));
  const reportOf = new Map(reports.map((r) => [r.student.id, r]));

  return shares.map((share) => {
    const r = reportOf.get(share.id)!;
    const att = r.attendance;
    const digest: WeeklyDigest = {
      exams: r.exams.map((e) => ({ name: e.name, totalNet: e.totalNet, classAvg: e.classAvg, score: e.score })),
      assessments: r.assessments.map((a) => ({ course: a.course, title: a.title, percent: a.absent ? null : a.percent })),
      homework: { done: r.homework.counts.DONE ?? 0, partial: r.homework.counts.PARTIAL ?? 0, notDone: r.homework.counts.NOT_DONE ?? 0 },
      attendance: {
        total: att.total,
        absent: att.counts.ABSENT ?? 0,
        late: att.counts.LATE ?? 0,
        excused: att.counts.EXCUSED ?? 0,
        absentSubjects: [...new Set(att.list.filter((a) => a.status === "ABSENT").map((a) => a.subject))],
      },
      upcoming: r.upcoming.filter((u) => u.start <= horizon).map((u) => ({ title: u.title, start: u.start })),
      topics: r.topics.map((t) => ({ subject: t.subject, done: t.done.map((x) => x.topic), next: t.next.map((x) => x.topic) })),
    };
    const d = byStudent.get(share.id);
    return {
      ...share,
      digest,
      dispatch: {
        note: d?.note ?? "",
        channel: d?.channel ?? "",
        sentAt: d?.sentAt?.toISOString() ?? null,
      },
    };
  });
}

export type WeeklyRow = Awaited<ReturnType<typeof weeklyReports>>[number];

/**
 * Haftalık rapor işlemleri:
 *  - note:     { studentId, weekStart, note }               haftanın öğretmen notu
 *  - sent:     { weekStart, channel, items: [{ studentId, message }] }   gönderildi olarak işaretle
 *  - unsent:   { weekStart, studentIds }                      işareti kaldır
 *  - template: { template: { intro, outro } }                kurum şablonu
 * Başka kurumun öğrencileri sessizce atlanır.
 */
export async function updateWeekly(ownerId: string, body: Record<string, unknown>) {
  const action = body.action;
  if (action === "template") {
    const value = normalizeWeeklyTemplate(body.template);
    await prisma.setting.upsert({
      where: { ownerId_key: { ownerId, key: TEMPLATE_KEY } },
      create: { ownerId, key: TEMPLATE_KEY, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
    return { template: value };
  }

  const weekStart = body.weekStart;
  if (!isWeekStart(weekStart)) throw invalid("Hafta başlangıcı Pazartesi olan bir tarih olmalı.");
  const own = async (ids: unknown[]) => {
    const list = ids.filter((x): x is string => typeof x === "string").slice(0, 2000);
    const rows = await prisma.student.findMany({ where: { ownerId, id: { in: list } }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  };
  const upsert = (studentId: string, data: { note?: string; channel?: string; message?: string; sentAt?: Date | null }) =>
    prisma.parentDispatch.upsert({
      where: { studentId_weekStart: { studentId, weekStart } },
      create: { ownerId, studentId, weekStart, ...data },
      update: data,
    });

  if (action === "note") {
    const ids = await own([body.studentId]);
    if (!ids.size) throw invalid("Öğrenci bulunamadı.");
    const note = String(body.note ?? "").trim().slice(0, 1000);
    await upsert([...ids][0], { note });
    return { note };
  }
  if (action === "sent") {
    const channel = body.channel;
    if (typeof channel !== "string" || !(channel in DISPATCH_CHANNELS)) throw invalid("Geçersiz kanal.");
    const items = Array.isArray(body.items) ? (body.items as { studentId?: unknown; message?: unknown }[]) : [];
    const ids = await own(items.map((i) => i?.studentId));
    const sentAt = new Date();
    for (const i of items) {
      if (typeof i?.studentId !== "string" || !ids.has(i.studentId)) continue;
      await upsert(i.studentId, { channel, message: String(i.message ?? "").slice(0, 5000), sentAt });
    }
    return { sentAt: sentAt.toISOString(), count: ids.size };
  }
  if (action === "unsent") {
    const ids = await own(Array.isArray(body.studentIds) ? body.studentIds : []);
    await prisma.parentDispatch.updateMany({ where: { ownerId, weekStart, studentId: { in: [...ids] } }, data: { sentAt: null, channel: "" } });
    return { count: ids.size };
  }
  throw invalid("Geçersiz işlem.");
}
