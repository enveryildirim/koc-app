import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { EXAM_TYPES, fmtDate, fmtNet } from "@/modules/exams";
import { classProgress, examTypesOf, successScores, teacherPerformance } from "@/modules/reporting/server";
import { DIM_KEYS, dimDetail, LEVELS, SCORE_DIMS, SCORE_RULES } from "@/modules/reporting";
import { DimBars, ScoreBadge, ScoreDelta } from "@/modules/reporting/ui/score/ScoreParts";
import ScoreSettingsForm from "@/modules/reporting/ui/score/ScoreSettingsForm";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";
import { schoolYearLabel } from "@/modules/planning";
import { planAlerts } from "@/modules/planning/server";
import { ymd } from "@/shared/date";
import ExportButton from "@/shared/ui/ExportButton";
import PrintButton from "@/shared/ui/PrintButton";
import LineChart, { SERIES_COLORS } from "@/modules/reporting/ui/LineChart";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; tur?: string; ders?: string; sinif?: string; seviye?: string }>;

const TABS = [
  { key: "gelisim", label: "Sınıf gelişimi" },
  { key: "skor", label: "Başarı Skoru" },
  { key: "ogretmen", label: "Öğretmen & ders performansı" },
  { key: "plan", label: "Yıllık plan" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  // Eski "risk" bağlantıları Başarı Skoru sekmesine gider.
  const asked = sp.tab === "risk" ? "skor" : sp.tab;
  const tab = TABS.some((t) => t.key === asked) ? asked! : "gelisim";

  return (
    <div>
      <PageHeader
        title="Analiz ve uyarılar"
        sub="Denemeler arası gelişim, öğrencilerin Başarı Skoru ve öğretmen/ders performansı"
        actions={<PrintButton />}
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, href: `/kurum/analiz?tab=${t.key}` }))} active={tab} />
      {tab === "gelisim" && <Progress ownerId={ownerId} tur={sp.tur} ders={sp.ders ?? ""} />}
      {tab === "skor" && <Score ownerId={ownerId} sinif={sp.sinif ?? ""} seviye={sp.seviye ?? ""} />}
      {tab === "ogretmen" && <Teachers ownerId={ownerId} />}
      {tab === "plan" && <PlanTab ownerId={ownerId} />}
    </div>
  );
}

/* ================================ Sınıf gelişimi ================================ */

async function Progress({ ownerId, tur, ders }: { ownerId: string; tur?: string; ders: string }) {
  const types = await examTypesOf(ownerId);
  if (!types.length) return <Empty>Henüz sonucu olan deneme yok.</Empty>;
  const type = tur && types.includes(tur) ? tur : types[0];
  const p = await classProgress(ownerId, type, ders);
  const href = (q: Record<string, string>) => {
    const s = new URLSearchParams({ tab: "gelisim", tur: type, ...(p.section ? { ders: p.section } : {}), ...q });
    for (const [k, v] of [...s.entries()]) if (!v) s.delete(k);
    return `/kurum/analiz?${s}`;
  };
  const labels = p.exams.map((e) => e.name);
  const max = p.exams.reduce((a, e) => Math.max(a, e.max), 0);
  const metricLabel = p.section ? `${p.section} neti` : "Toplam net";
  const lastIdx = p.exams.length - 1;

  const exportRows = [
    ...p.rows.map((r) => [r.name, ...r.cells.map((c) => c?.net ?? null), ...(p.section ? [] : [r.cells[lastIdx]?.score ?? null])]),
    ["Kurum ortalaması", ...p.total.map((c) => c.net), ...(p.section ? [] : [p.total[lastIdx]?.score ?? null])],
  ];

  return (
    <div className="space-y-4">
      <div className="no-print card flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium text-lead">Sınav türü</span>
        <div className="flex flex-wrap gap-1">
          {types.map((t) => (
            <Link key={t} href={href({ tur: t, ders: "" })} className={t === type ? "btn-primary" : "btn-secondary"}>
              {EXAM_TYPES[t]?.label ?? t}
            </Link>
          ))}
        </div>
        <span className="ml-2 text-sm font-medium text-lead">Ders</span>
        <div className="flex flex-wrap gap-1">
          <Link href={href({ ders: "" })} className={!p.section ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}>Toplam</Link>
          {p.sectionNames.map((n) => (
            <Link key={n} href={href({ ders: n })} className={p.section === n ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}>
              {n}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <ExportButton
            fileName={`sinif_gelisimi_${type}${p.section ? "_" + p.section : ""}`}
            headers={["Sınıf", ...p.exams.map((e) => `${e.name} (${fmtDate(e.date)})`), ...(p.section ? [] : ["Son deneme ort. tahmini puan"])]}
            rows={exportRows}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr>
              <th className={`${th} pin`}>Sınıf</th>
              {p.exams.map((e) => (
                <th key={e.id} className={`${th} text-right`}>
                  <Link href={`/kurum/denemeler/${e.id}?tab=siniflar`} className="hover:text-brand-600">{e.name}</Link>
                  <div className="font-normal normal-case text-lead/70">{fmtDate(e.date)}</div>
                </th>
              ))}
              <th className={`${th} text-right`}>İlk → son</th>
              {!p.section && <th className={`${th} text-right`}>Son ort. puan</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {p.rows.map((r, ri) => {
              const vals = r.cells.map((c) => c?.net ?? null);
              const present = vals.filter((v): v is number => v !== null);
              const change = present.length > 1 ? present[present.length - 1] - present[0] : null;
              return (
                <tr key={r.id}>
                  <td className={`${td} pin font-semibold`}>
                    <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[ri % SERIES_COLORS.length] }} />
                    {r.name}
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className={`${td} text-right tabular-nums`}>
                      {c?.net === null || c === null ? <span className="text-slate-300">—</span> : (
                        <>
                          <b>{fmtNet(c.net)}</b>
                          <Delta now={c.net} prev={prevValue(vals, i)} />
                          <div className="text-[10px] text-lead/70">{c.n} öğr.</div>
                        </>
                      )}
                    </td>
                  ))}
                  <td className={`${td} text-right tabular-nums`}>{change === null ? "—" : <Signed v={change} />}</td>
                  {!p.section && <td className={`${td} text-right tabular-nums`}>{r.cells[lastIdx]?.score != null ? fmtNet(r.cells[lastIdx]!.score!) : "—"}</td>}
                </tr>
              );
            })}
            <tr className="border-t-2 border-graphite bg-paper font-semibold">
              <td className={`${td} pin`}>Kurum ortalaması</td>
              {p.total.map((c, i) => (
                <td key={i} className={`${td} text-right tabular-nums`}>
                  {c.net === null ? "—" : fmtNet(c.net)}
                  {c.net !== null && <Delta now={c.net} prev={prevValue(p.total.map((x) => x.net), i)} />}
                </td>
              ))}
              <td className={`${td} text-right tabular-nums`}>
                {(() => {
                  const v = p.total.map((x) => x.net).filter((x): x is number => x !== null);
                  return v.length > 1 ? <Signed v={v[v.length - 1] - v[0]} /> : "—";
                })()}
              </td>
              {!p.section && <td className={`${td} text-right tabular-nums`}>{p.total[lastIdx]?.score != null ? fmtNet(p.total[lastIdx].score!) : "—"}</td>}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h3 className="mb-2 font-semibold">{metricLabel} · sınıf ortalamaları</h3>
        <LineChart
          labels={labels}
          max={max}
          series={[
            ...p.rows.map((r) => ({ name: r.name, values: r.cells.map((c) => c?.net ?? null) })),
            { name: "Kurum ortalaması", values: p.total.map((c) => c.net), color: "#475569", dashed: true },
          ]}
        />
      </div>
      <p className="text-xs text-lead">
        Hücreler sınıfın o denemedeki ortalama netidir; ▲/▼ bir önceki denemeye göre değişim. Tahmini puan, deneme ayarlarındaki taban puan ve ders katsayılarıyla hesaplanır.
      </p>
    </div>
  );
}

function prevValue(vals: (number | null)[], i: number) {
  for (let k = i - 1; k >= 0; k--) if (vals[k] !== null) return vals[k];
  return null;
}

function Delta({ now, prev }: { now: number; prev: number | null }) {
  if (prev === null) return null;
  const d = now - prev;
  if (Math.abs(d) < 0.005) return <span className="ml-1 text-xs text-lead/70">=</span>;
  return <span className={`ml-1 text-xs ${d > 0 ? "text-emerald-600" : "text-red-600"}`}>{d > 0 ? "▲" : "▼"}{fmtNet(Math.abs(d))}</span>;
}

function Signed({ v }: { v: number }) {
  return <span className={v > 0 ? "font-semibold text-emerald-700" : v < 0 ? "font-semibold text-red-600" : "text-lead"}>{v > 0 ? "+" : ""}{fmtNet(v)}</span>;
}

/* ================================= Başarı Skoru ================================= */

const LEVEL_FILTERS = [
  { key: "", label: "Tümü" },
  { key: "RISK", label: LEVELS.RISK.label },
  { key: "WATCH", label: LEVELS.WATCH.label },
  { key: "GOOD", label: LEVELS.GOOD.label },
];

async function Score({ ownerId, sinif, seviye }: { ownerId: string; sinif: string; seviye: string }) {
  const classes = await classroomsOf(ownerId);
  const cls = classes.find((c) => c.id === sinif)?.id ?? "";
  const r = await successScores(ownerId, { classroomId: cls || undefined });
  const lv = LEVEL_FILTERS.some((f) => f.key === seviye) ? seviye : "";
  const rows = lv ? r.rows.filter((x) => x.level === lv) : r.rows;
  const className = classes.find((c) => c.id === cls)?.name;
  const href = (q: Record<string, string>) => {
    const s = new URLSearchParams({ tab: "skor", sinif: cls, seviye: lv, ...q });
    for (const [k, v] of [...s.entries()]) if (!v) s.delete(k);
    return `/kurum/analiz?${s}`;
  };
  const chip = (on: boolean) => (on ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Ortalama skor" value={r.average ?? "—"} hint={`${r.rows.length} öğrenci`} />
        <Kpi label={LEVELS.GOOD.label} value={r.levelCounts.GOOD} hint={`${r.settings.good} ve üstü`} />
        <Kpi label={LEVELS.WATCH.label} value={r.levelCounts.WATCH} hint={`${r.settings.watch}–${r.settings.good - 1}`} />
        <Kpi label={LEVELS.RISK.label} value={r.levelCounts.RISK} hint={`${r.settings.watch} altı`} />
        <Kpi label="Risk seviyesine düşen" value={r.newlyRisk.length} hint={`son ${SCORE_RULES.trendDays} günde`} />
      </div>

      <div className="no-print card flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm font-medium text-lead">Sınıf</span>
        <Link href={href({ sinif: "" })} className={chip(!cls)}>Tümü</Link>
        {classes.map((c) => (
          <Link key={c.id} href={href({ sinif: c.id })} className={chip(cls === c.id)}>{c.name}</Link>
        ))}
        <span className="ml-2 text-sm font-medium text-lead">Seviye</span>
        {LEVEL_FILTERS.map((f) => (
          <Link key={f.key} href={href({ seviye: f.key })} className={chip(lv === f.key)}>{f.label}</Link>
        ))}
        <div className="ml-auto">
          <ExportButton
            fileName={`basari_skoru${className ? "_" + className : ""}`}
            headers={["Skor", "Seviye", "4 hafta önce", "Değişim", "Öğrenci No", "Öğrenci", "Sınıf", ...DIM_KEYS.map((k) => SCORE_DIMS[k].label), "Açıklama", "Veli", "Veli telefonu"]}
            rows={rows.map((x) => [
              x.score,
              x.level ? LEVELS[x.level].label : "",
              x.prevScore,
              x.delta,
              x.studentNo,
              x.name,
              x.className,
              ...DIM_KEYS.map((k) => x.dims[k]),
              x.reasons.join("; "),
              x.parentName,
              x.parentPhone,
            ])}
          />
        </div>
      </div>

      <h2 className="hidden text-lg font-bold print:block">Başarı Skoru{className ? ` · ${className}` : ""}</h2>

      {rows.length === 0 ? (
        <Empty>Bu filtreye uyan öğrenci yok.</Empty>
      ) : (
        <div className="card overflow-x-auto print:shadow-none print:ring-0">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Skor</th>
                <th className={`${th} text-right`} title={`${SCORE_RULES.trendDays} gün öncesine göre`}>Değişim</th>
                <th className={`${th} pin`}>Öğrenci</th>
                <th className={th}>Sınıf</th>
                <th className={th}>Boyutlar</th>
                <th className={th}>Neden</th>
                <th className={th}>Veli</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {rows.map((x) => (
                <tr key={x.id} className={x.level === "RISK" ? "bg-red-50/30" : ""}>
                  <td className={td}><ScoreBadge score={x.score} level={x.level} /></td>
                  <td className={`${td} text-right`}><ScoreDelta delta={x.delta} /></td>
                  <td className={`${td} pin`}>
                    <Link href={`/kurum/ogrenciler/${x.id}`} className="font-medium hover:text-ink">{x.name}</Link>
                    <div className="num text-xs text-lead/70">{x.studentNo}</div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{x.className}</td>
                  <td className={td}>
                    <DimBars dims={x.dims} details={Object.fromEntries(DIM_KEYS.map((k) => [k, dimDetail(k, x.signals)]))} />
                  </td>
                  <td className={`${td} min-w-[16rem] text-[13px]`}>
                    {x.reasons.length ? x.reasons.map((t) => <div key={t}>{t}</div>) : <span className="text-lead/70">—</span>}
                  </td>
                  <td className={td}>
                    {x.parentName || "—"}
                    {x.parentPhone && (
                      <div className="text-xs">
                        <a className="num underline decoration-rule underline-offset-4 hover:decoration-graphite" href={`tel:${x.parentPhone.replace(/\s/g, "")}`}>{x.parentPhone}</a>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="no-print card p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">Skor nasıl hesaplanıyor, ayarlar</summary>
        <div className="mt-3 space-y-5">
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-lead">
            <li><b>Akademik düzey:</b> son denemedeki tahmini puanın kurum içi yüzdeliği (en iyi 100, en düşük 0).</li>
            <li><b>Gelişim:</b> aynı türdeki son {SCORE_RULES.growthExams} denemede netin eğimi. Deneme başına −{SCORE_RULES.growthRange} net ve altı 0, +{SCORE_RULES.growthRange} net ve üstü 100, sabit gidiş 50.</li>
            <li><b>Deneme katılımı:</b> son {SCORE_RULES.participationDays} günde sınıfının girdiği denemelerden kaçına girdiği.</li>
            <li><b>Devam:</b> son {SCORE_RULES.days} günde (Geldi + Geç) / bütün yoklamalar. %{SCORE_RULES.attendanceFloor} ve altı 0, %100 devam 100.</li>
            <li><b>Ödev:</b> son {SCORE_RULES.days} günde teslimi geçen ödevlerde yapma oranı; eksik yapılan yarım sayılır.</li>
            <li>Toplam skor, boyutların ağırlıklı ortalamasıdır. Bir boyutta veri yoksa o boyut hesaba katılmaz, kalan ağırlıklar oranlanır. Değişim sütunu aynı hesabın {SCORE_RULES.trendDays} gün önceki verilerle yapılmış hâline göredir.</li>
            <li>Skor kurum içi bir izleme aracıdır; veli karnesinde gösterilmez.</li>
          </ul>
          <ScoreSettingsForm initial={r.settings} dims={r.rows.map((x) => x.dims)} />
        </div>
      </details>
    </div>
  );
}

/* ============================ Öğretmen & ders performansı ============================ */

async function Teachers({ ownerId }: { ownerId: string }) {
  const { teachers, rows, unmatched } = await teacherPerformance(ownerId);
  if (!teachers.length && !unmatched.length) return <Empty>Ders programında öğretmen veya eşleşen deneme yok.</Empty>;

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end">
        <ExportButton
          fileName="ogretmen_ders_performansi"
          headers={["Öğretmen", "Branş", "Sınıf", "Ders", "Deneme bölümü", "Tür", "Deneme sayısı", "İlk deneme", "İlk ort. net", "Son deneme", "Son ort. net", "Değişim", "Kurum ort. (son)", "Kurum farkı", "Başarı %"]}
          rows={rows.map((r) => [
            r.teacher,
            r.branch,
            r.className,
            r.subject,
            r.section,
            EXAM_TYPES[r.type]?.label ?? r.type,
            r.exams,
            r.firstExam,
            r.first,
            r.lastExam,
            r.last,
            r.change,
            r.instAvg,
            r.diff,
            r.success,
          ])}
        />
      </div>

      {teachers.map((t) => (
        <div key={t.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/70 bg-paper px-4 py-3">
            <div>
              <b>{t.name}</b> <span className="text-sm text-lead">· {t.branch}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-lead">
              <span>Ort. gelişim: {t.avgChange === null ? "—" : <Signed v={t.avgChange} />}</span>
              <span>Kurum ort. farkı: {t.avgDiff === null ? "—" : <Signed v={t.avgDiff} />}</span>
              <span>Ort. başarı: <b>{t.avgSuccess === null ? "—" : `%${t.avgSuccess}`}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${th} pin`}>Sınıf</th>
                  <th className={th}>Ders → bölüm</th>
                  <th className={th}>Tür</th>
                  <th className={`${th} text-right`}>İlk deneme</th>
                  <th className={`${th} text-right`}>Son deneme</th>
                  <th className={`${th} text-right`}>Değişim</th>
                  <th className={`${th} text-right`}>Kurum farkı</th>
                  <th className={th}>Başarı (net/soru)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {t.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${td} pin font-medium`}>{r.className}</td>
                    <td className={td}>
                      {r.subject}
                      {r.section !== r.subject && <span className="text-xs text-lead/70"> → {r.section}</span>}
                    </td>
                    <td className={td}>{EXAM_TYPES[r.type]?.label ?? r.type}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.first === null ? "—" : fmtNet(r.first)}
                      <div className="text-[10px] text-lead/70">{r.firstExam}</div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      <b>{r.last === null ? "—" : fmtNet(r.last)}</b>
                      <div className="text-[10px] text-lead/70">{r.lastExam} · {r.count} soru</div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{r.change === null ? <span className="text-xs text-lead/70">tek deneme</span> : <Signed v={r.change} />}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.diff === null ? "—" : <Signed v={r.diff} />}</td>
                    <td className={`${td} w-44`}>
                      {r.success === null ? "—" : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-mist">
                            <div className={r.success < 40 ? "h-full bg-red-400" : r.success < 60 ? "h-full bg-amber-400" : "h-full bg-emerald-500"} style={{ width: `${Math.max(0, r.success)}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs font-semibold">%{r.success}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {unmatched.length > 0 && (
        <div className="card p-4 text-sm">
          <h3 className="font-semibold">Eşleşmeyen dersler</h3>
          <p className="mt-1 text-xs text-lead">
            Bu derslere karşılık gelen bir deneme bölümü bulunamadı (ders adı ile bölüm adı eşleşmiyor veya sınıf bu derse ait bölüm içeren denemeye girmedi).
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unmatched.map((u, i) => (
              <li key={i} className="badge bg-mist text-graphite/90">
                {u.teacher} · {u.className} · {u.subject}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-lead">
        Eşleşme: ders programındaki ders adı ile deneme bölüm adı küçük harfe çevrilip karşılaştırılır; “Temel Matematik” → Matematik, “T.C. İnkılap Tarihi” → İnkılap Tarihi gibi takma adlar tanınır.
        Değişim, sınıfın o türdeki ilk ve son denemesindeki bölüm ortalama neti arasındaki farktır.
      </p>
    </div>
  );
}

/* ================================ 4. Yıllık plan ================================ */

const fmtShort = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

async function PlanTab({ ownerId }: { ownerId: string }) {
  const a = await planAlerts(ownerId, ymd());
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Planlı ders" value={`${a.plannedCount} / ${a.pairCount}`} hint={`${schoolYearLabel(a.year)} · ders programındaki sınıf-ders çiftleri`} />
        <Kpi label="Plana göre geride" value={a.behind.length} hint="bitiş haftası geçmiş, işlenmemiş konusu olan" />
        <Kpi label="Gecikme yüzünden işlenmeden sorulan" value={a.late.length} hint="son 45 gündeki denemelerde (konu × sınıf)" />
      </div>
      {a.plannedCount === 0 ? (
        <Empty>
          Henüz yıllık ders planı yok. <Link href="/kurum/takvim/plan" className="font-semibold text-brand-600">Yıllık ders planı</Link> sayfasından oluşturabilirsiniz.
        </Empty>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-lg font-semibold">Plana göre geride kalan dersler</h2>
            {a.behind.length === 0 ? (
              <Empty>Tüm planlar yolunda.</Empty>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-paper">
                    <tr>
                      <th className={`${th} pin`}>Sınıf</th>
                      <th className={th}>Ders</th>
                      <th className={th}>Öğretmen</th>
                      <th className={`${th} text-right`}>Geride</th>
                      <th className={`${th} text-right`}>Geciken konu</th>
                      <th className={`${th} text-right`}>İşlenen</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/70">
                    {a.behind.map((r) => (
                      <tr key={r.plan!.id}>
                        <td className={`${td} pin font-medium`}>{r.classroom}</td>
                        <td className={td}>{r.subject}</td>
                        <td className={`${td} text-lead`}>{r.teachers.join(", ") || "—"}</td>
                        <td className={`${td} text-right font-semibold text-red-600`}>{r.plan!.progress.behindWeeks} hafta</td>
                        <td className={`${td} text-right`}>{r.plan!.progress.late}</td>
                        <td className={`${td} text-right text-lead`}>{r.plan!.progress.done} / {r.plan!.progress.total}</td>
                        <td className={`${td} text-right`}>
                          <Link href={`/kurum/takvim/plan/${r.plan!.id}`} className="text-brand-700 hover:underline">Plan</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-lg font-semibold">Gecikme yüzünden denemede işlenmeden sorulan konular</h2>
            <p className="mb-2 text-sm text-lead">
              Plana göre deneme tarihinden önce işlenmiş olması gereken ama işlenmemiş konular. Planda daha sonraya bırakılan konular burada listelenmez; onları
              denemenin &quot;Plan uyumu&quot; sekmesinde görebilirsiniz.
            </p>
            {a.late.length === 0 ? (
              <Empty>Son 45 günde böyle bir konu yok.</Empty>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-paper">
                    <tr>
                      <th className={th}>Deneme</th>
                      <th className={th}>Sınıf</th>
                      <th className={th}>Ders</th>
                      <th className={th}>Konu</th>
                      <th className={th}>Planlanan hafta</th>
                      <th className={`${th} text-right`}>Doğru oranı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/70">
                    {a.late.map((e) => (
                      <tr key={`${e.examId}|${e.classroomId}|${e.section}|${e.topic}`}>
                        <td className={td}>
                          <Link href={`/kurum/denemeler/${e.examId}?tab=plan&sinif=${e.classroomId}`} className="hover:text-brand-700">{e.exam}</Link>
                          <div className="text-xs text-lead">{fmtShort(e.date)}</div>
                        </td>
                        <td className={`${td} font-medium`}>{e.classroom}</td>
                        <td className={td}>{e.section}</td>
                        <td className={td}>{e.topic}</td>
                        <td className={`${td} text-lead`}>{e.plannedWeek ? `${fmtShort(e.plannedWeek)} haftası` : "—"}</td>
                        <td className={`${td} text-right ${e.rate < 50 ? "font-semibold text-red-600" : ""}`}>%{e.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
