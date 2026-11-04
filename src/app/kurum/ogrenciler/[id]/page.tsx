import Link from "next/link";
import { notFound } from "next/navigation";
import { ATTENDANCE } from "@/modules/schedule";
import { classroomsOf, findStudent } from "@/modules/enrollment/server";
import { HOMEWORK } from "@/modules/homework";
import { institutionName, requireOwner } from "@/modules/identity/server";
import { EXAM_TYPES, fmtDate, fmtNet, parseSections } from "@/modules/exams";
import { Kpi, PageHeader, th, td } from "@/shared/ui/kurum";
import StudentForm from "@/modules/enrollment/ui/StudentForm";
import PrintButton from "@/shared/ui/PrintButton";
import VeliCard from "@/modules/reporting/ui/veli/VeliCard";
import { combinedTopics } from "@/modules/exams";
import { defaultPeriod, studentOverview } from "@/modules/reporting/server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const st = await findStudent(ownerId, id);
  if (!st) notFound();
  const [{ results, homework, attendance }, classes, institution] = await Promise.all([
    studentOverview(ownerId, st.id),
    classroomsOf(ownerId),
    institutionName(ownerId),
  ]);
  const period = defaultPeriod();

  // Sınav türüne göre gruplanmış sonuçlar (birleştirilmiş karne)
  const byType = new Map<string, typeof results>();
  for (const r of results) byType.set(r.exam.type, [...(byType.get(r.exam.type) ?? []), r]);

  const weakTopics = combinedTopics(results)
    .filter((t) => t.rate < 50)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 15);

  const hw = homework.counts;
  const homeworks = homework.list;
  const att = attendance.counts;
  const absences = attendance.absences.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${st.firstName} ${st.lastName}`}
        sub={`No: ${st.studentNo} · ${st.classroom?.name ?? (st.external ? "Kurum dışı öğrenci" : "Sınıfsız")}`}
        back={{ href: "/kurum/ogrenciler", label: "Öğrenciler" }}
        actions={<PrintButton label="🖨️ Öğrenci raporunu yazdır" />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Girdiği deneme" value={results.length} />
        <Kpi label="Ödev yapma" value={homework.rate === null ? "—" : `%${homework.rate}`} hint={`${hw.DONE} yaptı · ${hw.PARTIAL} eksik · ${hw.NOT_DONE} yapmadı`} />
        <Kpi label="Devam" value={attendance.rate === null ? "—" : `%${attendance.rate}`} hint={`${att.ABSENT} gelmedi · ${att.LATE} geç · ${att.EXCUSED} izinli`} />
        <Kpi label="Veli" value={<span className="text-base">{st.parentName || "—"}</span>} hint={st.parentPhone} />
      </div>

      <VeliCard
        institution={institution}
        from={period.from}
        to={period.to}
        student={{
          id: st.id,
          name: `${st.firstName} ${st.lastName}`,
          studentNo: st.studentNo,
          className: st.classroom?.name ?? "",
          parentName: st.parentName,
          parentPhone: st.parentPhone,
          token: st.parentToken,
          sharedAt: st.parentSharedAt?.toISOString() ?? null,
          viewedAt: st.parentViewedAt?.toISOString() ?? null,
          note: st.parentNote,
        }}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Girdiği sınavlar</h2>
        {results.length === 0 && <div className="card p-6 text-sm text-slate-500">Henüz deneme sonucu yok.</div>}
        {[...byType.entries()].map(([type, results]) => {
          const secs = parseSections(results[results.length - 1].exam.sections);
          const stats = results.map((r) => JSON.parse(r.stats) as { d: number; y: number; b: number; net: number }[]);
          const avg = secs.map((_, si) => stats.reduce((s, x) => s + (x[si]?.net ?? 0), 0) / stats.length);
          const avgTotal = results.reduce((s, r) => s + r.totalNet, 0) / results.length;
          const maxNet = secs.reduce((s, x) => s + x.count, 0);
          return (
            <div key={type} className="card mb-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold">
                  {EXAM_TYPES[type]?.label ?? type} · {results.length} sınav
                  <Link href={`/kurum/ogrenciler/${st.id}/birlesik?tur=${type}`} className="no-print ml-3 text-xs font-medium text-brand-600 hover:underline">
                    Birleştirilmiş karne →
                  </Link>
                </h3>
                <NetTrend values={results.map((r) => r.totalNet)} max={maxNet} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={th}>Sınav</th>
                      <th className={th}>Tarih</th>
                      {secs.map((s) => (
                        <th key={s.name} className={`${th} text-right`}>{s.name}</th>
                      ))}
                      <th className={`${th} text-right`}>Toplam net</th>
                      <th className={`${th} text-right`}>Puan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r, i) => (
                      <tr key={r.id}>
                        <td className={`${td} font-medium`}>{r.exam.name}</td>
                        <td className={`${td} text-slate-500`}>{fmtDate(r.exam.date)}</td>
                        {secs.map((s, si) => (
                          <td key={s.name} className={`${td} text-right tabular-nums`}>{fmtNet(stats[i][si]?.net ?? 0)}</td>
                        ))}
                        <td className={`${td} text-right font-bold tabular-nums`}>{fmtNet(r.totalNet)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNet(r.score)}</td>
                        <td className={`${td} text-right`}>
                          <Link className="no-print text-brand-600 hover:underline" href={`/kurum/denemeler/${r.examId}/karne/${r.id}`}>Karne</Link>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-brand-50 font-semibold text-brand-700">
                      <td className={td} colSpan={2}>Ortalama (birleştirilmiş)</td>
                      {avg.map((a, si) => (
                        <td key={si} className={`${td} text-right tabular-nums`}>{fmtNet(a)}</td>
                      ))}
                      <td className={`${td} text-right tabular-nums`}>{fmtNet(avgTotal)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtNet(results.reduce((a, r) => a + r.score, 0) / results.length)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      {weakTopics.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold">Konu eksikleri <span className="text-xs font-normal text-slate-500">(tüm denemelerde doğru oranı %50’nin altında)</span></h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weakTopics.map((t) => (
              <span key={t.section + t.topic} className="rounded-lg bg-red-50 px-2.5 py-1 text-xs text-red-800 ring-1 ring-red-100">
                {t.topic} <span className="text-red-500">· {t.section}</span> <b>%{t.rate}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Son ödevler</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {homeworks.slice(0, 8).map((h) => (
                <tr key={h.id}>
                  <td className={td}>
                    <Link href={`/kurum/odevler/${h.homeworkId}`} className="hover:text-brand-600">{h.homework.title}</Link>
                    <div className="text-xs text-slate-500">{h.homework.subject} · teslim {fmtDate(h.homework.dueDate)}</div>
                  </td>
                  <td className={`${td} text-right`}>
                    <span className={`badge ${HOMEWORK[h.status]?.cls}`}>{HOMEWORK[h.status]?.label}</span>
                  </td>
                </tr>
              ))}
              {homeworks.length === 0 && (
                <tr><td className={`${td} text-slate-500`}>Ödev kaydı yok.</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Son devamsızlıklar</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {absences.map((a) => (
                <tr key={a.id}>
                  <td className={td}>
                    {fmtDate(a.session.date)} · {a.session.startTime}
                    <div className="text-xs text-slate-500">{a.session.subject}</div>
                  </td>
                  <td className={`${td} text-right`}>
                    <span className={`badge ${ATTENDANCE[a.status]?.cls}`}>{ATTENDANCE[a.status]?.label}</span>
                  </td>
                </tr>
              ))}
              {absences.length === 0 && (
                <tr><td className={`${td} text-slate-500`}>Devamsızlık yok. 👏</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="no-print card p-6">
        <h2 className="mb-4 font-semibold">Öğrenci bilgileri</h2>
        <StudentForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          studentId={st.id}
          initial={{
            studentNo: st.studentNo,
            firstName: st.firstName,
            lastName: st.lastName,
            classroomId: st.classroomId ?? "",
            phone: st.phone,
            parentName: st.parentName,
            parentPhone: st.parentPhone,
            external: st.external,
          }}
        />
      </section>
    </div>
  );
}

/** Küçük net gelişim grafiği (SVG). */
function NetTrend({ values, max }: { values: number[]; max: number }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 36;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 4 - (Math.max(0, v) / max) * (h - 8)]);
  const up = values[values.length - 1] >= values[0];
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      Net gelişimi
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={up ? "#059669" : "#dc2626"} strokeWidth={2} />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={up ? "#059669" : "#dc2626"} />
        ))}
      </svg>
      <span className={up ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
        {up ? "▲" : "▼"} {fmtNet(Math.abs(values[values.length - 1] - values[0]))}
      </span>
    </div>
  );
}
