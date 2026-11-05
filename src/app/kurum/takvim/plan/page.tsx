import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { schoolYearLabel, schoolYearOf } from "@/modules/planning";
import { planOverview } from "@/modules/planning/server";
import { PLANNING_TABS } from "@/modules/planning/ui/tabs";
import { ymd } from "@/shared/date";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ yil?: string; sinif?: string }> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const today = ymd();
  const year = Number(sp.yil) >= 2000 && Number(sp.yil) <= 2100 ? Number(sp.yil) : schoolYearOf(today);
  const classrooms = await classroomsOf(ownerId);
  const classroomId = classrooms.some((c) => c.id === sp.sinif) ? sp.sinif! : "";
  const rows = await planOverview(ownerId, year, today, classroomId || undefined);

  const planned = rows.filter((r) => r.plan);
  const behind = planned.filter((r) => r.plan!.progress.behindWeeks > 0);
  const q = (x: { yil?: number; sinif?: string }) =>
    `/kurum/takvim/plan?yil=${x.yil ?? year}${(x.sinif ?? classroomId) ? `&sinif=${x.sinif ?? classroomId}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Yıllık ders planı"
        sub={`${schoolYearLabel(year)} eğitim yılı · sınıf ve ders bazında konu dağılımı ve işlenme takibi`}
        actions={<Link href={`/kurum/takvim/plan/yeni?yil=${year}${classroomId ? `&sinif=${classroomId}` : ""}`} className="btn-primary">+ Yeni plan</Link>}
      />
      <Tabs tabs={PLANNING_TABS} active="plan" />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={q({ yil: year - 1 })} className="btn-secondary px-2 py-1">‹</Link>
        <span className="font-semibold">{schoolYearLabel(year)}</span>
        <Link href={q({ yil: year + 1 })} className="btn-secondary px-2 py-1">›</Link>
        <div className="flex-1" />
        <Link href={q({ sinif: "" })} className={`rounded-lg px-3 py-1 ${!classroomId ? "bg-graphite text-white" : "text-lead hover:bg-white"}`}>Tümü</Link>
        {classrooms.map((c) => (
          <Link key={c.id} href={q({ sinif: c.id })} className={`rounded-lg px-3 py-1 ${classroomId === c.id ? "bg-graphite text-white" : "text-lead hover:bg-white"}`}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <Kpi label="Planlı ders" value={`${planned.length} / ${rows.length}`} hint="ders programındaki sınıf-ders çiftleri" />
        <Kpi label="Plana göre geride" value={behind.length} hint={behind.length ? "aşağıda kırmızı" : "tüm planlar yolunda"} />
        <Kpi
          label="İşlenen konu"
          value={`${planned.reduce((a, r) => a + r.plan!.progress.done, 0)} / ${planned.reduce((a, r) => a + r.plan!.progress.total, 0)}`}
        />
      </div>

      {rows.length === 0 ? (
        <Empty>Ders programında ders yok. Önce ders programını oluşturun veya &quot;+ Yeni plan&quot; ile başlayın.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={th}>Ders</th>
                <th className={th}>Öğretmen</th>
                <th className={th}>İlerleme</th>
                <th className={th}>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {rows.map((r) => {
                const p = r.plan?.progress;
                return (
                  <tr key={`${r.classroomId}|${r.subject}`} className="hover:bg-paper">
                    <td className={`${td} font-medium`}>{r.classroom}</td>
                    <td className={td}>
                      {r.subject}
                      {r.weekly > 0 && <span className="ml-1 text-xs text-lead/70">{r.weekly} ders/hf</span>}
                    </td>
                    <td className={`${td} text-lead`}>{r.teachers.join(", ") || "—"}</td>
                    <td className={`${td} w-56`}>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                            <div className="h-full bg-emerald-500" style={{ width: `${p.rate}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs text-lead">{p.done}/{p.total}</span>
                        </div>
                      ) : (
                        <span className="text-lead/70">—</span>
                      )}
                    </td>
                    <td className={td}>
                      {!p ? (
                        <span className="badge bg-mist text-lead">Plan yok</span>
                      ) : p.behindWeeks > 0 ? (
                        <span className="badge bg-red-50 text-red-700">{p.behindWeeks} hafta geride · {p.late} konu</span>
                      ) : p.done === p.total ? (
                        <span className="badge bg-emerald-50 text-emerald-700">Tamamlandı</span>
                      ) : (
                        <span className="badge bg-emerald-50 text-emerald-700">Plana uygun</span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      {r.plan ? (
                        <Link href={`/kurum/takvim/plan/${r.plan.id}`} className="text-brand-700 hover:underline">Aç</Link>
                      ) : (
                        <Link
                          href={`/kurum/takvim/plan/yeni?yil=${year}&sinif=${r.classroomId}&ders=${encodeURIComponent(r.subject)}`}
                          className="text-brand-700 hover:underline"
                        >
                          Plan oluştur
                        </Link>
                      )}
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
