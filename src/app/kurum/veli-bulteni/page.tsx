import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { institutionName, requireOwner } from "@/modules/identity/server";
import { isWeekStart, lastWeekStart, mondayOf, weekLabel } from "@/modules/reporting";
import { successScores, weeklyReports, weeklyTemplate } from "@/modules/reporting/server";
import WeeklyPanel from "@/modules/reporting/ui/veli/WeeklyPanel";
import { addDays, ymd } from "@/shared/date";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type SP = Promise<{ sinif?: string; hafta?: string }>;

/** Haftalık veli raporu: seçilen haftanın özetini her veliye kısa bir mesajla gönderme. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const classes = await classroomsOf(ownerId);
  const sinif = classes.find((c) => c.id === sp.sinif)?.id ?? classes[0]?.id ?? "";
  const week = isWeekStart(sp.hafta) ? sp.hafta : lastWeekStart();
  const thisWeek = mondayOf(ymd());
  const href = (q: Record<string, string>) => `/kurum/veli-bulteni?${new URLSearchParams({ sinif, hafta: week, ...q })}`;

  if (!classes.length) {
    return (
      <>
        <PageHeader title="Haftalık veli raporu" />
        <Empty>Önce sınıf ve öğrenci ekleyin.</Empty>
      </>
    );
  }

  const [rows, template, institution, scores] = await Promise.all([
    weeklyReports(ownerId, { classroomId: sinif }, week),
    weeklyTemplate(ownerId),
    institutionName(ownerId),
    successScores(ownerId, { classroomId: sinif }),
  ]);
  const riskOf = new Map(scores.rows.map((r) => [r.id, { level: r.level, reasons: r.reasons }]));
  const chip = (on: boolean) => (on ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs");

  return (
    <>
      <PageHeader
        title="Haftalık veli raporu"
        sub="Haftanın deneme, ödev ve devam özetini her veliye kısa bir mesajla gönderin. Ayrıntı için mesajda karne bağlantısı yer alır."
      />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ hafta: addDays(week, -7) })} className="btn-secondary px-2.5 py-1.5 text-xs" aria-label="Önceki hafta">‹</Link>
        <span className="min-w-[11rem] text-center text-sm font-semibold">{weekLabel(week)}</span>
        <Link
          href={href({ hafta: addDays(week, 7) })}
          className={`btn-secondary px-2.5 py-1.5 text-xs ${addDays(week, 7) > thisWeek ? "pointer-events-none opacity-40" : ""}`}
          aria-label="Sonraki hafta"
        >
          ›
        </Link>
        {week === thisWeek && <span className="text-xs text-amber-700">Bu hafta henüz bitmedi.</span>}
        <span className="ml-3 text-sm font-medium text-lead">Sınıf</span>
        {classes.map((c) => (
          <Link key={c.id} href={href({ sinif: c.id })} className={chip(c.id === sinif)}>{c.name}</Link>
        ))}
        <Link href={`/kurum/veli-karnesi/yazdir?sinif=${sinif}&bas=${week}&bit=${addDays(week, 6)}`} className="btn-secondary ml-auto px-3 py-1.5 text-xs">
          Karneleri yazdır
        </Link>
      </div>
      {rows.length === 0 ? (
        <Empty>Bu sınıfta öğrenci yok.</Empty>
      ) : (
        <WeeklyPanel
          key={`${sinif}|${week}`}
          institution={institution}
          weekStart={week}
          template={template}
          rows={rows.map((r) => ({ ...r, risk: riskOf.get(r.id) ?? null }))}
        />
      )}
    </>
  );
}
