import Link from "next/link";
import { notFound } from "next/navigation";
import { fullName } from "@/modules/enrollment";
import { requireStaff } from "@/modules/identity/server";
import { attendanceSheet, listCourses, teachesSubject } from "@/modules/schedule/server";
import { listAssessments } from "@/modules/assessment/server";
import AssessmentList from "@/modules/assessment/ui/AssessmentList";
import { homeworkForLesson } from "@/modules/homework/server";
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

  const [topics, courses] = await Promise.all([
    topicsForLesson(me.ownerId, lesson.classroomId, lesson.subject, lesson.date),
    listCourses(me.ownerId, { classroomId: lesson.classroomId }),
  ]);
  const course = courses.find((c) => c.name === lesson.subject);
  const homework = await homeworkForLesson(me.ownerId, lesson.classroomId, lesson.subject, lesson.date);
  const here = sp.ders ? `/ogretmen/ders?ders=${sp.ders}` : `/ogretmen/ders?program=${sp.program}&tarih=${sp.tarih}`;
  const todays = course ? (await listAssessments(me.ownerId, { courseIds: [course.id], from: lesson.date })).filter((a) => a.date === lesson.date) : [];
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
      {course && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sözlü / yazılı</h2>
            <Link href={`/ogretmen/degerlendirme/yeni?ders=${course.id}`} className="btn-secondary py-2">+ Başlat</Link>
          </div>
          {todays.length > 0 && <AssessmentList items={todays} hrefBase="/ogretmen/degerlendirme" empty="" />}
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ödev</h2>
          <Link href={`/ogretmen/odev/yeni?sinif=${lesson.classroomId}&ders=${encodeURIComponent(lesson.subject)}&geri=${encodeURIComponent(here)}`} className="btn-secondary py-2">+ Ödev ver</Link>
        </div>
        {homework.length > 0 && (
          <ul className="card divide-y divide-rule/70">
            {homework.map((h) => {
              const past = h.dueDate < new Date();
              return (
                <li key={h.id}>
                  <Link href={`/ogretmen/odev/${h.id}`} className="flex items-center gap-3 px-3.5 py-2.5 active:bg-paper">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.title}</span>
                      <span className="text-[13px] text-lead">teslim {h.dueDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                    </span>
                    {past && h.pending > 0 ? (
                      <span className="badge bg-amber-50 text-amber-800">{h.pending} işaretlenmedi</span>
                    ) : (
                      <span className="num text-[13px] text-lead">{h.done}/{h.total} yaptı</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
