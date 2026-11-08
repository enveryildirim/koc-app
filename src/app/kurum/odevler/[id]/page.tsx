import { notFound } from "next/navigation";
import { fullName } from "@/modules/enrollment";
import { requireOwner } from "@/modules/identity/server";
import { findHomework } from "@/modules/homework/server";
import { listCourses } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import StatusEditor from "@/modules/homework/ui/StatusEditor";
import HomeworkActions from "@/modules/homework/ui/HomeworkActions";
import { toInputDate } from "@/shared/date";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const hw = await findHomework(ownerId, id);
  if (!hw) notFound();
  // Ders, ödevin sınıfının derslerinden seçilir (eski ödevin adı listede yoksa formda ayrıca gösterilir)
  const subjects = (await listCourses(ownerId, { classroomId: hw.classroomId })).map((c) => c.name);
  const overdue = hw.dueDate < new Date();

  return (
    <div>
      <PageHeader
        back={{ href: "/kurum/odevler", label: "Ödevler" }}
        title={hw.title}
        sub={
          <>
            {hw.classroom.name} · {hw.subject} · Veriliş: {fmt(hw.assignedAt)} · Teslim: <b className={overdue ? "text-red-600" : ""}>{fmt(hw.dueDate)}</b>
            {overdue && " (süresi doldu)"}
          </>
        }
        actions={
          <HomeworkActions
            homework={{ id: hw.id, subject: hw.subject, title: hw.title, description: hw.description, dueDate: toInputDate(hw.dueDate) }}
            subjects={subjects}
          />
        }
      />
      {hw.description && <p className="card mb-6 whitespace-pre-line p-4 text-sm text-graphite/90">{hw.description}</p>}
      <StatusEditor
        homeworkId={hw.id}
        rows={hw.roster.map(({ student: s, status, note }) => ({
          studentId: s.id,
          studentNo: s.studentNo,
          name: fullName(s),
          status,
          note,
        }))}
      />
    </div>
  );
}
