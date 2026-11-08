import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { ALL_KINDS, mondayOf } from "@/modules/planning";
import { calendarFeed, plansForPairs } from "@/modules/planning/server";
import { DAYS, LESSON_TYPES, teacherSub } from "@/modules/schedule";
import { findTeacher, listSlots } from "@/modules/schedule/server";
import { addDays, ymd } from "@/shared/date";
import { subjectMatches } from "@/shared/subjects";
import { Empty, Kpi, PageHeader, td, th } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

const fmt = (d: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", o);

/** Öğretmen görünümü: haftalık program, derslerinin yıllık plan durumu ve yaklaşan takvim. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const teacher = await findTeacher(ownerId, id);
  if (!teacher) notFound();
  const today = ymd();
  const thisWeek = mondayOf(today);

  const slots = await listSlots(ownerId, { teacherId: teacher.id });
  const pairMap = new Map<string, { classroomId: string; classroom: string; subject: string; weekly: number }>();
  for (const s of slots) {
    const k = `${s.classroomId}|${s.subject}`;
    const p = pairMap.get(k) ?? { classroomId: s.classroomId, classroom: s.classroom.name, subject: s.subject, weekly: 0 };
    p.weekly++;
    pairMap.set(k, p);
  }
  const pairs = [...pairMap.values()].sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.subject.localeCompare(b.subject, "tr"));
  const classIds = [...new Set(pairs.map((p) => p.classroomId))];
  const subjects = [...new Set(pairs.map((p) => p.subject))];

  const [plans, feed] = await Promise.all([
    plansForPairs(ownerId, pairs, today),
    classIds.length ? calendarFeed(ownerId, { from: today, to: addDays(today, 14) }, classIds) : Promise.resolve([]),
  ]);
  // Öğretmeni ilgilendirmeyen ödevler (başka derslerin) çıkarılır
  const upcoming = feed.filter((i) => i.kind !== "ODEV" || subjects.some((s) => subjectMatches(i.subject ?? "", s)));
  const planned = plans.filter((p) => p.plan);
  const behind = planned.filter((p) => p.plan!.progress.behindWeeks > 0);

  return (
    <div>
      <PageHeader
        back={{ href: teacher.role === "MENTOR" ? "/kurum/personel?rol=mesul" : "/kurum/personel", label: "Personel" }}
        title={teacher.name}
        sub={`${teacherSub(teacher)} · ${fmt(thisWeek, { day: "numeric", month: "long" })} haftası`}
        actions={
          <>
            <Link href={`/kurum/ders-programi?gorunum=ogretmen&ogretmen=${teacher.id}`} className="btn-secondary">Programı düzenle</Link>
            <PrintButton />
          </>
        }
      />
      <h1 className="mb-4 hidden text-xl font-bold print:block">
        {teacher.name} · {teacherSub(teacher)} — {fmt(thisWeek, { day: "numeric", month: "long", year: "numeric" })} haftası
      </h1>

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Haftalık ders" value={slots.length} />
        <Kpi label="Sınıf" value={classIds.length} hint={subjects.join(", ") || "—"} />
        <Kpi label="Planlı ders" value={`${planned.length} / ${pairs.length}`} />
        <Kpi label="Plana göre geride" value={behind.length} hint={behind.map((b) => `${b.classroom} ${b.subject}`).join(", ") || "yok"} />
      </div>

      {pairs.length === 0 ? (
        <Empty>Bu öğretmenin ders programında dersi yok.</Empty>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-lg font-semibold">Bu hafta plana göre</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper">
                  <tr>
                    <th className={th}>Sınıf</th>
                    <th className={th}>Ders</th>
                    <th className={th}>Bu hafta işlenecek</th>
                    <th className={th}>Sıradaki işlenmemiş konu</th>
                    <th className={th}>Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/70">
                  {plans.map((p) => (
                    <tr key={`${p.classroomId}|${p.subject}`}>
                      <td className={`${td} font-medium`}>{p.classroom}</td>
                      <td className={td}>{p.subject}</td>
                      {!p.plan ? (
                        <td className={`${td} text-lead`} colSpan={3}>
                          Yıllık plan yok.{" "}
                          <Link href={`/kurum/takvim/plan/yeni?sinif=${p.classroomId}&ders=${encodeURIComponent(p.subject)}`} className="text-brand-700 hover:underline">
                            Plan oluştur
                          </Link>
                        </td>
                      ) : (
                        <>
                          <td className={td}>
                            {p.plan.thisWeek.length === 0 ? (
                              <span className="text-lead/70">—</span>
                            ) : (
                              p.plan.thisWeek.map((t) => (
                                <div key={t.topic} className={t.done ? "text-lead/70 line-through" : ""}>{t.topic}</div>
                              ))
                            )}
                          </td>
                          <td className={td}>
                            {p.plan.next ? (
                              <>
                                {p.plan.next.topic}
                                <span className="ml-1 text-xs text-lead">({fmt(p.plan.next.week)} haftası)</span>
                              </>
                            ) : (
                              <span className="text-emerald-700">Plan tamamlandı</span>
                            )}
                          </td>
                          <td className={td}>
                            <Link href={`/kurum/takvim/plan/${p.plan.id}`}>
                              {p.plan.progress.behindWeeks > 0 ? (
                                <span className="badge bg-red-50 text-red-700">{p.plan.progress.behindWeeks} hafta geride</span>
                              ) : (
                                <span className="badge bg-emerald-50 text-emerald-700">Plana uygun</span>
                              )}
                              <span className="ml-1 text-xs text-lead">{p.plan.progress.done}/{p.plan.progress.total}</span>
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-2 text-lg font-semibold">Haftalık program</h2>
              <div className="card divide-y divide-rule/70 text-sm">
                {[1, 2, 3, 4, 5, 6, 7]
                  .filter((d) => slots.some((s) => s.dayOfWeek === d))
                  .map((d) => (
                    <div key={d} className="flex gap-4 px-4 py-2">
                      <div className="w-24 shrink-0 font-medium">{DAYS[d]}</div>
                      <div className="flex-1 space-y-0.5">
                        {slots
                          .filter((s) => s.dayOfWeek === d)
                          .map((s) => (
                            <div key={s.id}>
                              <span className="num text-xs text-lead">{s.startTime}–{s.endTime}</span> {s.classroom.name} · {s.subject}
                              {s.lessonType !== "GRUP" && <span className="text-xs text-lead"> · {LESSON_TYPES[s.lessonType]}</span>}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-lg font-semibold">Yaklaşan 14 gün</h2>
              {upcoming.length === 0 ? (
                <Empty>Sınıflarına ait yaklaşan kayıt yok.</Empty>
              ) : (
                <ul className="card divide-y divide-rule/70 text-sm">
                  {upcoming.map((u) => {
                    const k = ALL_KINDS[u.kind] ?? ALL_KINDS.OTHER;
                    return (
                      <li key={u.key} className="flex items-start gap-3 px-4 py-2">
                        <span className="w-24 shrink-0 text-lead">
                          {fmt(u.start, { day: "numeric", month: "short", weekday: "short" })}
                        </span>
                        <span className={`badge shrink-0 ring-1 ring-inset ${k.cls}`}>{k.label}</span>
                        <span>
                          {u.title}
                          {u.classroom && <span className="text-xs text-lead"> · {u.classroom}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
