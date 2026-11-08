import Link from "next/link";
import { redirect } from "next/navigation";
import { classroomsOf, listStudents, nextStudentNo, type StudentFilter } from "@/modules/enrollment/server";
import { resultCountsByStudent } from "@/modules/exams/server";
import { requireOwner } from "@/modules/identity/server";
import { PageHeader, Tabs, th, td, Empty } from "@/shared/ui/kurum";
import StudentForm from "@/modules/enrollment/ui/StudentForm";
import ImportStudents from "@/modules/enrollment/ui/ImportStudents";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string; q?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const { tab = "liste", sinif = "", q = "" } = await searchParams;
  const classes = await classroomsOf(ownerId);
  const tabs = [
    { key: "liste", label: "Öğrenci listesi", href: "/kurum/ogrenciler" },
    { key: "yeni", label: "Tek tek ekle", href: "/kurum/ogrenciler?tab=yeni" },
    { key: "ice-aktar", label: "Excel'den yükle", href: "/kurum/ogrenciler?tab=ice-aktar" },
  ];

  const header = <PageHeader title="Öğrenciler" sub="Öğrencileri ekleyin, sınıflara atayın veya Excel ile toplu yükleyin." />;

  if (tab === "yeni") {
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <div className="card max-w-2xl p-6">
          <StudentForm classes={classes.map((c) => ({ id: c.id, name: c.name }))} nextNo={await nextStudentNo(ownerId)} />
        </div>
      </>
    );
  }
  if (tab === "ice-aktar") {
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <ImportStudents />
      </>
    );
  }
  // Eski adres: sınıflar artık kendi menü maddesinde
  if (tab === "siniflar") redirect("/kurum/siniflar");

  const filter: StudentFilter =
    sinif === "_dis" ? { external: true } : sinif === "_yok" ? { classroomId: null, external: false } : sinif ? { classroomId: sinif } : {};
  const [students, resultCounts] = await Promise.all([listStudents(ownerId, { ...filter, q }), resultCountsByStudent(ownerId)]);

  return (
    <>
      {header}
      <Tabs tabs={tabs} active={tab} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="sinif" defaultValue={sinif} className="input w-auto">
          <option value="">Tüm sınıflar</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="_yok">Sınıfsız</option>
          <option value="_dis">Kurum dışı (STS)</option>
        </select>
        <input name="q" defaultValue={q} placeholder="Ad, soyad veya numara…" className="input max-w-xs" />
        <button className="btn-secondary">Filtrele</button>
        <span className="ml-auto self-center text-sm text-lead">{students.length} öğrenci</span>
      </form>
      {students.length === 0 ? (
        <Empty>Öğrenci bulunamadı.</Empty>
      ) : (
        <>
        {/* Telefonda kart: ad ve sınıf önde; numara, telefon ve veli altında. */}
        <ul className="card divide-y divide-rule/70 sm:hidden">
          {students.map((s) => (
            <li key={s.id}>
              <Link href={`/kurum/ogrenciler/${s.id}`} className="block px-3.5 py-2.5 active:bg-paper">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                  {s.classroom?.name ? (
                    <span className="shrink-0 text-[13px] font-semibold">{s.classroom.name}</span>
                  ) : s.external ? (
                    <span className="badge shrink-0 bg-violet-50 text-violet-700">Kurum dışı</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-[13px] text-lead">
                  <span className="num">No {s.studentNo}</span>
                  {s.phone && <span className="num">, {s.phone}</span>}
                  {(resultCounts.get(s.id) ?? 0) > 0 && <span>, {resultCounts.get(s.id)} deneme</span>}
                </div>
                {(s.parentName || s.parentPhone) && (
                  <div className="text-[13px] text-lead">
                    Veli: {s.parentName || "—"} {s.parentPhone && <span className="num">{s.parentPhone}</span>}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>No</th>
                <th className={th}>Ad Soyad</th>
                <th className={th}>Sınıf</th>
                <th className={th}>Telefon</th>
                <th className={th}>Veli</th>
                <th className={th}>Deneme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-paper">
                  <td className={`${td} num`}>{s.studentNo}</td>
                  <td className={td}>
                    <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:text-brand-600">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className={td}>
                    {s.classroom?.name ?? (s.external ? <span className="badge bg-violet-50 text-violet-700">Kurum dışı</span> : "—")}
                  </td>
                  <td className={`${td} text-lead`}>{s.phone || "—"}</td>
                  <td className={`${td} text-lead`}>
                    {s.parentName || "—"} {s.parentPhone && <span className="text-xs">({s.parentPhone})</span>}
                  </td>
                  <td className={td}>{resultCounts.get(s.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}
