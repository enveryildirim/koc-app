import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { schoolYearLabel, schoolYearOf, schoolYearRange } from "@/modules/planning";
import { calendarFeed } from "@/modules/planning/server";
import CalendarView, { type CalendarViewMode } from "@/modules/planning/ui/CalendarView";
import { monthGrid, ymd } from "@/shared/date";
import { PageHeader, Tabs } from "@/shared/ui/kurum";
import { PLANNING_TABS } from "@/modules/planning/ui/tabs";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ gorunum?: string; ay?: string; yil?: string; sinif?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const today = ymd();
  const view: CalendarViewMode = sp.gorunum === "yil" || sp.gorunum === "liste" ? sp.gorunum : "ay";
  const month = sp.ay && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.ay) ? sp.ay : today.slice(0, 7);
  const year = view === "ay" ? schoolYearOf(`${month}-01`) : Number(sp.yil) >= 2000 && Number(sp.yil) <= 2100 ? Number(sp.yil) : schoolYearOf(today);

  const classrooms = await classroomsOf(ownerId);
  const classroomId = classrooms.some((c) => c.id === sp.sinif) ? sp.sinif! : "";
  const grid = monthGrid(month);
  const range = view === "ay" ? { from: grid[0][0], to: grid[grid.length - 1][6] } : schoolYearRange(year);
  const items = await calendarFeed(ownerId, range, classroomId || undefined);
  const className = classrooms.find((c) => c.id === classroomId)?.name;

  return (
    <div>
      <PageHeader
        title="Yıllık Takvim"
        sub={`${schoolYearLabel(year)} eğitim yılı · ${className ? `${className} ve kurum geneli` : "tüm kurum"} · denemeler ve ödev teslimleri otomatik eklenir`}
        actions={view === "liste" ? <PrintButton /> : undefined}
      />
      <Tabs tabs={PLANNING_TABS} active="takvim" />
      <h1 className="mb-4 hidden text-xl font-bold print:block">
        {schoolYearLabel(year)} Yıllık Takvim{className ? ` — ${className}` : ""}
      </h1>
      <CalendarView
        view={view}
        month={month}
        year={year}
        today={today}
        items={items}
        classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
        classroomId={classroomId}
      />
    </div>
  );
}
