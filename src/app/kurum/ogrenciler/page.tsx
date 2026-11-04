import Link from "next/link";
import { prisma } from "@/lib/db";
import { classroomsOf, requireOwner } from "@/lib/kurum";
import { PageHeader, Tabs, th, td, Empty } from "@/components/kurum/ui";
import StudentForm from "@/components/kurum/kayit/StudentForm";
import ImportStudents from "@/components/kurum/kayit/ImportStudents";
import ClassManager from "@/components/kurum/kayit/ClassManager";

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
    { key: "siniflar", label: "Sınıflar", href: "/kurum/ogrenciler?tab=siniflar" },
  ];

  const header = <PageHeader title="Öğrenci Kayıt" sub="Öğrencileri ekleyin, sınıflara atayın veya Excel ile toplu yükleyin." />;

  if (tab === "yeni") {
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <div className="card max-w-2xl p-6">
          <StudentForm classes={classes.map((c) => ({ id: c.id, name: c.name }))} />
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
  if (tab === "siniflar") {
    const counts = await prisma.student.groupBy({ by: ["classroomId"], where: { ownerId }, _count: true });
    const cnt = new Map(counts.map((c) => [c.classroomId, c._count]));
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <ClassManager classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, students: cnt.get(c.id) ?? 0 }))} />
      </>
    );
  }

  const where = {
    ownerId,
    ...(sinif === "_dis" ? { external: true } : sinif === "_yok" ? { classroomId: null, external: false } : sinif ? { classroomId: sinif } : {}),
    ...(q
      ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { studentNo: { contains: q } }] }
      : {}),
  };
  const students = await prisma.student.findMany({
    where,
    include: { classroom: true, _count: { select: { results: true } } },
    orderBy: [{ classroom: { name: "asc" } }, { studentNo: "asc" }],
  });

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
        <span className="ml-auto self-center text-sm text-slate-500">{students.length} öğrenci</span>
      </form>
      {students.length === 0 ? (
        <Empty>Öğrenci bulunamadı.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>No</th>
                <th className={th}>Ad Soyad</th>
                <th className={th}>Sınıf</th>
                <th className={th}>Telefon</th>
                <th className={th}>Veli</th>
                <th className={th}>Deneme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className={`${td} font-mono`}>{s.studentNo}</td>
                  <td className={td}>
                    <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:text-brand-600">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className={td}>
                    {s.classroom?.name ?? (s.external ? <span className="badge bg-violet-50 text-violet-700">Kurum dışı</span> : "—")}
                  </td>
                  <td className={`${td} text-slate-500`}>{s.phone || "—"}</td>
                  <td className={`${td} text-slate-500`}>
                    {s.parentName || "—"} {s.parentPhone && <span className="text-xs">({s.parentPhone})</span>}
                  </td>
                  <td className={td}>{s._count.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
