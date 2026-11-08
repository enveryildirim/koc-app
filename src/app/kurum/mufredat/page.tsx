import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { CURRICULUM_COLUMNS, curriculumGradeOptions, gradeLabel, gradeScope } from "@/modules/curriculum";
import { allCurriculum, curriculumSets, curriculumTopics } from "@/modules/curriculum/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { listCourses } from "@/modules/schedule/server";
import { subjectMatches } from "@/shared/subjects";
import { curriculumTracking } from "@/modules/reporting/server";
import CurriculumEditor from "@/modules/curriculum/ui/CurriculumEditor";
import CurriculumImport from "@/modules/curriculum/ui/CurriculumImport";
import ExportButton from "@/shared/ui/ExportButton";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type SP = Promise<{ ders?: string; sinif?: string; sekme?: string; yeni?: string }>;

const q = (p: Record<string, string>) => `/kurum/mufredat?${new URLSearchParams(p)}`;

/** Müfredat setini kullanan sınıflar: düzeyi uyan ve bu dersi (adı eşleşen) alan sınıflar. */
type ClassUse = { id: string; name: string; level: string; courses: string[] };
const usersOf = (classes: ClassUse[], subject: string, grade: string) =>
  classes.filter((c) => gradeScope(grade).levels.includes(c.level) && c.courses.some((n) => subjectMatches(n, subject)));

/**
 * Müfredat: (ders, düzey) başına konu listeleri. Ders açmaz: ders Yönetim → Dersler'de, düzey Sınıflar'da tanımlanır;
 * yeni sette ikisi de oradan seçilir (KROKI.md > Müfredat konusu).
 */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const [sets, all, classrooms, courses] = await Promise.all([curriculumSets(ownerId), allCurriculum(ownerId), classroomsOf(ownerId), listCourses(ownerId)]);
  const current = sets.find((s) => s.subject === sp.ders && s.grade === sp.sinif) ?? (sp.yeni ? null : sets[0]);
  const tab = sp.sekme === "duzenle" ? "duzenle" : "takip";
  const courseNames = [...new Set(courses.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "tr"));
  const grades = curriculumGradeOptions(classrooms.map((c) => c.level), sets.map((s) => s.grade));
  const classes: ClassUse[] = classrooms.map((c) => ({ id: c.id, name: c.name, level: c.level, courses: courses.filter((x) => x.classroomId === c.id).map((x) => x.name) }));

  const exportRows = all.map((r) => [r.subject, gradeLabel(r.grade), r.unit, r.topic, r.code, r.outcome, r.weeks]);
  const header = (
    <PageHeader
      title="Müfredat"
      sub="Ders ve düzeye göre ünite, konu ve kazanımlar. Yıllık plan, soru havuzu ve denemeler bu konu adlarını kullanır."
      actions={
        <>
          <ExportButton fileName="müfredat şablonu" headers={CURRICULUM_COLUMNS.map((c) => c.label)} rows={[["Matematik", "8. sınıf", "1. Ünite: Sayılar ve İşlemler", "Çarpanlar ve Katlar", "M.8.1.1", "Pozitif tam sayıların çarpanlarını bulur.", 3]]} label="Şablon indir" sheet="Müfredat" />
          {all.length > 0 && <ExportButton fileName="müfredat" headers={CURRICULUM_COLUMNS.map((c) => c.label)} rows={exportRows} label="Excel'e aktar" sheet="Müfredat" />}
          <Link href={q({ yeni: "1" })} className="btn-primary">+ Müfredat ekle</Link>
        </>
      }
    />
  );

  if (!sets.length && !sp.yeni) {
    return (
      <div>
        {header}
        <CurriculumImport hasData={false} courseNames={courseNames} grades={grades} existing={sets} />
        <Empty>
          Henüz müfredat yok. Excel dosyası yükleyin, örnek müfredatı yükleyin ya da <Link href={q({ yeni: "1" })} className="font-semibold text-graphite underline">elle girin</Link>.
        </Empty>
      </div>
    );
  }

  // Sol liste: sınıf düzeyine göre gruplu setler
  const byGrade = new Map<string, typeof sets>();
  for (const s of sets) (byGrade.get(s.grade) ?? byGrade.set(s.grade, []).get(s.grade)!).push(s);

  return (
    <div>
      {header}
      <div className="mb-3 flex justify-end">
        <CurriculumImport hasData courseNames={courseNames} grades={grades} existing={sets} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Müfredat setleri" className="flex flex-col gap-3">
          {[...byGrade.entries()].map(([grade, list]) => (
            <div key={grade}>
              <div className="px-2 pb-0.5 text-xs text-lead">{gradeLabel(grade)}</div>
              {list.map((s) => {
                const on = current && s.subject === current.subject && s.grade === current.grade;
                return (
                  <Link
                    key={s.subject}
                    href={q({ ders: s.subject, sinif: s.grade, ...(tab === "duzenle" ? { sekme: "duzenle" } : {}) })}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-[14px] ${on ? "bg-surface font-semibold ring-1 ring-rule" : "text-graphite/85 hover:bg-paper"}`}
                  >
                    <span className="truncate">{s.subject}</span>
                    <span className="num shrink-0 text-xs font-normal text-lead">{s.topics} konu</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {sp.yeni && <div className="rounded-md bg-surface px-2 py-1 text-[14px] font-semibold ring-1 ring-rule">Yeni müfredat</div>}
        </nav>

        <div className="min-w-0">
          {sp.yeni || !current ? (
            <>
              <h2 className="mb-3 font-semibold">Yeni müfredat</h2>
              <CurriculumEditor key="yeni" rows={[]} courseNames={courseNames} grades={grades} />
            </>
          ) : (
            <SetView ownerId={ownerId} subject={current.subject} grade={current.grade} tab={tab} users={usersOf(classes, current.subject, current.grade)} isCourse={courseNames.some((n) => subjectMatches(n, current.subject))} />
          )}
        </div>
      </div>
    </div>
  );
}

async function SetView({ ownerId, subject, grade, tab, users, isCourse }: { ownerId: string; subject: string; grade: string; tab: string; users: ClassUse[]; isCourse: boolean }) {
  const base = { ders: subject, sinif: grade };
  const tabs = [
    { key: "takip", label: "Takip", href: q(base) },
    { key: "duzenle", label: "Konuları düzenle", href: q({ ...base, sekme: "duzenle" }) },
  ];
  const title = (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold">
        {subject} <span className="font-normal text-lead">· {gradeLabel(grade)}</span>
      </h2>
      <Link
        href={`/kurum/takvim/plan/yeni?${new URLSearchParams({ ders: subject, ...(users[0] ? { sinif: users[0].id } : {}) })}`}
        className="text-[13px] text-lead hover:text-graphite"
      >
        Bu müfredattan yıllık plan oluştur ›
      </Link>
      <p className="basis-full text-[13px]">
        {users.length ? (
          <span className="text-lead">
            Kullanan sınıflar:{" "}
            {users.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/kurum/siniflar/${c.id}`} className="font-medium text-graphite hover:underline">{c.name}</Link>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-amber-700">
            {isCourse
              ? `${gradeLabel(grade)} düzeyinde bu dersi alan sınıf yok. Sınıfın düzeyini Sınıflar'da kontrol edin.`
              : "Kurumda bu adla ders yok; müfredat hiçbir sınıfla eşleşmiyor. Ders adını Dersler'deki adla aynı yapın."}
          </span>
        )}
      </p>
    </div>
  );

  if (tab === "duzenle") {
    const rows = await curriculumTopics(ownerId, subject, grade);
    return (
      <>
        {title}
        <Tabs tabs={tabs} active="duzenle" />
        <CurriculumEditor key={`${subject}|${grade}`} subject={subject} grade={grade} rows={rows.map((r) => ({ unit: r.unit, topic: r.topic, code: r.code, outcome: r.outcome, weeks: r.weeks }))} />
      </>
    );
  }

  const t = await curriculumTracking(ownerId, subject, grade);
  const n = t.rows.length;
  const hasExams = gradeScope(grade).examTypes.length > 0;
  const lateTopics = t.rows.filter((r) => r.plan.late).length;
  const assessed = t.rows.filter((r) => r.assess.count).length;
  const noPlan = users.filter((c) => !t.classPlans.some((p) => p.classroomId === c.id));
  const doneTopics = t.rows.filter((r) => r.plan.planned && r.plan.done === r.plan.planned).length;
  const plannedTopics = t.rows.filter((r) => r.plan.planned).length;
  const noBank = t.rows.filter((r) => !r.bank).length;
  const measured = t.rows.filter((r) => r.exam.rate !== null);
  const weak = measured.filter((r) => r.exam.rate! < 50).length;
  const units = [...new Set(t.rows.map((r) => r.unit))];
  const bar = (v: number, cls: string) => (
    <div className="h-1.5 w-full overflow-hidden rounded bg-mist">
      <div className={`h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </div>
  );
  const unmatched = [
    ["Yıllık planlarda", t.unmatched.plan],
    ["Soru havuzunda", t.unmatched.bank],
    ["Denemelerde", t.unmatched.exam],
  ] as const;

  return (
    <>
      {title}
      <Tabs tabs={tabs} active="takip" />
      <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Kpi label="Planda işlenen" value={`${doneTopics}/${n}`} hint={t.classes ? `${t.classes} sınıfın planı · ${plannedTopics} konu planlı` : "Bu düzeyde yıllık plan yok"} />
        <Kpi label="Geciken konu" value={lateTopics} hint="planlanan haftası geçti, işlenmedi (en az bir sınıfta)" />
        <Kpi label="Değerlendirilen konu" value={`${assessed}/${n}`} hint="sözlü / yazılı / uygulama" />
        {hasExams ? (
          <Kpi label="Denemede ölçülen" value={`${measured.length}/${n}`} hint={t.examCount ? `${t.examCount} deneme · ${weak} zayıf konu` : "Bu düzeyde deneme yok"} />
        ) : (
          <Kpi label="Havuzda sorusu yok" value={noBank} hint={`${n} konudan`} />
        )}
      </div>

      {(t.classPlans.length > 0 || noPlan.length > 0) && (
        <div className="card mb-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-rule">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={`${th} w-48`}>İşlenen</th>
                <th className={th}>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {t.classPlans.map((c) => (
                <tr key={c.planId}>
                  <td className={`${td} font-medium`}>{c.classroom}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      {bar(c.linked ? (c.done / c.linked) * 100 : 0, "bg-emerald-500")}
                      <span className="num shrink-0 text-xs text-lead">{c.done}/{c.linked}</span>
                    </div>
                  </td>
                  <td className={td}>
                    {c.late ? <span className="badge bg-red-50 text-red-700">{c.late} konu gecikti</span> : <span className="badge bg-emerald-50 text-emerald-700">Plana uygun</span>}
                    {c.linked < c.total && <span className="ml-2 text-xs text-amber-700">{c.total - c.linked} plan konusu müfredatta yok</span>}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link href={`/kurum/takvim/plan/${c.planId}`} className="text-brand-700 hover:underline">Konu takibi ›</Link>
                  </td>
                </tr>
              ))}
              {noPlan.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={`${td} text-lead/70`} colSpan={2}>Yıllık plan yok; işlenen konular takip edilemez.</td>
                  <td className={`${td} text-right`}>
                    <Link href={`/kurum/takvim/plan/yeni?${new URLSearchParams({ sinif: c.id, ders: c.courses.find((x) => subjectMatches(x, subject)) ?? subject })}`} className="text-brand-700 hover:underline">
                      Plan oluştur ›
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-rule">
            <tr>
              <th className={`${th} w-24`}>Kod</th>
              <th className={th}>Konu</th>
              <th className={`${th} text-right`} title="Konunun kaç ders haftası süreceği; tarihleri yıllık plan verir">Süre (hf)</th>
              <th className={`${th} w-36`}>Yıllık plan</th>
              <th className={`${th} w-28`}>Değerlendirme</th>
              <th className={`${th} text-right`}>Havuz</th>
              {hasExams && <th className={`${th} w-44`}>Deneme başarısı</th>}
            </tr>
          </thead>
          {units.map((u) => (
            <tbody key={u} className="divide-y divide-rule/70 border-b border-rule">
              {u && (
                <tr>
                  <td colSpan={hasExams ? 7 : 6} className="bg-paper px-3 py-1 text-[12.5px] font-semibold text-lead">{u}</td>
                </tr>
              )}
              {t.rows
                .filter((r) => r.unit === u)
                .map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className={`${td} font-mono text-xs text-lead`}>{r.code || "—"}</td>
                    <td className={td}>
                      <div className="font-medium">{r.topic}</div>
                      {r.outcome && <div className="max-w-[60ch] text-xs text-lead">{r.outcome}</div>}
                    </td>
                    <td className={`${td} num text-right`}>{r.weeks}</td>
                    <td className={td}>
                      {r.plan.planned ? (
                        <>
                          <div className="flex items-center gap-2">
                            {bar((r.plan.done / r.plan.planned) * 100, "bg-emerald-500")}
                            <span className="num shrink-0 text-xs text-lead">{r.plan.done}/{r.plan.planned}</span>
                          </div>
                          {r.plan.late > 0 && <div className="text-xs text-red-700">{r.plan.late} sınıfta gecikti</div>}
                        </>
                      ) : (
                        <span className="text-xs text-lead/70">planda yok</span>
                      )}
                    </td>
                    <td className={`${td} text-xs`}>
                      {r.assess.count ? (
                        <span>
                          {r.assess.count} kez{r.assess.avg !== null && <span className={`ml-1 font-semibold ${r.assess.avg < 50 ? "text-red-700" : ""}`}>%{r.assess.avg}</span>}
                        </span>
                      ) : (
                        <span className="text-lead/70">—</span>
                      )}
                    </td>
                    <td className={`${td} num text-right`}>
                      {r.bank ? (
                        <Link href={`/kurum/soru-havuzu?ders=${encodeURIComponent(subject)}&konu=${encodeURIComponent(r.topic)}`} className="underline decoration-rule underline-offset-2 hover:decoration-graphite">
                          {r.bank}
                        </Link>
                      ) : (
                        <span className="text-amber-700">0</span>
                      )}
                    </td>
                    {hasExams && (
                      <td className={td}>
                        {r.exam.rate === null ? (
                          <span className="text-xs text-lead/70">ölçülmedi</span>
                        ) : (
                          <div className="flex items-center gap-2" title={`${r.exam.questions} soru, ${r.exam.total} cevap`}>
                            {bar(r.exam.rate, r.exam.rate < 50 ? "bg-red-400" : r.exam.rate < 70 ? "bg-amber-400" : "bg-emerald-500")}
                            <span className={`num w-9 shrink-0 text-right text-xs font-semibold ${r.exam.rate < 50 ? "text-red-700" : ""}`}>%{r.exam.rate}</span>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      {unmatched.some(([, l]) => l.length) && (
        <div className="card mt-4 px-4 py-3 text-sm">
          <h3 className="font-semibold">Müfredatta karşılığı bulunmayan konu adları</h3>
          <p className="mt-0.5 text-xs text-lead">Yazım farkı olabilir ya da konu müfredata eklenmemiş olabilir. Bu adlar takipte sayılmaz.</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
            {unmatched.map(([label, list]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-lead">{label}</dt>
                <dd className="mt-0.5 text-[13px]">{list.length ? list.slice(0, 12).map((x) => `${x.name}${x.n > 1 ? ` (${x.n})` : ""}`).join(", ") : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
