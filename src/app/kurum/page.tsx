import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { institutionDashboard, setupSteps, successScores, type SetupStep } from "@/modules/reporting/server";
import { SCORE_RULES } from "@/modules/reporting";
import { DAYS } from "@/modules/schedule";
import LessonDay from "@/modules/schedule/ui/LessonDay";
import { EXAM_TYPES, fmtNet } from "@/modules/exams";
import { ALL_KINDS, defaultPlanStart, schoolYearLabel, schoolYearOf } from "@/modules/planning";
import { calendarFeed, holidaysOn, planOverview } from "@/modules/planning/server";
import { addDays } from "@/shared/date";
import { Kpi, PageHeader, th, td } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

const dayMonth = (d: string | Date, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Date(typeof d === "string" ? d + "T12:00:00" : d).toLocaleDateString("tr-TR", o);

/** Bugünün kokpiti: günün dersleri ve yoklaması, önümüzdeki hafta, dikkat isteyenler. */
export default async function Page() {
  const ownerId = await requireOwner();
  const d = await institutionDashboard(ownerId);
  const { today, dow, exams, attendance, homework } = d;
  const year = schoolYearOf(today);
  const [week, holidays, plans, scores, setup] = await Promise.all([
    calendarFeed(ownerId, { from: addDays(today, 1), to: addDays(today, 7) }),
    holidaysOn(ownerId, today),
    planOverview(ownerId, year, today),
    successScores(ownerId),
    setupSteps(ownerId),
  ]);
  const lastExam = exams[0];
  const weekNo = Math.floor((Date.parse(today) - Date.parse(defaultPlanStart(year))) / (7 * 86400000)) + 1;
  const behind = plans.filter((p) => p.plan && p.plan.progress.behindWeeks > 0);
  const takenCount = d.todaySlots.filter((s) => s.taken).length;
  const holidayFor = (classroomId: string) => holidays.find((h) => !h.classroomId || h.classroomId === classroomId);


  return (
    <div>
      <PageHeader
        title={`${DAYS[dow]}, ${dayMonth(today)}`}
        sub={
          holidays.length
            ? `Bugün takvimde tatil: ${holidays.map((h) => h.title).join(", ")}.`
            : weekNo >= 1 && weekNo <= 52
              ? `${schoolYearLabel(year)} eğitim yılının ${weekNo}. haftası`
              : `${schoolYearLabel(year)} eğitim yılı`
        }
      />

      <SetupGuide steps={setup} />

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Öğrenci" value={d.studentCount} hint={`${d.classCount} sınıfta`} />
        <Kpi label="Derse devam" value={attendance.rate === null ? "—" : `%${attendance.rate}`} hint={`Son 30 günde ${attendance.absent} kez gelinmedi`} />
        <Kpi label="Ödev yapma" value={homework.rate === null ? "—" : `%${homework.rate}`} hint={`Son 30 günde ${homework.notDone} ödev yapılmadı`} />
        <Kpi
          label="Son deneme ortalaması"
          value={lastExam && lastExam.avgNet !== null ? fmtNet(lastExam.avgNet) : "—"}
          hint={lastExam ? `${lastExam.name}, ${lastExam.participants} öğrenci` : "Henüz deneme yok"}
        />
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="bugun">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="bugun" className="text-xl font-semibold">Bugünün dersleri</h2>
            {d.todaySlots.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="num text-sm text-lead">
                  <b className="text-graphite">{takenCount}</b> / {d.todaySlots.length} yoklama alındı
                </span>
                <Link href="/kurum/yoklama" className="btn-primary">Yoklama al</Link>
              </div>
            )}
          </div>
          {d.todaySlots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-lead/40 px-5 py-8 text-lead">
              Bugün programda ders yok. Etüt veya ek ders için <Link href="/kurum/yoklama" className="font-semibold text-graphite underline decoration-ink/40 underline-offset-4">yoklama sayfasını</Link> kullanabilirsiniz.
            </p>
          ) : (
            <LessonDay
              lessons={d.todaySlots.map((s) => {
                const holiday = !s.taken && holidayFor(s.classroomId);
                return {
                  key: s.id,
                  href: `/kurum/yoklama/al?program=${s.id}&tarih=${today}`,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  classroom: s.classroom.name,
                  subject: s.subject,
                  teacher: s.teacher.name,
                  lessonType: s.lessonType,
                  state: s.taken ? "taken" : holiday ? "holiday" : "pending",
                  detail: holiday ? "tatil" : undefined,
                };
              })}
            />
          )}

          <h2 className="mt-10 mb-3 text-xl font-semibold">Son denemeler</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className={th}>Deneme</th>
                  <th className={th}>Tarih</th>
                  <th className={`${th} text-right`}>Katılım</th>
                  <th className={`${th} text-right`}>Ortalama net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      <Link href={`/kurum/denemeler/${e.id}`} className="font-semibold hover:text-ink">{e.name}</Link>
                      <span className="ml-2 text-[13px] text-lead">{EXAM_TYPES[e.type]?.label}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-lead`}>{dayMonth(e.date)}</td>
                    <td className={`${td} text-right`}>{e.participants}</td>
                    <td className={`${td} text-right font-semibold`}>{e.avgNet !== null ? fmtNet(e.avgNet) : "—"}</td>
                  </tr>
                ))}
                {exams.length === 0 && (
                  <tr>
                    <td className={`${td} text-lead`} colSpan={4}>
                      Henüz deneme yok. <Link href="/kurum/denemeler" className="font-semibold text-graphite underline decoration-ink/40 underline-offset-4">İlk denemeyi oluşturun</Link>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-10">
          <section aria-labelledby="hafta">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="hafta" className="text-xl font-semibold">Önümüzdeki 7 gün</h2>
              <Link href="/kurum/takvim" className="text-sm text-lead hover:text-graphite">Takvimi aç</Link>
            </div>
            {week.length === 0 ? (
              <p className="text-lead">Takvimde kayıt yok.</p>
            ) : (
              <ul className="space-y-2.5">
                {week.slice(0, 8).map((i) => {
                  const k = ALL_KINDS[i.kind] ?? ALL_KINDS.OTHER;
                  const body = (
                    <>
                      <span className="w-[4.5rem] shrink-0 text-[13px] text-lead">{dayMonth(i.start, { day: "numeric", month: "short", weekday: "short" })}</span>
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${k.dot}`} aria-hidden="true" />
                      <span className="min-w-0">
                        {i.title}
                        <span className="block text-[13px] text-lead">
                          {k.label}
                          {i.classroom && `, ${i.classroom}`}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={i.key}>
                      {i.href ? (
                        <Link href={i.href} className="flex gap-3 hover:text-ink">{body}</Link>
                      ) : (
                        <div className="flex gap-3">{body}</div>
                      )}
                    </li>
                  );
                })}
                {week.length > 8 && <li className="pl-[5.25rem] text-sm text-lead">ve {week.length - 8} kayıt daha</li>}
              </ul>
            )}
          </section>

          <section aria-labelledby="dikkat">
            <h2 id="dikkat" className="mb-3 text-xl font-semibold">Dikkat isteyenler</h2>
            <div className="space-y-6">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold">Risk seviyesine düşenler, son {SCORE_RULES.trendDays} gün</h3>
                  <Link href="/kurum/analiz?tab=skor&seviye=RISK" className="text-sm text-lead hover:text-graphite">
                    Risk altında {scores.levelCounts.RISK}
                  </Link>
                </div>
                {scores.newlyRisk.length === 0 ? (
                  <p className="text-sm text-lead">Bu dönemde risk seviyesine düşen öğrenci yok.</p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-y border-rule/70 text-sm">
                    {scores.newlyRisk.slice(0, 5).map((r) => (
                      <li key={r.id}>
                        <Link href={`/kurum/ogrenciler/${r.id}`} className="block py-2 hover:text-ink">
                          <span className="flex justify-between gap-3">
                            <span>
                              {r.name} <span className="text-lead">{r.className}</span>
                            </span>
                            <span className="num whitespace-nowrap text-red-700">
                              {r.prevScore} → {r.score}
                            </span>
                          </span>
                          {r.reasons[0] && <span className="block text-[13px] text-lead">{r.reasons[0]}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-1.5 text-[15px] font-semibold">Yıllık plana göre geride</h3>
                {behind.length === 0 ? (
                  <p className="text-sm text-lead">Planı olan bütün dersler takvimde.</p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-y border-rule/70 text-sm">
                    {behind.map((b) => (
                      <li key={b.plan!.id}>
                        <Link href={`/kurum/takvim/plan/${b.plan!.id}`} className="flex justify-between gap-3 py-2 hover:text-ink">
                          <span><b>{b.classroom}</b> {b.subject}</span>
                          <span className="num text-red-700">{b.plan!.progress.behindWeeks} hafta</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold">En çok devamsızlık, son 30 gün</h3>
                  <Link href="/kurum/raporlar" className="text-sm text-lead hover:text-graphite">Devam raporu</Link>
                </div>
                {d.topAbsentees.length === 0 ? (
                  <p className="text-sm text-lead">Devamsızlık kaydı yok.</p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-y border-rule/70 text-sm">
                    {d.topAbsentees.slice(0, 5).map(({ student: st, absent }) => (
                      <li key={st.id}>
                        <Link href={`/kurum/ogrenciler/${st.id}`} className="flex justify-between gap-3 py-2 hover:text-ink">
                          <span>
                            {st.firstName} {st.lastName} <span className="text-lead">{st.classroom?.name}</span>
                          </span>
                          <span className="num whitespace-nowrap text-red-700">{absent} ders</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {d.upcomingHomework.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-[15px] font-semibold">Teslimi yaklaşan ödevler</h3>
                  <ul className="divide-y divide-rule/70 border-y border-rule/70 text-sm">
                    {d.upcomingHomework.map((h) => (
                      <li key={h.id}>
                        <Link href={`/kurum/odevler/${h.id}`} className="flex justify-between gap-3 py-2 hover:text-ink">
                          <span className="min-w-0 truncate">
                            <b>{h.classroom.name}</b> {h.title}
                          </span>
                          <span className="whitespace-nowrap text-lead">{dayMonth(h.dueDate, { day: "numeric", month: "short" })}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Kurulum rehberi: yeni kurumda tanımların sırası ve sayıları. Hepsi tamamlanınca görünmez.
 * Sıradaki adım (ilk boş adım) öne çıkar; her adım ilgili sayfaya (çoğunda ekleme paneline) götürür.
 */
function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.count > 0).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => s.count === 0)!;
  return (
    <section className="card mb-5 px-4 py-3" aria-label="Kurulum">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Kurulum <span className="font-normal text-lead">· {done}/{steps.length} adım</span>
        </h2>
        <Link href={next.href} className="btn-primary py-1.5 text-sm">Sıradaki: {next.action}</Link>
      </div>
      <ol className="mt-2 flex flex-wrap gap-x-1 gap-y-1.5 text-[13.5px]">
        {steps.map((s, i) => {
          const ok = s.count > 0;
          const isNext = s.key === next.key;
          return (
            <li key={s.key} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="mx-1 text-lead/50">›</span>}
              <Link
                href={s.href}
                className={`rounded-full px-2.5 py-0.5 ring-1 ${isNext ? "bg-graphite text-surface ring-graphite" : ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "text-lead ring-rule hover:text-graphite"}`}
              >
                {i + 1}. {s.label}
                {ok && <span className="num"> · {s.count} {s.unit} ✓</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
