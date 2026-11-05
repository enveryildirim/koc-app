import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { countStatuses, doneRate } from "@/modules/homework";
import { listHomework } from "@/modules/homework/server";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";
import FilterBar from "@/modules/homework/ui/FilterBar";
import NewHomework from "@/modules/homework/ui/NewHomework";
import { ODEV_TABS } from "@/modules/homework/ui/tabs";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

export default async function Page({ searchParams }: { searchParams: Promise<{ sinif?: string; ders?: string }> }) {
  const ownerId = await requireOwner();
  const { sinif, ders } = await searchParams;
  const classrooms = await classroomsOf(ownerId);

  const all = await listHomework(ownerId);
  const subjects = [...new Set(all.map((h) => h.subject))].sort((a, b) => a.localeCompare(b, "tr"));
  const list = all.filter((h) => (!sinif || h.classroomId === sinif) && (!ders || h.subject === ders));

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(startToday);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const active = list.filter((h) => h.dueDate >= startToday).length;
  const thisWeek = list.filter((h) => h.dueDate >= monday && h.dueDate < nextMonday).length;
  const rate = doneRate(countStatuses(list.flatMap((h) => h.statuses)));

  return (
    <div>
      <PageHeader title="Ödev takibi" sub="Sınıflara ödev verin, öğrenci bazında yapılma durumunu izleyin." />
      <Tabs tabs={ODEV_TABS} active="list" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Kpi label="Aktif ödev" value={active} hint="Teslim tarihi geçmemiş" />
        <Kpi label="Ortalama yapma oranı" value={rate === null ? "–" : `%${rate}`} hint="Değerlendirilen öğrenci durumları" />
        <Kpi label="Bu hafta teslim" value={thisWeek} />
      </div>

      <NewHomework classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))} subjects={subjects} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Ödevler <span className="font-normal text-lead">({list.length})</span></h2>
        <FilterBar
          filters={[
            { name: "sinif", label: "Sınıf", options: [{ value: "", label: "Tüm sınıflar" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))] },
            { name: "ders", label: "Ders", options: [{ value: "", label: "Tüm dersler" }, ...subjects.map((s) => ({ value: s, label: s }))] },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty>Bu filtreye uygun ödev yok.</Empty>
      ) : (
        <>
        {/* Telefonda kart listesi: başlık önde, tarih ve durum altında. */}
        <ul className="card divide-y divide-rule/70 sm:hidden">
          {list.map((h) => {
            const c = countStatuses(h.statuses);
            const overdue = h.dueDate < startToday;
            return (
              <li key={h.id}>
                <Link href={`/kurum/odevler/${h.id}`} className="block px-3.5 py-3 active:bg-paper">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{h.title}</span>
                    <span className={`badge shrink-0 bg-mist ${overdue ? "text-lead" : "text-graphite"}`}>{overdue ? "Süresi doldu" : "Aktif"}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-lead">
                    <b className="font-semibold text-graphite">{h.classroom.name}</b> {h.subject}, teslim {fmt(h.dueDate)}
                  </div>
                  <div className="mt-2">
                    <StatusBar c={c} total={c.total || 1} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={th}>Ders</th>
                <th className={th}>Başlık</th>
                <th className={th}>Veriliş</th>
                <th className={th}>Teslim</th>
                <th className={th}>Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {list.map((h) => {
                const c = countStatuses(h.statuses);
                const total = c.total || 1;
                const overdue = h.dueDate < startToday;
                return (
                  <tr key={h.id} className="hover:bg-paper">
                    <td className={`${td} font-semibold`}>{h.classroom.name}</td>
                    <td className={td}>{h.subject}</td>
                    <td className={td}>
                      <Link href={`/kurum/odevler/${h.id}`} className="font-medium hover:text-brand-600">{h.title}</Link>
                    </td>
                    <td className={`${td} whitespace-nowrap text-lead`}>{fmt(h.assignedAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {fmt(h.dueDate)}{" "}
                      <span className={`badge ml-1 ${overdue ? "bg-mist text-lead" : "bg-mist text-graphite"}`}>
                        {overdue ? "Süresi doldu" : "Aktif"}
                      </span>
                    </td>
                    <td className={`${td} min-w-56`}>
                      <StatusBar c={c} total={total} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function StatusBar({ c, total }: { c: ReturnType<typeof countStatuses>; total: number }) {
  return (
    <>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-mist" title={`Yaptı ${c.DONE} · Eksik ${c.PARTIAL} · Yapmadı ${c.NOT_DONE} · Bekliyor ${c.PENDING}`}>
        <div className="bg-emerald-600/70" style={{ width: `${(c.DONE / total) * 100}%` }} />
        <div className="bg-amber-500/70" style={{ width: `${(c.PARTIAL / total) * 100}%` }} />
        <div className="bg-red-600/65" style={{ width: `${(c.NOT_DONE / total) * 100}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-lead">
        <span className="text-emerald-700">{c.DONE} yaptı</span>
        <span className="text-amber-700">{c.PARTIAL} eksik</span>
        <span className="text-red-700">{c.NOT_DONE} yapmadı</span>
        {c.PENDING > 0 && <span>{c.PENDING} bekliyor</span>}
      </div>
    </>
  );
}
