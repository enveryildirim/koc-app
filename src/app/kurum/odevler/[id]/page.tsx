import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fullName, requireOwner } from "@/lib/kurum";
import { PageHeader } from "@/components/kurum/ui";
import StatusEditor from "@/components/kurum/odev/StatusEditor";
import HomeworkActions from "@/components/kurum/odev/HomeworkActions";
import { toInputDate } from "@/components/kurum/odev/labels";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const hw = await prisma.homework.findFirst({
    where: { id, ownerId },
    include: { classroom: true, statuses: true },
  });
  if (!hw) notFound();

  // Sınıfın güncel öğrencileri + (sınıftan ayrılmış olsa da) durum kaydı olan öğrenciler
  const students = await prisma.student.findMany({
    where: { ownerId, OR: [{ classroomId: hw.classroomId }, { id: { in: hw.statuses.map((s) => s.studentId) } }] },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const byStudent = new Map(hw.statuses.map((s) => [s.studentId, s]));
  const subjects = (await prisma.homework.findMany({ where: { ownerId }, distinct: ["subject"], select: { subject: true } })).map((s) => s.subject);
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
      {hw.description && <p className="card mb-6 whitespace-pre-line p-4 text-sm text-slate-700">{hw.description}</p>}
      <StatusEditor
        homeworkId={hw.id}
        rows={students.map((s) => ({
          studentId: s.id,
          studentNo: s.studentNo,
          name: fullName(s),
          status: byStudent.get(s.id)?.status ?? "PENDING",
          note: byStudent.get(s.id)?.note ?? "",
        }))}
      />
    </div>
  );
}
