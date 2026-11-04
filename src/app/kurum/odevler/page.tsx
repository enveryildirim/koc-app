import Link from "next/link";
import { prisma } from "@/shared/db";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
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

  const all = await prisma.homework.findMany({
    where: { ownerId },
    orderBy: { dueDate: "desc" },
    include: { classroom: { select: { name: true } }, statuses: { select: { status: true } } },
  });
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
  let done = 0;
  let evaluated = 0;
  for (const h of list) {
    for (const s of h.statuses) {
      if (s.status === "PENDING") continue;
      evaluated++;
      if (s.status === "DONE") done++;
    }
  }
  const rate = evaluated ? Math.round((done / evaluated) * 100) : null;

  return (
    <div>
      <PageHeader title="Ödev Takip" sub="Sınıflara ödev verin, öğrenci bazında yapılma durumunu izleyin." />
      <Tabs tabs={ODEV_TABS} active="list" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Aktif ödev" value={active} hint="Teslim tarihi geçmemiş" />
        <Kpi label="Ortalama yapma oranı" value={rate === null ? "–" : `%${rate}`} hint="Değerlendirilen öğrenci durumları" />
        <Kpi label="Bu hafta teslim" value={thisWeek} />
      </div>

      <NewHomework classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))} subjects={subjects} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Ödevler <span className="font-normal text-slate-500">({list.length})</span></h2>
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
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={th}>Ders</th>
                <th className={th}>Başlık</th>
                <th className={th}>Veriliş</th>
                <th className={th}>Teslim</th>
                <th className={th}>Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((h) => {
                const c = { DONE: 0, PARTIAL: 0, NOT_DONE: 0, PENDING: 0 } as Record<string, number>;
                for (const s of h.statuses) c[s.status] = (c[s.status] ?? 0) + 1;
                const total = h.statuses.length || 1;
                const overdue = h.dueDate < startToday;
                return (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className={`${td} font-semibold`}>{h.classroom.name}</td>
                    <td className={td}>{h.subject}</td>
                    <td className={td}>
                      <Link href={`/kurum/odevler/${h.id}`} className="font-medium hover:text-brand-600">{h.title}</Link>
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>{fmt(h.assignedAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {fmt(h.dueDate)}{" "}
                      <span className={`badge ml-1 ${overdue ? "bg-slate-100 text-slate-600" : "bg-brand-50 text-brand-700"}`}>
                        {overdue ? "Süresi doldu" : "Aktif"}
                      </span>
                    </td>
                    <td className={`${td} min-w-56`}>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" title={`Yaptı ${c.DONE} · Eksik ${c.PARTIAL} · Yapmadı ${c.NOT_DONE} · Bekliyor ${c.PENDING}`}>
                        <div className="bg-emerald-500" style={{ width: `${(c.DONE / total) * 100}%` }} />
                        <div className="bg-amber-400" style={{ width: `${(c.PARTIAL / total) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(c.NOT_DONE / total) * 100}%` }} />
                      </div>
                      <div className="mt-1 flex gap-2 text-[11px] text-slate-500">
                        <span className="text-emerald-700">{c.DONE} yaptı</span>
                        <span className="text-amber-700">{c.PARTIAL} eksik</span>
                        <span className="text-red-700">{c.NOT_DONE} yapmadı</span>
                        {c.PENDING > 0 && <span>{c.PENDING} bekliyor</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
