import { notFound } from "next/navigation";
import { fullName } from "@/modules/enrollment";
import { LESSON_TYPES } from "@/modules/schedule";
import { requireOwner } from "@/modules/identity/server";
import { attendanceSheet } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import AttendanceForm from "@/modules/schedule/ui/AttendanceForm";

export const dynamic = "force-dynamic";

type SP = Promise<{ program?: string; tarih?: string; ders?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;

  const sheet = sp.ders
    ? await attendanceSheet(ownerId, { sessionId: sp.ders })
    : sp.program && sp.tarih
      ? await attendanceSheet(ownerId, { slotId: sp.program, date: sp.tarih })
      : null;
  if (!sheet) notFound();
  /** API'ye gönderilecek ders kimliği */
  const target = sp.ders ? { sessionId: sp.ders } : { slotId: sp.program };
  const { lesson: info, sessionId, extra, students, marks: initial } = sheet;
  const taken = Object.keys(initial).length > 0;
  const dateLabel = new Date(info.date + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader
        back={{ href: `/kurum/yoklama?tarih=${info.date}`, label: "Günün dersleri" }}
        title={`${info.subject} · ${info.classroom}`}
        sub={`${dateLabel} · ${info.startTime}–${info.endTime} · ${info.teacher} · ${LESSON_TYPES[info.lessonType] ?? info.lessonType}${taken ? " · yoklama daha önce alınmış, güncelleyebilirsiniz" : ""}`}
      />
      <AttendanceForm
        students={students.map((s) => ({ id: s.id, no: s.studentNo, name: fullName(s) }))}
        initial={initial}
        target={target}
        date={info.date}
        backHref={`/kurum/yoklama?tarih=${info.date}`}
        deletable={extra && sessionId ? sessionId : undefined}
      />
    </div>
  );
}
