import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { CURRICULUM_COLUMNS, gradeLabel } from "@/modules/curriculum";
import { allCurriculum, curriculumSets, curriculumTopics } from "@/modules/curriculum/server";
import { curriculumTracking } from "@/modules/reporting/server";
import CurriculumEditor from "@/modules/curriculum/ui/CurriculumEditor";
import CurriculumImport from "@/modules/curriculum/ui/CurriculumImport";
import ExportButton from "@/shared/ui/ExportButton";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type SP = Promise<{ ders?: string; sinif?: string; sekme?: string; yeni?: string }>;

const q = (p: Record<string, string>) => `/kurum/mufredat?${new URLSearchParams(p)}`;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const [sets, all] = await Promise.all([curriculumSets(ownerId), allCurriculum(ownerId)]);
  const current = sets.find((s) => s.subject === sp.ders && s.grade === sp.sinif) ?? (sp.yeni ? null : sets[0]);
  const tab = sp.sekme === "duzenle" ? "duzenle" : "takip";
  const subjects = [...new Set(sets.map((s) => s.subject))];

  const exportRows = all.map((r) => [r.subject, gradeLabel(r.grade), r.unit, r.topic, r.code, r.outcome, r.weeks]);
  const header = (
    <PageHeader
      title="Müfredat"
      sub="Ders ve sınıf düzeyine göre ünite, konu ve kazanımlar. Yıllık plan, soru havuzu ve denemeler bu konu adlarını kullanır."
      actions={
        <>
          <ExportButton fileName="müfredat şablonu" headers={CURRICULUM_COLUMNS.map((c) => c.label)} rows={[["Matematik", "8. sınıf", "1. Ünite: Sayılar ve İşlemler", "Çarpanlar ve Katlar", "M.8.1.1", "Pozitif tam sayıların çarpanlarını bulur.", 3]]} label="Şablon indir" sheet="Müfredat" />
          {all.length > 0 && <ExportButton fileName="müfredat" headers={CURRICULUM_COLUMNS.map((c) => c.label)} rows={exportRows} label="Excel'e aktar" sheet="Müfredat" />}
          <Link href={q({ yeni: "1" })} className="btn-primary">+ Yeni ders</Link>
        </>
      }
    />
  );

  if (!sets.length && !sp.yeni) {
    return (
      <div>
        {header}
        <CurriculumImport hasData={false} />
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
        <CurriculumImport hasData />
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
          {sp.yeni && <div className="rounded-md bg-surface px-2 py-1 text-[14px] font-semibold ring-1 ring-rule">Yeni ders</div>}
        </nav>

        <div className="min-w-0">
          {sp.yeni || !current ? (
            <>
              <h2 className="mb-3 font-semibold">Yeni ders müfredatı</h2>
              <CurriculumEditor key="yeni" rows={[]} subjects={subjects} />
            </>
          ) : (
            <SetView ownerId={ownerId} subject={current.subject} grade={current.grade} tab={tab} subjects={subjects} />
          )}
        </div>
      </div>
    </div>
  );
}

async function SetView({ ownerId, subject, grade, tab, subjects }: { ownerId: string; subject: string; grade: string; tab: string; subjects: string[] }) {
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
      <Link href={`/kurum/takvim/plan/yeni?ders=${encodeURIComponent(subject)}`} className="text-[13px] text-lead hover:text-graphite">
        Bu müfredattan yıllık plan oluştur ›
      </Link>
    </div>
  );

  if (tab === "duzenle") {
    const rows = await curriculumTopics(ownerId, subject, grade);
    return (
      <>
        {title}
        <Tabs tabs={tabs} active="duzenle" />
        <CurriculumEditor key={`${subject}|${grade}`} subject={subject} grade={grade} subjects={subjects} rows={rows.map((r) => ({ unit: r.unit, topic: r.topic, code: r.code, outcome: r.outcome, weeks: r.weeks }))} />
      </>
    );
  }

  const t = await curriculumTracking(ownerId, subject, grade);
  const n = t.rows.length;
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
        <Kpi label="Havuzda sorusu yok" value={noBank} hint={`${n} konudan`} />
        <Kpi label="Denemede ölçülen" value={`${measured.length}/${n}`} hint={t.examCount ? `${t.examCount} deneme` : "Bu düzeyde deneme yok"} />
        <Kpi label="Zayıf konu" value={weak} hint="Denemede başarı %50'nin altında" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-rule">
            <tr>
              <th className={`${th} w-24`}>Kod</th>
              <th className={th}>Konu</th>
              <th className={`${th} text-right`}>Hafta</th>
              <th className={`${th} w-36`}>Yıllık plan</th>
              <th className={`${th} text-right`}>Havuz</th>
              <th className={`${th} w-44`}>Deneme başarısı</th>
            </tr>
          </thead>
          {units.map((u) => (
            <tbody key={u} className="divide-y divide-rule/70 border-b border-rule">
              {u && (
                <tr>
                  <td colSpan={6} className="bg-paper px-3 py-1 text-[12.5px] font-semibold text-lead">{u}</td>
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
                        <div className="flex items-center gap-2">
                          {bar((r.plan.done / r.plan.planned) * 100, "bg-emerald-500")}
                          <span className="num shrink-0 text-xs text-lead">{r.plan.done}/{r.plan.planned}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-lead/70">planda yok</span>
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
