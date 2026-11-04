import Link from "next/link";
import { prisma } from "@/shared/db";
import { dayOfWeek, ymd } from "@/shared/date";
import { requireOwner } from "@/modules/identity/server";
import { DAYS, LESSON_TYPES } from "@/modules/schedule";
import { EXAM_TYPES, fmtDate, fmtNet } from "@/modules/exams";
import { Kpi, PageHeader, th, td } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const today = ymd();
  const monthAgo = ymd(new Date(Date.now() - 30 * 86400000));
  const dow = dayOfWeek(today);

  const [studentCount, classCount, exams, todaySlots, todaySessions, att, hw, upcoming] = await Promise.all([
    prisma.student.count({ where: { ownerId, external: false } }),
    prisma.classroom.count({ where: { ownerId } }),
    prisma.exam.findMany({ where: { ownerId }, orderBy: { date: "desc" }, take: 5, include: { results: { select: { totalNet: true } } } }),
    prisma.scheduleSlot.findMany({ where: { ownerId, dayOfWeek: dow }, include: { classroom: true, teacher: true }, orderBy: { startTime: "asc" } }),
    prisma.lessonSession.findMany({ where: { ownerId, date: today }, select: { slotId: true } }),
    prisma.attendance.groupBy({ by: ["status"], where: { session: { ownerId, date: { gte: monthAgo } } }, _count: true }),
    prisma.homeworkStatus.groupBy({ by: ["status"], where: { homework: { ownerId, dueDate: { gte: new Date(monthAgo) } } }, _count: true }),
    prisma.homework.findMany({
      where: { ownerId, dueDate: { gte: new Date(today) } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { classroom: true, statuses: { select: { status: true } } },
    }),
  ]);

  // Son 30 günde en çok devamsızlık yapanlar
  const absentTop = await prisma.attendance.groupBy({
    by: ["studentId"],
    where: { status: "ABSENT", session: { ownerId, date: { gte: monthAgo } } },
    _count: true,
    orderBy: { _count: { studentId: "desc" } },
    take: 6,
  });
  const absentStudents = await prisma.student.findMany({ where: { id: { in: absentTop.map((a) => a.studentId) } }, include: { classroom: true } });

  const count = (arr: { status: string; _count: number }[], s: string) => arr.find((a) => a.status === s)?._count ?? 0;
  const attTotal = att.reduce((s, a) => s + a._count, 0);
  const attRate = attTotal ? Math.round(((count(att, "PRESENT") + count(att, "LATE")) / attTotal) * 100) : null;
  const hwGraded = count(hw, "DONE") + count(hw, "PARTIAL") + count(hw, "NOT_DONE");
  const hwRate = hwGraded ? Math.round((count(hw, "DONE") / hwGraded) * 100) : null;
  const taken = new Set(todaySessions.map((s) => s.slotId));
  const lastExam = exams[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Kurum Özeti" sub={`${DAYS[dow]}, ${fmtDate(today)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Öğrenci" value={studentCount} hint={`${classCount} sınıf`} />
        <Kpi
          label="Son deneme ort."
          value={lastExam && lastExam.results.length ? fmtNet(lastExam.results.reduce((s, r) => s + r.totalNet, 0) / lastExam.results.length) : "—"}
          hint={lastExam ? `${lastExam.name} · ${lastExam.results.length} öğrenci` : "Deneme yok"}
        />
        <Kpi label="Devam (30 gün)" value={attRate === null ? "—" : `%${attRate}`} hint={`${count(att, "ABSENT")} devamsızlık`} />
        <Kpi label="Ödev yapma (30 gün)" value={hwRate === null ? "—" : `%${hwRate}`} hint={`${count(hw, "NOT_DONE")} yapılmayan`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Bugünün dersleri</h2>
            <Link href="/kurum/yoklama" className="text-sm font-medium text-brand-600">Yoklama al →</Link>
          </div>
          {todaySlots.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Bugün programda ders yok.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {todaySlots.map((s) => (
                  <tr key={s.id}>
                    <td className={`${td} font-mono text-xs text-slate-500`}>{s.startTime}–{s.endTime}</td>
                    <td className={td}>
                      <b>{s.classroom.name}</b> · {s.subject}
                      <div className="text-xs text-slate-500">{s.teacher.name} · {LESSON_TYPES[s.lessonType]}</div>
                    </td>
                    <td className={`${td} text-right`}>
                      {taken.has(s.id) ? (
                        <span className="badge bg-emerald-50 text-emerald-700">Yoklama alındı</span>
                      ) : (
                        <Link href={`/kurum/yoklama/al?program=${s.id}&tarih=${today}`} className="badge bg-amber-50 text-amber-700 hover:bg-amber-100">
                          Yoklama bekliyor
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Son denemeler</h2>
            <Link href="/kurum/denemeler" className="text-sm font-medium text-brand-600">Tümü →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Sınav</th>
                <th className={th}>Tarih</th>
                <th className={`${th} text-right`}>Katılım</th>
                <th className={`${th} text-right`}>Ort. net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className={td}>
                    <Link href={`/kurum/denemeler/${e.id}`} className="font-medium hover:text-brand-600">{e.name}</Link>
                    <span className="ml-1 text-xs text-slate-400">{EXAM_TYPES[e.type]?.label}</span>
                  </td>
                  <td className={`${td} text-slate-500`}>{fmtDate(e.date)}</td>
                  <td className={`${td} text-right`}>{e.results.length}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>
                    {e.results.length ? fmtNet(e.results.reduce((s, r) => s + r.totalNet, 0) / e.results.length) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Devamsızlığı yüksek öğrenciler (30 gün)</h2>
            <Link href="/kurum/raporlar" className="text-sm font-medium text-brand-600">Rapor →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {absentTop.map((a) => {
                const st = absentStudents.find((s) => s.id === a.studentId);
                if (!st) return null;
                return (
                  <tr key={a.studentId}>
                    <td className={td}>
                      <Link href={`/kurum/ogrenciler/${st.id}`} className="font-medium hover:text-brand-600">{st.firstName} {st.lastName}</Link>
                      <div className="text-xs text-slate-500">{st.classroom?.name} · Veli: {st.parentPhone || "—"}</div>
                    </td>
                    <td className={`${td} text-right`}>
                      <span className="badge bg-red-50 text-red-700">{a._count} ders gelmedi</span>
                    </td>
                  </tr>
                );
              })}
              {absentTop.length === 0 && (
                <tr><td className={`${td} text-slate-500`}>Devamsızlık kaydı yok.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Teslimi yaklaşan ödevler</h2>
            <Link href="/kurum/odevler" className="text-sm font-medium text-brand-600">Tümü →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {upcoming.map((h) => (
                <tr key={h.id}>
                  <td className={td}>
                    <Link href={`/kurum/odevler/${h.id}`} className="font-medium hover:text-brand-600">{h.title}</Link>
                    <div className="text-xs text-slate-500">{h.classroom.name} · {h.subject}</div>
                  </td>
                  <td className={`${td} text-right text-xs text-slate-500`}>{fmtDate(h.dueDate)}</td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr><td className={`${td} text-slate-500`}>Teslimi yaklaşan ödev yok.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
