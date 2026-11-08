import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses, listTeachers, syncCourses } from "@/modules/schedule/server";
import { Empty, PageHeader } from "@/shared/ui/kurum";
import CourseAdmin from "@/modules/schedule/ui/CourseAdmin";

export const dynamic = "force-dynamic";

/**
 * Dersler: dersin oluştuğu ve düzenlendiği tek yer (KROKI.md > Ders). Bütün sınıfların dersleri tek listede, sınıfa göre süzülür.
 * `?sinif=` süzgeç, `?yeni=1` ekleme paneli, `?ders=<id>` düzenleme paneli.
 * Ders programı, ek ders, ödev ve yıllık plan dersi buradan açılmış derslerden seçer.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ sinif?: string; yeni?: string; ders?: string }> }) {
  const ownerId = await requireOwner();
  const { sinif = "", yeni, ders } = await searchParams;
  await syncCourses(ownerId);
  const [classes, all, teachers] = await Promise.all([classroomsOf(ownerId), listCourses(ownerId), listTeachers(ownerId)]);
  const sel = classes.find((c) => c.id === sinif);
  const header = (
    <PageHeader
      title="Dersler"
      sub="Dersler sınıfa bağlıdır. Ders programı, yoklama, sözlü / yazılı, ödev ve yıllık plan dersi bu listeden seçer."
      actions={classes.length ? <Link href={`?${new URLSearchParams({ ...(sel ? { sinif: sel.id } : {}), yeni: "1" })}`} scroll={false} className="btn-primary">+ Ders ekle</Link> : undefined}
    />
  );
  if (!classes.length) {
    return (
      <>
        {header}
        <Empty>Önce <Link href="/kurum/siniflar?yeni=1" className="font-semibold text-brand-600">Sınıflar</Link> sayfasından sınıf ekleyin.</Empty>
      </>
    );
  }
  const count = (id: string) => all.filter((c) => c.classroomId === id).length;
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-graphite text-white" : "bg-surface ring-1 ring-rule"}`;
  const courses = sel ? all.filter((c) => c.classroomId === sel.id) : all;
  return (
    <>
      {header}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Link href="/kurum/dersler" className={chip(!sel)}>
          Tümü <span className={!sel ? "text-white/70" : "text-lead"}>{all.length}</span>
        </Link>
        {classes.map((c) => (
          <Link key={c.id} href={`/kurum/dersler?sinif=${c.id}`} className={chip(c.id === sel?.id)}>
            {c.name} <span className={c.id === sel?.id ? "text-white/70" : "text-lead"}>{count(c.id)}</span>
          </Link>
        ))}
        {sel && (
          <Link href={`/kurum/siniflar/${sel.id}`} className="ml-auto text-[13px] font-medium text-brand-600 hover:underline">
            {sel.name} sınıf sayfası
          </Link>
        )}
      </div>
      <CourseAdmin
        key={`${sel?.id ?? ""}|${ders ?? ""}`}
        courses={courses}
        classrooms={classes.map((c) => ({ id: c.id, name: c.name }))}
        teachers={teachers.map((t) => ({ id: t.id, name: t.name, role: t.role }))}
        names={[...new Set(all.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "tr"))}
        classroomId={sel?.id ?? ""}
        open={yeni === "1"}
        editId={ders}
      />
    </>
  );
}
