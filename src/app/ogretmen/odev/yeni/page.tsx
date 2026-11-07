import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { teachesSubject } from "@/modules/schedule/server";
import HomeworkForm from "@/modules/homework/ui/HomeworkForm";

export const dynamic = "force-dynamic";

/** Ödev ver (telefon): sınıf ve ders ders ekranından gelir. */
export default async function Page({ searchParams }: { searchParams: Promise<{ sinif?: string; ders?: string; geri?: string }> }) {
  const me = await requireStaff();
  const { sinif = "", ders = "", geri } = await searchParams;
  const cls = (await classroomsOf(me.ownerId)).find((c) => c.id === sinif);
  if (!cls || !ders) notFound();
  if (me.role === "TEACHER" && !(await teachesSubject(me.ownerId, me.teacherId, cls.id, ders))) notFound();
  const back = geri?.startsWith("/ogretmen") ? geri : "/ogretmen";
  return (
    <div className="space-y-3">
      <div>
        <Link href={back} className="text-[13px] text-lead">‹ Derse dön</Link>
        <h1 className="font-display text-xl font-bold leading-tight">Ödev ver · {ders} · {cls.name}</h1>
      </div>
      <div className="card p-3.5">
        <HomeworkForm classrooms={[{ id: cls.id, name: cls.name }]} subjects={[ders]} initial={{ classroomId: cls.id, subject: ders }} />
      </div>
    </div>
  );
}
