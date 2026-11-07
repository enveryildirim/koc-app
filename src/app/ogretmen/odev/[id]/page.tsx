import Link from "next/link";
import { notFound } from "next/navigation";
import { fullName } from "@/modules/enrollment";
import { requireStaff } from "@/modules/identity/server";
import { findHomeworkFor } from "@/modules/homework/server";
import StatusEditor from "@/modules/homework/ui/StatusEditor";

export const dynamic = "force-dynamic";

/** Ödev kontrolü (telefon): öğretmen yalnızca kendi dersinin ödevini açar. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const hw = await findHomeworkFor(me.ownerId, (await params).id, { teacherId: me.role === "TEACHER" ? me.teacherId : undefined });
  if (!hw) notFound();
  const due = hw.dueDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  return (
    <div className="space-y-3">
      <div>
        <Link href="/ogretmen" className="text-[13px] text-lead">‹ Bugün</Link>
        <h1 className="font-display text-xl font-bold leading-tight">{hw.title}</h1>
        <p className="text-[13px] text-lead">{hw.subject} · {hw.classroom.name} · teslim {due}</p>
        {hw.description && <p className="mt-1 text-sm">{hw.description}</p>}
      </div>
      <StatusEditor
        homeworkId={hw.id}
        rows={hw.roster.map(({ student: s, status, note }) => ({ studentId: s.id, studentNo: s.studentNo, name: fullName(s), status, note }))}
      />
    </div>
  );
}
