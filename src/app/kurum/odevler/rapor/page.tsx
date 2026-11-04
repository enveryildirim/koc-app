import Link from "next/link";
import { classroomsOf, listStudents } from "@/modules/enrollment/server";
import { fullName } from "@/modules/enrollment";
import { requireOwner } from "@/modules/identity/server";
import { doneRate, emptyCounts } from "@/modules/homework";
import { homeworkCountsByStudent } from "@/modules/homework/server";
import { Empty, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";
import ExportButton from "@/shared/ui/ExportButton";
import FilterBar from "@/modules/homework/ui/FilterBar";
import { ODEV_TABS } from "@/modules/homework/ui/tabs";

export const dynamic = "force-dynamic";

type Sort = "oran" | "oran-desc" | "ad" | "no";

export default async function Page({ searchParams }: { searchParams: Promise<{ sinif?: string; sirala?: string }> }) {
  const ownerId = await requireOwner();
  const { sinif, sirala } = await searchParams;
  const sort = (["oran", "oran-desc", "ad", "no"].includes(sirala ?? "") ? sirala : "oran") as Sort;
  const classrooms = await classroomsOf(ownerId);

  const students = await listStudents(ownerId, { external: false, ...(sinif ? { classroomId: sinif } : {}) });
  const counts = await homeworkCountsByStudent(ownerId, students.map((s) => s.id));

  const rows = students.map((s) => {
    const c = counts.get(s.id) ?? emptyCounts();
    return {
      id: s.id,
      no: s.studentNo,
      name: fullName(s),
      cls: s.classroom?.name ?? "—",
      ...c,
      rate: doneRate(c),
    };
  });
  rows.sort((a, b) => {
    if (sort === "ad") return a.name.localeCompare(b.name, "tr");
    if (sort === "no") return a.no.localeCompare(b.no, "tr", { numeric: true });
    const ra = a.rate ?? 101;
    const rb = b.rate ?? 101;
    return sort === "oran" ? ra - rb : rb - ra;
  });
  const clsName = classrooms.find((c) => c.id === sinif)?.name;

  return (
    <div>
      <PageHeader title="Ödev Takip" sub="Öğrenci bazında ödev yapma raporu" actions={<PrintButton />} />
      <Tabs tabs={ODEV_TABS} active="rapor" />

      <div className="no-print mb-4 flex flex-wrap items-end justify-end gap-2">
        <ExportButton
          fileName={`odev_raporu_${clsName ?? "tum_siniflar"}`}
          headers={["Öğrenci No", "Öğrenci", "Sınıf", "Toplam", "Yaptı", "Eksik", "Yapmadı", "Bekliyor", "Yapma oranı %"]}
          rows={rows.map((r) => [r.no, r.name, r.cls, r.total, r.DONE, r.PARTIAL, r.NOT_DONE, r.PENDING, r.rate])}
        />
        <FilterBar
          filters={[
            { name: "sinif", label: "Sınıf", options: [{ value: "", label: "Tüm sınıflar" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))] },
            {
              name: "sirala",
              label: "Sıralama",
              options: [
                { value: "", label: "Yapma oranı (düşükten)" },
                { value: "oran-desc", label: "Yapma oranı (yüksekten)" },
                { value: "ad", label: "Ada göre" },
                { value: "no", label: "Numaraya göre" },
              ],
            },
          ]}
        />
      </div>

      <h2 className="mb-3 hidden text-lg font-bold print:block">Ödev Raporu – {clsName ?? "Tüm sınıflar"}</h2>

      {rows.length === 0 ? (
        <Empty>Öğrenci bulunamadı.</Empty>
      ) : (
        <div className="card overflow-x-auto print:shadow-none print:ring-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>No</th>
                <th className={th}>Öğrenci</th>
                <th className={th}>Sınıf</th>
                <th className={`${th} text-right`}>Toplam</th>
                <th className={`${th} text-right`}>Yaptı</th>
                <th className={`${th} text-right`}>Eksik</th>
                <th className={`${th} text-right`}>Yapmadı</th>
                <th className={`${th} text-right`}>Bekliyor</th>
                <th className={th}>Yapma oranı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-mono text-xs text-slate-500`}>{r.no}</td>
                  <td className={`${td} font-medium`}>
                    <Link href={`/kurum/ogrenciler/${r.id}`} className="hover:text-brand-600">{r.name}</Link>
                  </td>
                  <td className={td}>{r.cls}</td>
                  <td className={`${td} text-right`}>{r.total}</td>
                  <td className={`${td} text-right text-emerald-700`}>{r.DONE}</td>
                  <td className={`${td} text-right text-amber-700`}>{r.PARTIAL}</td>
                  <td className={`${td} text-right text-red-700`}>{r.NOT_DONE}</td>
                  <td className={`${td} text-right text-slate-500`}>{r.PENDING}</td>
                  <td className={`${td} min-w-40`}>
                    {r.rate === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={r.rate < 50 ? "h-full bg-red-500" : r.rate < 75 ? "h-full bg-amber-400" : "h-full bg-emerald-500"}
                            style={{ width: `${r.rate}%` }}
                          />
                        </div>
                        <span className={`w-10 text-right font-semibold ${r.rate < 50 ? "text-red-600" : ""}`}>%{r.rate}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">Yapma oranı = Yaptı / (Yaptı + Eksik + Yapmadı). “Bekliyor” durumundaki ödevler orana katılmaz.</p>
    </div>
  );
}
