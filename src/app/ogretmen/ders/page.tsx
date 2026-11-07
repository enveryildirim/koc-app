import Link from "next/link";
import { notFound } from "next/navigation";
import { fullName } from "@/modules/enrollment";
import { requireStaff } from "@/modules/identity/server";
import { attendanceSheet, teachesSubject } from "@/modules/schedule/server";
import { topicsForLesson } from "@/modules/planning/server";
import LessonTopics from "@/modules/planning/ui/LessonTopics";
import QuickAttendance from "@/modules/schedule/ui/QuickAttendance";

export const dynamic = "force-dynamic";

type SP = Promise<{ program?: string; tarih?: string; ders?: string }>;

/** Ders ekranı (telefon): işlenen konu ve yoklama tek sayfada. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const sheet = sp.ders
    ? await attendanceSheet(me.ownerId, { sessionId: sp.ders })
    : sp.program && sp.tarih
      ? await attendanceSheet(me.ownerId, { slotId: sp.program, date: sp.tarih })
      : null;
  if (!sheet) notFound();
  const { lesson, sessionId, students, marks } = sheet;
  // Öğretmen yalnızca kendi dersini açar; etüt mesulü yönetici yetkisindedir.
  if (me.role === "TEACHER" && lesson.teacherId !== me.teacherId && !(await teachesSubject(me.ownerId, me.teacherId, lesson.classroomId, lesson.subject))) notFound();

  const topics = await topicsForLesson(me.ownerId, lesson.classroomId, lesson.subject, lesson.date);
  const taken = Object.keys(marks).length > 0;
  const dateLabel = new Date(lesson.date + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  const back = `/ogretmen?tarih=${lesson.date}`;

  return (
    <div className="space-y-3">
      <div>
        <Link href={back} className="text-[13px] text-lead">‹ Günün dersleri</Link>
        <h1 className="font-display text-xl font-bold leading-tight">{lesson.subject} · {lesson.classroom}</h1>
        <p className="text-[13px] text-lead">
          {dateLabel} · <span className="num">{lesson.startTime}–{lesson.endTime}</span>
          {taken && " · yoklama alınmış, güncelleyebilirsiniz"}
        </p>
      </div>
      {topics && <LessonTopics planId={topics.planId} items={topics.items} date={lesson.date} sessionId={sessionId} planLink={false} />}
      <QuickAttendance
        students={students.map((s) => ({
          id: s.id,
          no: s.studentNo,
          name: fullName(s),
          guest: s.classroomId !== lesson.classroomId ? (s.classroom?.name ?? null) : null,
        }))}
        initial={marks}
        target={sp.ders ? { sessionId: sp.ders } : { slotId: sp.program }}
        date={lesson.date}
        doneHref={back}
      />
    </div>
  );
}
