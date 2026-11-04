import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { classroomsOf, requireOwner } from "@/lib/kurum";
import { choicesFor, EXAM_TYPES, fmtDate, fmtNet, LETTERS, normNo, totalQuestions } from "@/lib/exam";
import { examReport, loadExam } from "@/lib/examServer";
import { examFormSpec, examKeys } from "@/lib/examOmr";
import { Empty, Kpi, PageHeader, Tabs, th, td } from "@/components/kurum/ui";
import KeyEditor from "@/components/kurum/sinav/KeyEditor";
import TxtImport from "@/components/kurum/sinav/TxtImport";
import DeleteResult from "@/components/kurum/sinav/DeleteResult";
import OmrScanner from "@/components/OmrScanner";
import FormSvg from "@/components/FormSvg";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string; kitapcik?: string }>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await loadExam(ownerId, id);
  if (!exam) notFound();
  const keyed = exam.secs.every((s) => s.keyA.length === s.count && (!exam.bookletB || s.keyB.length === s.count));
  const tab = sp.tab ?? (keyed ? "sonuclar" : "anahtar");
  const base = `/kurum/denemeler/${id}`;
  const tabs = [
    { key: "sonuclar", label: "Sıralı liste", href: `${base}?tab=sonuclar` },
    { key: "anahtar", label: "Cevap anahtarı", href: `${base}?tab=anahtar` },
    { key: "optik", label: "Optik form tara", href: `${base}?tab=optik` },
    { key: "txt", label: "Okuyucu dosyası (TXT)", href: `${base}?tab=txt` },
    { key: "analiz", label: "Soru frekans analizi", href: `${base}?tab=analiz` },
    { key: "siniflar", label: "Sınıf ortalamaları", href: `${base}?tab=siniflar` },
  ];
  const header = (
    <>
      <PageHeader
        title={exam.name}
        sub={`${EXAM_TYPES[exam.type]?.label ?? exam.type} · ${fmtDate(exam.date)} · ${totalQuestions(exam.secs)} soru · ${exam.wrongPer ? `${exam.wrongPer} yanlış 1 doğruyu götürür` : "yanlış doğruyu götürmez"}`}
        back={{ href: "/kurum/denemeler", label: "Denemeler" }}
        actions={<PrintButton />}
      />
      <Tabs tabs={tabs} active={tab} />
      {!keyed && tab !== "anahtar" && (
        <p className="no-print mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Cevap anahtarı eksik. Sonuçlar anahtar girildiğinde otomatik yeniden hesaplanır. <Link className="font-semibold underline" href={`${base}?tab=anahtar`}>Anahtarı gir →</Link>
        </p>
      )}
    </>
  );

  /* ------------------------------ Cevap anahtarı ------------------------------ */
  if (tab === "anahtar") {
    return (
      <>
        {header}
        <KeyEditor
          examId={id}
          initial={{ name: exam.name, date: exam.date.toISOString().slice(0, 10), bookletB: exam.bookletB, wrongPer: exam.wrongPer, sections: exam.secs }}
          choices={choicesFor(exam.type)}
          hasResults={(await prisma.examResult.count({ where: { examId: id } })) > 0}
        />
      </>
    );
  }

  /* ------------------------------- Optik okuma -------------------------------- */
  if (tab === "optik" || tab === "txt") {
    const students = await prisma.student.findMany({ where: { ownerId }, include: { classroom: true } });
    const map = Object.fromEntries(
      students.map((s) => [normNo(s.studentNo), `${s.firstName} ${s.lastName} (${s.classroom?.name ?? (s.external ? "Kurum dışı" : "—")})`]),
    );
    const spec = examFormSpec(exam.name, exam.type, exam.secs, exam.bookletB);
    if (tab === "txt") {
      return (
        <>
          {header}
          <TxtImport
            examId={id}
            total={totalQuestions(exam.secs)}
            bookletB={exam.bookletB}
            choices={choicesFor(exam.type)}
            sampleNos={students.filter((s) => !s.external).map((s) => s.studentNo)}
            keyA={exam.secs.map((s) => s.keyA.padEnd(s.count, " ")).join("")}
            keyB={exam.secs.map((s) => (s.keyB || s.keyA).padEnd(s.count, " ")).join("")}
            students={map}
          />
        </>
      );
    }
    return (
      <>
        {header}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="card p-4">
              <h2 className="font-semibold">Optik form</h2>
              <p className="mt-1 text-sm text-slate-500">
                Bu sınava özel form: bölüm başlıkları{exam.bookletB ? ", kitapçık türü" : ""} ve 6 haneli öğrenci numarası alanı.
              </p>
              <FormSvg info={spec} className="mt-3 w-full rounded ring-1 ring-slate-200" />
              <Link href={`${base}/form`} target="_blank" className="btn-primary mt-3 w-full">🖨️ Formu yazdır</Link>
            </div>
            <div className="card p-4 text-sm text-slate-600">
              Okunan öğrenci numarası kayıtlı öğrencilerle eşleştirilir (baştaki sıfırlar önemsizdir). Aynı öğrenci tekrar okutulursa sonucu güncellenir.
            </div>
          </aside>
          <OmrScanner
            spec={spec}
            keys={examKeys(exam.secs)}
            saveUrl={`/api/kurum/denemeler/${id}/sonuclar`}
            resultsHref={`${base}?tab=sonuclar`}
            mode="exam"
            students={map}
            wrongPer={exam.wrongPer}
          />
        </div>
      </>
    );
  }

  const report = await examReport(id);
  const classes = (await classroomsOf(ownerId)).filter((c) => report.classAvg.has(c.id));
  const sinif = sp.sinif ?? "";
  const rows = sinif ? report.rows.filter((r) => r.classId === sinif) : report.rows;

  if (report.rows.length === 0) {
    return (
      <>
        {header}
        <Empty>
          Henüz sonuç yok. <Link className="font-semibold text-brand-600" href={`${base}?tab=optik`}>Optik form tarayın</Link> veya{" "}
          <Link className="font-semibold text-brand-600" href={`${base}?tab=txt`}>okuyucu dosyası yükleyin</Link>.
        </Empty>
      </>
    );
  }

  /* --------------------------- Soru frekans analizi --------------------------- */
  if (tab === "analiz") {
    const bk = sp.kitapcik === "B" ? "B" : "A";
    const list = rows.filter((r) => r.booklet === bk);
    const c = choicesFor(exam.type);
    let offset = 0;
    return (
      <>
        {header}
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <ClassFilter base={base} tab="analiz" classes={classes} sinif={sinif} extra={`&kitapcik=${bk}`} />
          {exam.bookletB && (
            <div className="flex gap-1">
              {["A", "B"].map((k) => (
                <Link key={k} href={`${base}?tab=analiz&kitapcik=${k}${sinif ? `&sinif=${sinif}` : ""}`} className={k === bk ? "btn-primary" : "btn-secondary"}>
                  {k} kitapçığı
                </Link>
              ))}
            </div>
          )}
          <span className="text-sm text-slate-500">{list.length} öğrenci</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Her soru için şıkların seçilme oranı. Doğru şık yeşil; başarı oranı %40’ın altındaki sorular kırmızı işaretlidir.
        </p>
        {exam.secs.map((s) => {
          const start = offset;
          offset += s.count;
          const key = bk === "B" ? s.keyB || s.keyA : s.keyA;
          return (
            <div key={s.name} className="card mb-4 overflow-x-auto">
              <h3 className="border-b border-slate-100 px-4 py-2 font-semibold">{s.name}</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Soru</th>
                    <th className={th}>Cevap</th>
                    {LETTERS.slice(0, c).split("").map((l) => (
                      <th key={l} className={`${th} text-right`}>{l}</th>
                    ))}
                    <th className={`${th} text-right`}>Boş</th>
                    <th className={th}>Başarı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: s.count }, (_, i) => {
                    const ans = list.map((r) => r.answers[start + i] ?? " ");
                    const n = Math.max(1, ans.length);
                    const pctOf = (ch: string) => Math.round((ans.filter((a) => a === ch).length / n) * 100);
                    const ok = key[i] ? pctOf(key[i]) : 0;
                    return (
                      <tr key={i}>
                        <td className={`${td} font-semibold`}>{i + 1}</td>
                        <td className={`${td} font-bold text-emerald-700`}>{key[i] ?? "?"}</td>
                        {LETTERS.slice(0, c).split("").map((l) => (
                          <td key={l} className={`${td} text-right tabular-nums ${l === key[i] ? "font-bold text-emerald-700" : "text-slate-600"}`}>%{pctOf(l)}</td>
                        ))}
                        <td className={`${td} text-right tabular-nums text-slate-400`}>%{pctOf(" ")}</td>
                        <td className={`${td} w-40`}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                              <div className={ok < 40 ? "h-full bg-red-400" : "h-full bg-emerald-500"} style={{ width: `${ok}%` }} />
                            </div>
                            <span className={`w-9 text-right text-xs font-semibold ${ok < 40 ? "text-red-600" : ""}`}>%{ok}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </>
    );
  }

  /* ----------------------------- Sınıf ortalamaları ---------------------------- */
  if (tab === "siniflar") {
    const list = [...report.classAvg.values()].sort((a, b) => b.total - a.total);
    const maxTotal = totalQuestions(exam.secs);
    return (
      <>
        {header}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={`${th} text-right`}>Öğrenci</th>
                {exam.secs.map((s) => (
                  <th key={s.name} className={`${th} text-right`}>{s.name}</th>
                ))}
                <th className={`${th} text-right`}>Toplam net</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.name}>
                  <td className={`${td} font-semibold`}>{c.name}</td>
                  <td className={`${td} text-right`}>{c.size}</td>
                  {c.sections.map((v, i) => (
                    <td key={i} className={`${td} text-right tabular-nums ${v < report.general.sections[i] ? "text-red-600" : "text-emerald-700"}`}>{fmtNet(v)}</td>
                  ))}
                  <td className={`${td} text-right font-bold tabular-nums`}>{fmtNet(c.total)}</td>
                  <td className={`${td} w-40`}>
                    <div className="h-2 overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-brand-500" style={{ width: `${(c.total / maxTotal) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-brand-50 font-semibold text-brand-700">
                <td className={td}>Kurum geneli</td>
                <td className={`${td} text-right`}>{report.general.n}</td>
                {report.general.sections.map((v, i) => (
                  <td key={i} className={`${td} text-right tabular-nums`}>{fmtNet(v)}</td>
                ))}
                <td className={`${td} text-right tabular-nums`}>{fmtNet(report.general.total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Yeşil: kurum ortalamasının üstü · Kırmızı: altı</p>
      </>
    );
  }

  /* -------------------------------- Sıralı liste ------------------------------- */
  const sel = sinif ? report.classAvg.get(sinif) : null;
  return (
    <>
      {header}
      <div className="no-print mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Katılım" value={rows.length} />
        <Kpi label="Ortalama net" value={fmtNet(sel ? sel.total : report.general.total)} />
        <Kpi label="En yüksek" value={fmtNet(Math.max(...rows.map((r) => r.totalNet)))} />
        <Kpi label="En düşük" value={fmtNet(Math.min(...rows.map((r) => r.totalNet)))} />
      </div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <ClassFilter base={base} tab="sonuclar" classes={classes} sinif={sinif} />
        <Link href={`${base}/karneler${sinif ? `?sinif=${sinif}` : ""}`} className="btn-secondary">📄 Tüm karneleri yazdır</Link>
      </div>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{exam.name} – Sıralı Liste</h1>
        <p className="mb-2 text-sm">{fmtDate(exam.date)}{sel ? ` · ${sel.name}` : ""}</p>
      </div>
      <div className="card overflow-x-auto print:shadow-none print:ring-0">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Genel</th>
              <th className={th}>Sınıf</th>
              <th className={th}>No</th>
              <th className={th}>Ad Soyad</th>
              <th className={th}>Şube</th>
              <th className={th}>Kt.</th>
              {exam.secs.map((s) => (
                <th key={s.name} className={`${th} text-center`} colSpan={3}>{s.name}</th>
              ))}
              <th className={`${th} text-right`}>Net</th>
              <th className="no-print" />
            </tr>
            <tr className="text-[10px] text-slate-400">
              <th colSpan={6} />
              {exam.secs.map((s) => (
                <Sub key={s.name} />
              ))}
              <th colSpan={2} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className={`${td} font-bold`}>{r.rank}</td>
                <td className={td}>{r.classRank}</td>
                <td className={`${td} font-mono`}>{r.studentNo}</td>
                <td className={td}>
                  <Link href={`${base}/karne/${r.id}`} className="font-medium hover:text-brand-600">{r.name}</Link>
                </td>
                <td className={td}>{r.className}</td>
                <td className={td}>{r.booklet}</td>
                {r.stats.map((s, i) => (
                  <Cells key={i} s={s} />
                ))}
                <td className={`${td} text-right text-sm font-bold tabular-nums`}>{fmtNet(r.totalNet)}</td>
                <td className={`${td} no-print text-right`}>
                  <DeleteResult url={`/api/kurum/denemeler/${id}/sonuclar/${r.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Sub() {
  return (
    <>
      <th className="px-1 text-center font-medium">D</th>
      <th className="px-1 text-center font-medium">Y</th>
      <th className="px-1 text-center font-medium">Net</th>
    </>
  );
}

function Cells({ s }: { s: { d: number; y: number; net: number } }) {
  return (
    <>
      <td className="px-1 text-center tabular-nums text-emerald-700">{s.d}</td>
      <td className="px-1 text-center tabular-nums text-red-600">{s.y}</td>
      <td className="px-1 text-center font-semibold tabular-nums">{fmtNet(s.net)}</td>
    </>
  );
}

function ClassFilter({ base, tab, classes, sinif, extra = "" }: { base: string; tab: string; classes: { id: string; name: string }[]; sinif: string; extra?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Link href={`${base}?tab=${tab}${extra}`} className={!sinif ? "btn-primary" : "btn-secondary"}>Tümü</Link>
      {classes.map((c) => (
        <Link key={c.id} href={`${base}?tab=${tab}&sinif=${c.id}${extra}`} className={sinif === c.id ? "btn-primary" : "btn-secondary"}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
