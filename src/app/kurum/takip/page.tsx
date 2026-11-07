import Link from "next/link";
import { ymd } from "@/shared/date";
import { requireUser } from "@/modules/identity/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { attention, classComparison, courseAnalysis, teacherActivity, FOLLOW_RULES } from "@/modules/reporting/server";
import { COURSE_KINDS } from "@/modules/schedule";
import { fmtPercent, percentTone } from "@/modules/assessment";
import { Empty, PageHeader, Tabs, th, td } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; kapsam?: string; sinif?: string }>;

const KIND_LABEL = { devam: "Devam", not: "Not", odev: "Ödev" } as const;
const KIND_CLS = { devam: "bg-red-50 text-red-700", not: "bg-amber-50 text-amber-800", odev: "bg-violet-50 text-violet-700" } as const;
const shortDate = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—");

/**
 * Takibat: dikkat isteyenler, sınıflar, dersler, öğretmenler. Etüt mesulünde kapsam varsayılan olarak
 * kendi sınıflarıdır ("Tüm kurum" ile genişler); kurum hesabında bütün kurum (sınıf süzgeci var).
 */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const ownerId = user.id;
  const sp = await searchParams;
  const tab = ["siniflar", "dersler", "ogretmenler"].includes(sp.tab ?? "") ? sp.tab! : "dikkat";
  const today = ymd();
  const classes = await classroomsOf(ownerId);
  const mine = user.staff ? classes.filter((c) => c.mentorId === user.staff!.teacherId) : [];
  const wide = sp.kapsam === "kurum" || !mine.length;
  const classIds = sp.sinif ? [sp.sinif] : wide ? null : mine.map((c) => c.id);
  const scopeLabel = sp.sinif ? classes.find((c) => c.id === sp.sinif)?.name ?? "" : wide ? "Tüm kurum" : mine.map((c) => c.name).join(", ");

  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: tab === "dikkat" ? undefined : tab, kapsam: sp.kapsam, sinif: sp.sinif, ...p })) if (v) u.set(k, v);
    const s = u.toString();
    return `/kurum/takip${s ? `?${s}` : ""}`;
  };
  const tabs = [
    { key: "dikkat", label: "Dikkat isteyenler", href: q({ tab: undefined }) },
    { key: "siniflar", label: "Sınıflar", href: q({ tab: "siniflar" }) },
    { key: "dersler", label: "Dersler", href: q({ tab: "dersler" }) },
    { key: "ogretmenler", label: "Öğretmenler", href: q({ tab: "ogretmenler" }) },
  ];

  const scope = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {mine.length > 0 && (
        <>
          <Link href={q({ kapsam: undefined, sinif: undefined })} className={`rounded-full px-3 py-1 text-sm font-medium ${!wide && !sp.sinif ? "bg-graphite text-white" : "bg-surface ring-1 ring-rule"}`}>Sınıfım</Link>
          <Link href={q({ kapsam: "kurum", sinif: undefined })} className={`rounded-full px-3 py-1 text-sm font-medium ${wide && !sp.sinif ? "bg-graphite text-white" : "bg-surface ring-1 ring-rule"}`}>Tüm kurum</Link>
        </>
      )}
      <form className="flex gap-2">
        {tab !== "dikkat" && <input type="hidden" name="tab" value={tab} />}
        <select name="sinif" defaultValue={sp.sinif ?? ""} className="input w-auto py-1">
          <option value="">{mine.length ? "Sınıf seç…" : "Tüm sınıflar"}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary py-1">Göster</button>
      </form>
      <span className="text-[13px] text-lead">Kapsam: {scopeLabel}</span>
    </div>
  );
  const header = <PageHeader title="Takip" sub="Bu hafta kime, hangi derse, hangi hocaya bakmalı?" />;

  if (tab === "siniflar") {
    const rows = await classComparison(ownerId, today, classIds);
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        {scope}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={th}>Etüt mesulü</th>
                <th className={`${th} text-right`}>Öğrenci</th>
                <th className={`${th} text-right`}>Devam</th>
                <th className={`${th} text-right`}>Ödev</th>
                <th className={`${th} text-right`}>Sözlü/yazılı ort.</th>
                <th className={`${th} text-right`}>Geride plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}><Link href={`/kurum/siniflar/${r.id}`} className="font-semibold hover:underline">{r.name}</Link></td>
                  <td className={`${td} text-lead`}>{r.mentor ?? "—"}</td>
                  <td className={`${td} num text-right`}>{r.students}</td>
                  <td className={`${td} num text-right ${r.attendance !== null && r.attendance < 90 ? "font-semibold text-red-700" : ""}`}>{fmtPercent(r.attendance)}</td>
                  <td className={`${td} num text-right ${r.homework !== null && r.homework < 70 ? "font-semibold text-amber-700" : ""}`}>{fmtPercent(r.homework)}</td>
                  <td className={`${td} num text-right font-semibold ${percentTone(r.assessAvg)}`}>{fmtPercent(r.assessAvg)} <span className="font-normal text-lead">({r.assessCount})</span></td>
                  <td className={`${td} num text-right ${r.behind ? "font-semibold text-amber-700" : "text-lead"}`}>{r.behind || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-lead">Son 30 gün. Devam %90, ödev %70 altı vurgulanır. Sözlü/yazılı ortalaması yüzdedir; parantezde puan sayısı.</p>
      </>
    );
  }

  if (tab === "dersler") {
    const groups = await courseAnalysis(ownerId, today, classIds);
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        {scope}
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.name} className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-rule/70 px-3.5 py-2.5">
                <h2 className="font-semibold">{g.name}</h2>
                <span className={`badge ${COURSE_KINDS[g.kind]?.cls ?? ""}`}>{COURSE_KINDS[g.kind]?.label}</span>
                {g.criteria.length > 0 && (
                  <span className="ml-auto text-[13px] text-lead">
                    Kriterler: {g.criteria.map((c, i) => (
                      <span key={c.name}>{i > 0 && " · "}{c.name} <span className={`num font-semibold ${percentTone(c.avg)}`}>{fmtPercent(c.avg)}</span></span>
                    ))}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-rule/70">
                {g.rows.map((r) => (
                  <li key={r.courseId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3.5 py-2">
                    <Link href={`/kurum/siniflar/${r.classroomId}`} className="w-24 font-medium hover:underline">{r.classroom}</Link>
                    <span className="min-w-32 flex-1 text-[13px] text-lead">{r.teacher ?? "Sorumlu yok"}{r.external ? " · dışarıda" : ""}</span>
                    <span className="text-[13px] text-lead">{r.count ? `${r.count} değerlendirme` : <span className="text-amber-700">değerlendirme yok</span>}</span>
                    {r.weakest && <span className="text-[13px] text-lead">en zayıf: {r.weakest.name} <span className={`num ${percentTone(r.weakest.avg)}`}>{fmtPercent(r.weakest.avg)}</span></span>}
                    {r.plan && (
                      <Link href={`/kurum/takvim/plan/${r.plan.id}`} className={`text-[13px] hover:underline ${r.plan.behindWeeks ? "font-semibold text-amber-700" : "text-lead"}`}>
                        plan %{r.plan.rate}{r.plan.behindWeeks ? ` · ${r.plan.behindWeeks} hafta geride` : ""}
                      </Link>
                    )}
                    <span className={`num w-14 text-right font-semibold ${percentTone(r.avg)}`}>{fmtPercent(r.avg)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <Empty>Kapsamda ders yok.</Empty>}
        </div>
        <p className="mt-2 text-[13px] text-lead">Son 60 gün. Aynı adlı ders sınıflar arasında karşılaştırılır; kriter ortalamaları bütün sınıfların birleşimidir.</p>
      </>
    );
  }

  if (tab === "ogretmenler") {
    const rows = await teacherActivity(ownerId, today);
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Öğretmen</th>
                <th className={`${th} text-right`}>Ders (14 gün)</th>
                <th className={`${th} text-right`}>Yoklaması alınan</th>
                <th className={`${th} text-right`}>İşaretlenen konu</th>
                <th className={`${th} text-right`}>Sözlü/yazılı</th>
                <th className={th}>Son giriş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {rows.map((t) => {
                const missing = t.lessons - t.taken;
                return (
                  <tr key={t.id}>
                    <td className={td}>
                      <Link href={`/kurum/ders-programi/ogretmen/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                      {t.role === "MENTOR" && <span className="ml-1.5 text-[12px] text-lead">etüt mesulü</span>}
                    </td>
                    <td className={`${td} num text-right`}>{t.lessons}</td>
                    <td className={`${td} num text-right ${missing ? "font-semibold text-amber-700" : ""}`}>{t.taken}{missing ? ` (${missing} eksik)` : ""}</td>
                    <td className={`${td} num text-right ${t.plans && !t.topics ? "text-amber-700" : ""}`}>{t.plans ? t.topics : "—"}</td>
                    <td className={`${td} num text-right`}>{t.assessments || "—"}</td>
                    <td className={`${td} text-lead`}>{shortDate(t.lastEntry)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-lead">Son 14 gün; tatiller hariç. Bu tablo sıralama değil, giriş düzenini görmek içindir. “İşaretlenen konu” yalnızca yıllık planı olan derslerde sayılır.</p>
      </>
    );
  }

  const a = await attention(ownerId, today, classIds);
  const R = FOLLOW_RULES;
  return (
    <>
      {header}
      <Tabs tabs={tabs} active={tab} />
      {scope}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card">
          <div className="border-b border-rule/70 px-3.5 py-2.5">
            <h2 className="font-semibold">Öğrenciler <span className="font-normal text-lead">({a.students.length} / {a.scopeSize})</span></h2>
            <p className="text-[12.5px] text-lead">
              Son {R.absentDays} günde derslerinin %{R.absentRate * 100}+ kadarına ({R.absentMin}+) gelmeme, aynı derste {R.dropPoints}+ puan düşüş ya da %{R.lowAvg} altı ortalama, {R.homeworkMissMin}+ yapılmayan ödev.
            </p>
          </div>
          <ul className="divide-y divide-rule/70">
            {a.students.map((s) => (
              <li key={s.id}>
                <Link href={`/kurum/ogrenciler/${s.id}`} className="block px-3.5 py-2.5 hover:bg-paper active:bg-paper">
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-[13px] text-lead">{s.classroom}</span>
                  </span>
                  <span className="mt-0.5 flex flex-col gap-0.5">
                    {s.reasons.map((r, i) => (
                      <span key={i} className="text-[13px]">
                        <span className={`badge mr-1.5 ${KIND_CLS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                        {r.text}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
            {a.students.length === 0 && <li className="px-3.5 py-4 text-sm text-lead">Bu kapsamda dikkat isteyen öğrenci yok.</li>}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="card">
            <h2 className="border-b border-rule/70 px-3.5 py-2.5 font-semibold">Girişi eksik ({R.entryDays} gün)</h2>
            <ul className="divide-y divide-rule/70">
              {a.entries.map((t) => (
                <li key={t.teacherId} className="px-3.5 py-2">
                  <Link href={`/kurum/ders-programi/ogretmen/${t.teacherId}`} className="font-medium hover:underline">{t.teacher}</Link>
                  <span className="text-[13px] text-amber-700"> · {t.count} dersin yoklaması yok</span>
                  <div className="text-[12.5px] text-lead">{t.lessons.join(" · ")}{t.count > t.lessons.length ? " …" : ""}</div>
                </li>
              ))}
              {a.entries.length === 0 && <li className="px-3.5 py-3 text-sm text-lead">Bütün yoklamalar girilmiş.</li>}
            </ul>
          </section>
          <section className="card">
            <h2 className="border-b border-rule/70 px-3.5 py-2.5 font-semibold">Plana göre geride</h2>
            <ul className="divide-y divide-rule/70">
              {a.plans.map((p) => (
                <li key={p.planId} className="px-3.5 py-2">
                  <Link href={`/kurum/takvim/plan/${p.planId}`} className="font-medium hover:underline">{p.classroom} · {p.subject}</Link>
                  <span className="text-[13px] text-amber-700"> · {p.behindWeeks} hafta geride, {p.late} konu bekliyor</span>
                  {p.teachers.length > 0 && <div className="text-[12.5px] text-lead">{p.teachers.join(", ")}</div>}
                </li>
              ))}
              {a.plans.length === 0 && <li className="px-3.5 py-3 text-sm text-lead">Geride kalan plan yok.</li>}
            </ul>
          </section>
          <section className="card">
            <h2 className="border-b border-rule/70 px-3.5 py-2.5 font-semibold">{R.quietDays} gündür sözlü/yazılı yok ({a.quiet.length})</h2>
            <ul className="divide-y divide-rule/70">
              {a.quiet.slice(0, 12).map((c) => (
                <li key={`${c.classroomId}-${c.course}`} className="flex items-baseline gap-2 px-3.5 py-1.5 text-sm">
                  <Link href={`/kurum/siniflar/${c.classroomId}`} className="font-medium hover:underline">{c.classroom}</Link>
                  <span>{c.course}{c.external ? " (dışarıda)" : ""}</span>
                  <span className="ml-auto text-[12.5px] text-lead">{c.teacher ?? "sorumlu yok"} · son: {shortDate(c.last)}</span>
                </li>
              ))}
              {a.quiet.length > 12 && <li className="px-3.5 py-1.5 text-[13px] text-lead">ve {a.quiet.length - 12} ders daha</li>}
              {a.quiet.length === 0 && <li className="px-3.5 py-3 text-sm text-lead">Bütün derslerde son 30 günde değerlendirme var.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
