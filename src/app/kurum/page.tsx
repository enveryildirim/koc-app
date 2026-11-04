import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { institutionDashboard } from "@/modules/reporting/server";
import { DAYS, LESSON_TYPES } from "@/modules/schedule";
import { EXAM_TYPES, fmtDate, fmtNet } from "@/modules/exams";
import { Kpi, PageHeader, th, td } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const d = await institutionDashboard(ownerId);
  const { today, dow, exams, attendance, homework } = d;
  const lastExam = exams[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Kurum Özeti" sub={`${DAYS[dow]}, ${fmtDate(today)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Öğrenci" value={d.studentCount} hint={`${d.classCount} sınıf`} />
        <Kpi
          label="Son deneme ort."
          value={lastExam && lastExam.avgNet !== null ? fmtNet(lastExam.avgNet) : "—"}
          hint={lastExam ? `${lastExam.name} · ${lastExam.participants} öğrenci` : "Deneme yok"}
        />
        <Kpi label="Devam (30 gün)" value={attendance.rate === null ? "—" : `%${attendance.rate}`} hint={`${attendance.absent} devamsızlık`} />
        <Kpi label="Ödev yapma (30 gün)" value={homework.rate === null ? "—" : `%${homework.rate}`} hint={`${homework.notDone} yapılmayan`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Bugünün dersleri</h2>
            <Link href="/kurum/yoklama" className="text-sm font-medium text-brand-600">Yoklama al →</Link>
          </div>
          {d.todaySlots.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Bugün programda ders yok.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {d.todaySlots.map((s) => (
                  <tr key={s.id}>
                    <td className={`${td} font-mono text-xs text-slate-500`}>{s.startTime}–{s.endTime}</td>
                    <td className={td}>
                      <b>{s.classroom.name}</b> · {s.subject}
                      <div className="text-xs text-slate-500">{s.teacher.name} · {LESSON_TYPES[s.lessonType]}</div>
                    </td>
                    <td className={`${td} text-right`}>
                      {s.taken ? (
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
                  <td className={`${td} text-right`}>{e.participants}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>
                    {e.avgNet !== null ? fmtNet(e.avgNet) : "—"}
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
              {d.topAbsentees.map(({ student: st, absent }) => {
                return (
                  <tr key={st.id}>
                    <td className={td}>
                      <Link href={`/kurum/ogrenciler/${st.id}`} className="font-medium hover:text-brand-600">{st.firstName} {st.lastName}</Link>
                      <div className="text-xs text-slate-500">{st.classroom?.name} · Veli: {st.parentPhone || "—"}</div>
                    </td>
                    <td className={`${td} text-right`}>
                      <span className="badge bg-red-50 text-red-700">{absent} ders gelmedi</span>
                    </td>
                  </tr>
                );
              })}
              {d.topAbsentees.length === 0 && (
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
              {d.upcomingHomework.map((h) => (
                <tr key={h.id}>
                  <td className={td}>
                    <Link href={`/kurum/odevler/${h.id}`} className="font-medium hover:text-brand-600">{h.title}</Link>
                    <div className="text-xs text-slate-500">{h.classroom.name} · {h.subject}</div>
                  </td>
                  <td className={`${td} text-right text-xs text-slate-500`}>{fmtDate(h.dueDate)}</td>
                </tr>
              ))}
              {d.upcomingHomework.length === 0 && (
                <tr><td className={`${td} text-slate-500`}>Teslimi yaklaşan ödev yok.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
