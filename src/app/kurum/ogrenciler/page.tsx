import Link from "next/link";
import { redirect } from "next/navigation";
import { classroomsOf, listStudents, nextStudentNo, type StudentFilter } from "@/modules/enrollment/server";
import { resultCountsByStudent } from "@/modules/exams/server";
import { requireOwner } from "@/modules/identity/server";
import { PageHeader, th, td, Empty } from "@/shared/ui/kurum";
import ImportStudents from "@/modules/enrollment/ui/ImportStudents";
import StudentAdd from "@/modules/enrollment/ui/StudentAdd";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string; q?: string; yeni?: string; yukle?: string; eklendi?: string }>;

/**
 * Öğrenciler: sayfa listedir. "+ Öğrenci ekle" yan panel (`?yeni=1`), "Excel'den yükle" listenin üstünde (`?yukle=1`).
 * Panelden eklenenler listede vurgulanır (`?eklendi=<id,…>`).
 */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const { tab, sinif = "", q = "", yeni, yukle, eklendi = "" } = await searchParams;
  // Eski sekme adresleri
  if (tab === "yeni") redirect("/kurum/ogrenciler?yeni=1");
  if (tab === "ice-aktar") redirect("/kurum/ogrenciler?yukle=1");
  if (tab === "siniflar") redirect("/kurum/siniflar");

  const classes = await classroomsOf(ownerId);
  const realClass = classes.some((c) => c.id === sinif) ? sinif : "";
  const link = (p: Record<string, string>) => {
    const s = new URLSearchParams({ ...(sinif ? { sinif } : {}), ...(q ? { q } : {}), ...p });
    return `/kurum/ogrenciler${s.size ? `?${s}` : ""}`;
  };

  const filter: StudentFilter =
    sinif === "_dis" ? { external: true } : sinif === "_yok" ? { classroomId: null, external: false } : sinif ? { classroomId: sinif } : {};
  const [students, resultCounts, total, nextNo] = await Promise.all([
    listStudents(ownerId, { ...filter, q }),
    resultCountsByStudent(ownerId),
    sinif || q ? listStudents(ownerId).then((l) => l.length) : Promise.resolve(-1),
    nextStudentNo(ownerId),
  ]);
  const isEmpty = (total === -1 ? students.length : total) === 0;
  const added = new Set(eklendi.split(",").filter(Boolean));
  const shownAdded = students.filter((s) => added.has(s.id)).length;
  const rowCls = (id: string) => (added.has(id) ? "bg-emerald-50" : "");

  return (
    <>
      <PageHeader
        title="Öğrenciler"
        sub="Öğrenci listesi. Tek tek ekleyin ya da Excel ile toplu yükleyin."
        actions={
          <>
            <Link href={link({ yukle: "1" })} scroll={false} className="btn-secondary">Excel&apos;den yükle</Link>
            <Link href={link({ yeni: "1" })} scroll={false} className="btn-primary">+ Öğrenci ekle</Link>
          </>
        }
      />

      {yukle === "1" && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Excel&apos;den yükle</h2>
            <Link href={link({})} scroll={false} className="text-[13px] text-lead hover:text-graphite">Kapat</Link>
          </div>
          <ImportStudents classNames={classes.map((c) => c.name)} />
        </section>
      )}

      {isEmpty && yukle !== "1" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={link({ yeni: "1" })} scroll={false} className="card block p-5 hover:ring-graphite/40">
            <div className="font-semibold">Tek tek ekle</div>
            <p className="mt-1 text-sm text-lead">Numara sırayla gelir; “Kaydet ve yenisini ekle” ile arka arkaya girin.</p>
          </Link>
          <Link href={link({ yukle: "1" })} scroll={false} className="card block p-5 hover:ring-graphite/40">
            <div className="font-semibold">Excel&apos;den yükle</div>
            <p className="mt-1 text-sm text-lead">Ad, Soyad, Sınıf sütunları yeterli; numara boşsa sırayla verilir. Excel&apos;den kopyalayıp yapıştırabilirsiniz.</p>
          </Link>
        </div>
      ) : (
        <>
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
          {shownAdded > 0 && (
            <p className="mb-2 text-sm text-emerald-700">
              {shownAdded} öğrenci eklendi; listede yeşil.{" "}
              <Link href={link({})} scroll={false} className="text-lead underline">Vurguyu kaldır</Link>
            </p>
          )}
          {students.length === 0 ? (
            <Empty>Öğrenci bulunamadı.</Empty>
          ) : (
            <>
              {/* Telefonda kart: ad ve sınıf önde; numara, telefon ve veli altında. */}
              <ul className="card divide-y divide-rule/70 sm:hidden">
                {students.map((s) => (
                  <li key={s.id} className={rowCls(s.id)}>
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
                      <tr key={s.id} className={rowCls(s.id) || "hover:bg-paper"}>
                        <td className={`${td} num`}>{s.studentNo}</td>
                        <td className={td}>
                          <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:text-brand-600">
                            {s.firstName} {s.lastName}
                          </Link>
                          {added.has(s.id) && <span className="ml-2 text-xs text-emerald-700">eklendi</span>}
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
      )}

      <StudentAdd
        key={realClass}
        open={yeni === "1"}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        nextNo={nextNo}
        defaultClassId={realClass}
      />
    </>
  );
}
