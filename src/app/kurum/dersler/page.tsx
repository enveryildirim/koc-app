import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses, listTeachers, syncCourses } from "@/modules/schedule/server";
import { Empty, PageHeader } from "@/shared/ui/kurum";
import CourseManager from "@/modules/schedule/ui/CourseManager";

export const dynamic = "force-dynamic";

/**
 * Dersler: sınıf seçilir, o sınıfın dersleri eklenir / düzenlenir (sınıf sayfasındaki bölümün aynısı).
 * Dersler sınıfa bağlıdır; bu sayfa yalnızca menüden kolay ulaşım içindir.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ sinif?: string }> }) {
  const ownerId = await requireOwner();
  const { sinif } = await searchParams;
  await syncCourses(ownerId);
  const [classes, all, teachers] = await Promise.all([classroomsOf(ownerId), listCourses(ownerId), listTeachers(ownerId)]);
  const header = <PageHeader title="Dersler" sub="Sınıfı seçin; derslerini ekleyin ya da düzenleyin. Dersler sınıfa bağlıdır." />;
  if (!classes.length) {
    return (
      <>
        {header}
        <Empty>Önce <Link href="/kurum/siniflar?yeni=1" className="font-semibold text-brand-600">Sınıflar</Link> sayfasından sınıf ekleyin.</Empty>
      </>
    );
  }
  const sel = classes.find((c) => c.id === sinif) ?? classes[0];
  const count = (id: string) => all.filter((c) => c.classroomId === id).length;
  return (
    <>
      {header}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {classes.map((c) => (
          <Link key={c.id} href={`/kurum/dersler?sinif=${c.id}`} className={`rounded-full px-3 py-1 text-sm font-medium ${c.id === sel.id ? "bg-graphite text-white" : "bg-surface ring-1 ring-rule"}`}>
            {c.name} <span className={c.id === sel.id ? "text-white/70" : "text-lead"}>{count(c.id)}</span>
          </Link>
        ))}
      </div>
      <div className="max-w-2xl">
        <CourseManager
          classroomId={sel.id}
          courses={all.filter((c) => c.classroomId === sel.id)}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, role: t.role }))}
        />
        <p className="mt-2 text-[13px] text-lead">
          Öğrenciler, etüt mesulü ve son 30 günün değerlendirme özeti için <Link href={`/kurum/siniflar/${sel.id}`} className="font-medium text-brand-600 hover:underline">{sel.name} sınıf sayfası</Link>.
        </p>
      </div>
    </>
  );
}
