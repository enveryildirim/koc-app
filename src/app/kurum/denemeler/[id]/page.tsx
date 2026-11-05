import Link from "next/link";
import { notFound } from "next/navigation";
import { examPlanCoverage } from "@/modules/planning/server";
import ExamPlanCoverage from "@/modules/planning/ui/ExamPlanCoverage";
import { classroomsOf, listStudents } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { choicesFor, discriminationLabel, EXAM_TYPES, fmtDate, fmtNet, ITEM_FLAGS, ITEM_RULES, itemAnalysis, keyFor, LETTERS, normNo, orderFor, sectionsKeyed, topicStats, totalQuestions } from "@/modules/exams";
import { examAbsentees, examReport, findExam } from "@/modules/exams/server";
import { examFormSpec, examKeys } from "@/modules/exams";
import { Empty, Kpi, PageHeader, Tabs, th, td } from "@/shared/ui/kurum";
import KeyEditor from "@/modules/exams/ui/KeyEditor";
import { curriculumTopicNames } from "@/modules/curriculum/server";
import TxtImport from "@/modules/exams/ui/TxtImport";
import DeleteResult from "@/modules/exams/ui/DeleteResult";
import OmrScanner from "@/shared/omr/OmrScanner";
import FormSvg from "@/shared/omr/FormSvg";
import PrintButton from "@/shared/ui/PrintButton";
import ExportButton from "@/shared/ui/ExportButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string; kitapcik?: string }>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await findExam(ownerId, id);
  if (!exam) notFound();
  const keyed = sectionsKeyed(exam.secs, exam.letters.length);
  const multi = exam.letters.length > 1;
  const tab = sp.tab ?? (keyed ? "sonuclar" : "anahtar");
  const base = `/kurum/denemeler/${id}`;
  const tabs = [
    { key: "sonuclar", label: "Sıralı liste", href: `${base}?tab=sonuclar` },
    { key: "anahtar", label: "Cevap anahtarı", href: `${base}?tab=anahtar` },
    { key: "optik", label: "Optik form tara", href: `${base}?tab=optik` },
    { key: "txt", label: "Okuyucu dosyası (TXT)", href: `${base}?tab=txt` },
    { key: "konu", label: "Konu analizi", href: `${base}?tab=konu` },
    { key: "plan", label: "Plan uyumu", href: `${base}?tab=plan` },
    { key: "analiz", label: "Madde analizi", href: `${base}?tab=analiz` },
    { key: "siniflar", label: "Sınıf ortalamaları", href: `${base}?tab=siniflar` },
    { key: "girmeyenler", label: "Girmeyenler", href: `${base}?tab=girmeyenler` },
  ];
  const fileBase = exam.name;
  const header = (
    <>
      <PageHeader
        title={exam.name}
        sub={`${EXAM_TYPES[exam.type]?.label ?? exam.type} · ${fmtDate(exam.date)} · ${totalQuestions(exam.secs)} soru · ${exam.wrongPer ? `${exam.wrongPer} yanlış 1 doğruyu götürür` : "yanlış doğruyu götürmez"}`}
        back={{ href: "/kurum/denemeler", label: "Denemeler" }}
        actions={
          <>
            {exam.secs.some((s) => s.items?.length) && <Link href={`${base}/kitapcik`} className="btn-secondary">Soru kitapçığı</Link>}
            <PrintButton />
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} />
      {!keyed && tab !== "anahtar" && (
        <p className="no-print mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Cevap anahtarı eksik. Sonuçlar anahtar girildiğinde otomatik yeniden hesaplanır. <Link className="font-semibold underline" href={`${base}?tab=anahtar`}>Anahtarı gir</Link>
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
          type={exam.type}
          scoring={exam.scoringResolved}
          initial={{ name: exam.name, date: exam.date.toISOString().slice(0, 10), booklets: exam.letters.length, wrongPer: exam.wrongPer, sections: exam.secs }}
          choices={choicesFor(exam.type)}
          hasResults={exam.resultCount > 0}
          topicSuggestions={await curriculumTopicNames(ownerId)}
        />
      </>
    );
  }

  /* ------------------------------- Optik okuma -------------------------------- */
  if (tab === "optik" || tab === "txt") {
    const students = await listStudents(ownerId);
    const map = Object.fromEntries(
      students.map((s) => [normNo(s.studentNo), `${s.firstName} ${s.lastName} (${s.classroom?.name ?? (s.external ? "Kurum dışı" : "—")})`]),
    );
    const spec = examFormSpec(exam.name, exam.type, exam.secs, exam.letters);
    if (tab === "txt") {
      return (
        <>
          {header}
          <TxtImport
            examId={id}
            total={totalQuestions(exam.secs)}
            booklets={exam.letters}
            choices={choicesFor(exam.type)}
            sampleNos={students.filter((s) => !s.external).map((s) => s.studentNo)}
            keys={Object.fromEntries(exam.letters.map((b) => [b, exam.secs.map((s) => keyFor(s, b).padEnd(s.count, " ")).join("")]))}
            students={map}
          />
        </>
      );
    }
    return (
      <>
        {header}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="card p-4">
              <h2 className="font-semibold">Optik form</h2>
              <p className="mt-1 text-sm text-lead">
                Bu sınava özel form: bölüm başlıkları{multi ? `, kitapçık türü (${exam.letters.join(", ")})` : ""} ve 6 haneli öğrenci numarası alanı.
              </p>
              <FormSvg info={spec} className="mt-3 w-full rounded ring-1 ring-rule" />
              <Link href={`${base}/form`} target="_blank" className="btn-primary mt-3 w-full">Formu yazdır</Link>
            </div>
            <div className="card p-4 text-sm text-lead">
              Okunan öğrenci numarası kayıtlı öğrencilerle eşleştirilir (baştaki sıfırlar önemsizdir). Aynı öğrenci tekrar okutulursa sonucu güncellenir.
            </div>
          </aside>
          <OmrScanner
            spec={spec}
            keys={examKeys(exam.secs, exam.letters)}
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

  const report = await examReport(ownerId, id);
  if (!report) notFound();
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

  /* -------------------------------- Girmeyenler -------------------------------- */
  if (tab === "girmeyenler") {
    const { expected, missing } = await examAbsentees(ownerId, id, sinif || undefined);
    return (
      <>
        {header}
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <ClassFilter base={base} tab="girmeyenler" classes={classes} sinif={sinif} />
          <ExportButton
            fileName={`${fileBase} - girmeyenler`}
            headers={["No", "Ad Soyad", "Sınıf", "Telefon", "Veli", "Veli telefonu"]}
            rows={missing.map((s) => [s.studentNo, `${s.firstName} ${s.lastName}`, s.classroom?.name ?? "", s.phone, s.parentName, s.parentPhone])}
          />
        </div>
        <p className="mb-3 text-sm text-lead">
          Sınava girdiği sınıflardaki öğrencilerden sonucu olmayanlar: <b>{missing.length}</b> / {expected} öğrenci.
        </p>
        {missing.length === 0 ? (
          <Empty>Tüm öğrenciler sınava girmiş. </Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr>
                  <th className={th}>No</th>
                  <th className={th}>Ad Soyad</th>
                  <th className={th}>Sınıf</th>
                  <th className={th}>Veli</th>
                  <th className={th}>Veli telefonu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {missing.map((s) => (
                  <tr key={s.id}>
                    <td className={`${td} num`}>{s.studentNo}</td>
                    <td className={td}>
                      <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:text-brand-600">{s.firstName} {s.lastName}</Link>
                    </td>
                    <td className={td}>{s.classroom?.name}</td>
                    <td className={td}>{s.parentName || "—"}</td>
                    <td className={td}>{s.parentPhone ? <a className="num underline decoration-rule underline-offset-4 hover:decoration-graphite" href={`tel:${s.parentPhone.replace(/\s/g, "")}`}>{s.parentPhone}</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  /* ------------------------------ Yıllık plan uyumu ------------------------------ */
  if (tab === "plan") {
    const cov = await examPlanCoverage(ownerId, id);
    const shown = (cov?.classes ?? []).filter((c) => !sinif || c.classroomId === sinif);
    return (
      <>
        {header}
        {!cov?.hasTopics ? (
          <Empty>
            Plan uyumu için sorulara konu atanmış olmalı. <Link className="font-semibold text-brand-600" href={`${base}?tab=anahtar`}>Cevap anahtarı</Link> ekranındaki
            “Konular / kazanımlar” bölümünden ekleyebilirsiniz.
          </Empty>
        ) : shown.length === 0 ? (
          <Empty>Bu denemede sınıfı olan öğrenci sonucu yok.</Empty>
        ) : (
          <>
            <div className="no-print mb-4 flex flex-wrap items-center gap-2">
              <ClassFilter base={base} tab="plan" classes={classes} sinif={sinif} />
            </div>
            <ExamPlanCoverage classes={shown} examDate={cov.exam.date} />
          </>
        )}
      </>
    );
  }

  /* -------------------------------- Konu analizi ------------------------------- */
  if (tab === "konu") {
    const stats = topicStats(exam.secs, rows).sort((a, b) => a.rate - b.rate);
    const general = sinif ? topicStats(exam.secs, report.rows) : stats;
    const genRate = new Map(general.map((g) => [g.section + "|" + g.topic, g.rate]));
    const noTopics = exam.secs.every((s) => !s.topics?.some(Boolean));
    const missingMap = exam.letters.filter((b) => b !== "A" && exam.secs.some((s) => s.topics?.some(Boolean) && !orderFor(s, b)));
    return (
      <>
        {header}
        {noTopics ? (
          <Empty>
            Bu denemede sorulara konu atanmamış. <Link className="font-semibold text-brand-600" href={`${base}?tab=anahtar`}>Cevap anahtarı</Link> ekranındaki
            “Konular / kazanımlar” bölümünden ekleyebilirsiniz.
          </Empty>
        ) : (
          <>
            <div className="no-print mb-4 flex flex-wrap items-center gap-2">
              <ClassFilter base={base} tab="konu" classes={classes} sinif={sinif} />
              <ExportButton
                fileName={`${fileBase} - konu analizi`}
                headers={["Ders", "Konu", "Soru sayısı", "Doğru oranı %", ...(sinif ? ["Kurum %"] : [])]}
                rows={stats.map((t) => [t.section, t.topic, t.questions, t.rate, ...(sinif ? [genRate.get(t.section + "|" + t.topic) ?? null] : [])])}
              />
            </div>
            {missingMap.length > 0 && (
              <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Bazı bölümlerde {missingMap.join(", ")} kitapçığı soru eşlemesi girilmemiş; bu bölümlerde o kitapçıklı öğrenciler hesaba katılmadı.
              </p>
            )}
            <p className="mb-3 text-sm text-lead">En zayıf konudan en güçlüye sıralı. %50’nin altındaki konular kırmızıdır; tekrar planlamasında öncelik verilebilir.</p>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper">
                  <tr>
                    <th className={th}>Ders</th>
                    <th className={th}>Konu</th>
                    <th className={`${th} text-right`}>Soru</th>
                    <th className={th}>Doğru oranı</th>
                    {sinif && <th className={`${th} text-right`}>Kurum</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/70">
                  {stats.map((t) => (
                    <tr key={t.section + t.topic}>
                      <td className={`${td} text-lead`}>{t.section}</td>
                      <td className={`${td} font-medium`}>{t.topic}</td>
                      <td className={`${td} text-right`}>{t.questions}</td>
                      <td className={`${td} w-64`}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded bg-mist">
                            <div className={`h-full ${t.rate < 50 ? "bg-red-400" : t.rate < 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${t.rate}%` }} />
                          </div>
                          <span className={`w-10 text-right text-xs font-semibold ${t.rate < 50 ? "text-red-600" : ""}`}>%{t.rate}</span>
                        </div>
                      </td>
                      {sinif && <td className={`${td} text-right text-lead`}>%{genRate.get(t.section + "|" + t.topic) ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>
    );
  }

  /* ------------------------------ Madde analizi ------------------------------ */
  if (tab === "analiz") {
    const c = choicesFor(exam.type);
    const letters = LETTERS.slice(0, c).split("");
    const { items, skipped } = itemAnalysis(exam.secs, rows, c);
    const hasTopics = items.some((x) => x.topic);
    const flagged = items.filter((x) => x.flag);
    const fmtD = (d: number | null) => (d === null ? "—" : d.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const avgP = items.length ? Math.round(items.reduce((a, x) => a + x.p, 0) / items.length) : 0;
    const n = items[0]?.n ?? 0;
    return (
      <>
        {header}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Ortalama güçlük" value={`%${avgP}`} hint={`${n} öğrencinin doğru oranı`} />
          <Kpi label="Gözden geçirilecek soru" value={flagged.length} hint="anahtar şüphesi veya düşük ayırt edicilik" />
          <Kpi label="Çok zor" value={items.filter((x) => x.p < ITEM_RULES.hard).length} hint={`doğru oranı %${ITEM_RULES.hard} altı`} />
          <Kpi label="Çok kolay" value={items.filter((x) => x.p > ITEM_RULES.easy).length} hint={`doğru oranı %${ITEM_RULES.easy} üstü`} />
        </div>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <ClassFilter base={base} tab="analiz" classes={classes} sinif={sinif} extra="" />
          <ExportButton
            fileName={`${fileBase} - madde analizi`}
            headers={["Ders", "Soru (A)", ...(hasTopics ? ["Konu"] : []), "Cevap", ...letters.map((l) => `${l} %`), "Boş %", "Güçlük (doğru %)", "Ayırt edicilik", "Uyarı"]}
            rows={items.map((x) => [
              x.section,
              x.q,
              ...(hasTopics ? [x.topic] : []),
              x.key,
              ...letters.map((l) => x.choices[l]),
              x.blank,
              x.p,
              x.d,
              x.flag ? ITEM_FLAGS[x.flag] : "",
            ])}
          />
        </div>
        {skipped.length > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Kitapçık eşlemesi olmadığı için analize katılmayanlar:{" "}
            {skipped.map((x) => `${x.section}, ${x.booklet} kitapçığı (${x.count} öğrenci)`).join("; ")}.{" "}
            <Link className="font-semibold underline" href={`${base}?tab=anahtar`}>Cevap anahtarında eşlemeyi girin</Link>.
          </p>
        )}
        <p className="mb-4 text-sm text-lead">
          {multi ? "Bütün kitapçıklar A sırasına çevrilerek birleştirildi; soru numaraları A kitapçığına göredir. " : ""}
          Ayırt edicilik, bölümde en başarılı %27 ile en başarısız %27 öğrencinin doğru oranı farkıdır: 0,40 ve üstü çok iyi, 0,30 iyi, 0,20 düzeltilebilir, altı zayıf.
          {n > 0 && n < ITEM_RULES.minN ? ` Katılım ${ITEM_RULES.minN} öğrencinin altında; ayırt edicilik değerleri yalnızca fikir verir.` : ""}
        </p>
        {exam.secs.map((sec) => {
          const list = items.filter((x) => x.section === sec.name);
          return (
            <div key={sec.name} className="card mb-4 overflow-x-auto">
              <h3 className="border-b border-rule/70 px-4 py-2 font-semibold">
                {sec.name}
                {list.some((x) => x.flag) && <span className="ml-2 text-xs font-normal text-red-700">{list.filter((x) => x.flag).length} soru gözden geçirilmeli</span>}
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-paper">
                  <tr>
                    <th className={`${th} pin`}>Soru</th>
                    {hasTopics && <th className={th}>Konu</th>}
                    <th className={th}>Cevap</th>
                    {letters.map((l) => (
                      <th key={l} className={`${th} text-right`}>{l}</th>
                    ))}
                    <th className={`${th} text-right`}>Boş</th>
                    <th className={th}>Güçlük</th>
                    <th className={`${th} text-right`}>Ayırt edicilik</th>
                    <th className={th}>Uyarı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/70">
                  {list.map((x) => {
                    const dl = x.d === null ? null : discriminationLabel(x.d);
                    return (
                      <tr key={x.q} className={x.flag === "KEY" ? "bg-red-50/40" : ""}>
                        <td className={`${td} pin font-semibold`}>{x.q}</td>
                        {hasTopics && <td className={`${td} max-w-[14rem] truncate text-lead`} title={x.topic}>{x.topic || "—"}</td>}
                        <td className={`${td} font-bold text-emerald-700`}>{x.key || "?"}</td>
                        {letters.map((l) => (
                          <td
                            key={l}
                            className={`${td} text-right tabular-nums ${
                              l === x.key ? "font-bold text-emerald-700" : l === x.topDistractor?.letter && x.choices[l] >= 20 ? "font-semibold text-amber-700" : "text-lead"
                            }`}
                          >
                            %{x.choices[l]}
                          </td>
                        ))}
                        <td className={`${td} text-right tabular-nums text-lead/70`}>%{x.blank}</td>
                        <td className={`${td} w-36`}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded bg-mist">
                              <div className={x.p < 40 ? "h-full bg-red-400" : "h-full bg-emerald-500"} style={{ width: `${x.p}%` }} />
                            </div>
                            <span className={`w-9 text-right text-xs font-semibold ${x.p < 40 ? "text-red-600" : ""}`}>%{x.p}</span>
                          </div>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          <b>{fmtD(x.d)}</b>
                          {dl && <div className={`text-[11px] ${dl.cls}`}>{dl.label}</div>}
                        </td>
                        <td className={`${td} text-[13px]`}>
                          {x.flag === "KEY" && x.topDistractor ? (
                            <span className="text-red-700">
                              {ITEM_FLAGS.KEY}: başarılı grubun %{x.topDistractor.upperPct} kadarı {x.topDistractor.letter} şıkkını seçti
                            </span>
                          ) : x.flag ? (
                            <span className={x.flag === "NEGATIVE_D" ? "text-red-700" : "text-amber-700"}>{ITEM_FLAGS[x.flag]}</span>
                          ) : (
                            <span className="text-lead/60">—</span>
                          )}
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
            <thead className="bg-paper">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={`${th} text-right`}>Öğrenci</th>
                {exam.secs.map((s) => (
                  <th key={s.name} className={`${th} text-right`}>{s.name}</th>
                ))}
                <th className={`${th} text-right`}>Toplam net</th>
                <th className={`${th} text-right`}>Ort. puan</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {list.map((c) => (
                <tr key={c.name}>
                  <td className={`${td} font-semibold`}>{c.name}</td>
                  <td className={`${td} text-right`}>{c.size}</td>
                  {c.sections.map((v, i) => (
                    <td key={i} className={`${td} text-right tabular-nums ${v < report.general.sections[i] ? "text-red-600" : "text-emerald-700"}`}>{fmtNet(v)}</td>
                  ))}
                  <td className={`${td} text-right font-bold tabular-nums`}>{fmtNet(c.total)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtNet(c.score)}</td>
                  <td className={`${td} w-40`}>
                    <div className="h-2 overflow-hidden rounded bg-mist">
                      <div className="h-full bg-graphite" style={{ width: `${(c.total / maxTotal) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-graphite bg-paper font-semibold">
                <td className={td}>Kurum geneli</td>
                <td className={`${td} text-right`}>{report.general.n}</td>
                {report.general.sections.map((v, i) => (
                  <td key={i} className={`${td} text-right tabular-nums`}>{fmtNet(v)}</td>
                ))}
                <td className={`${td} text-right tabular-nums`}>{fmtNet(report.general.total)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNet(report.general.score)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-lead">Yeşil: kurum ortalamasının üstü · Kırmızı: altı · Puanlar tahminidir.</p>
          <ExportButton
            fileName={`${fileBase} - sınıf ortalamaları`}
            headers={["Sınıf", "Öğrenci", ...exam.secs.map((s) => `${s.name} net`), "Toplam net", "Ort. puan"]}
            rows={[
              ...list.map((c) => [c.name, c.size, ...c.sections, c.total, c.score]),
              ["Kurum geneli", report.general.n, ...report.general.sections, report.general.total, report.general.score],
            ]}
          />
        </div>
      </>
    );
  }

  /* -------------------------------- Sıralı liste ------------------------------- */
  const sel = sinif ? report.classAvg.get(sinif) : null;
  return (
    <>
      {header}
      <div className="no-print mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Katılım" value={rows.length} />
        <Kpi label="Ortalama net" value={fmtNet(sel ? sel.total : report.general.total)} />
        <Kpi label="Ort. tahmini puan" value={fmtNet(sel ? sel.score : report.general.score)} hint={`En yüksek ${fmtNet(Math.max(...rows.map((r) => r.score)))}`} />
        <Kpi label="Net aralığı" value={`${fmtNet(Math.min(...rows.map((r) => r.totalNet)))} – ${fmtNet(Math.max(...rows.map((r) => r.totalNet)))}`} />
      </div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <ClassFilter base={base} tab="sonuclar" classes={classes} sinif={sinif} />
        <Link href={`${base}/karneler${sinif ? `?sinif=${sinif}` : ""}`} className="btn-secondary">Tüm karneleri yazdır</Link>
        <ExportButton
          fileName={`${fileBase} - sıralı liste`}
          headers={[
            "Genel sıra", "Sınıf sırası", "No", "Ad Soyad", "Sınıf", "Kitapçık",
            ...exam.secs.flatMap((s) => [`${s.name} D`, `${s.name} Y`, `${s.name} Net`]),
            "Toplam net", "Tahmini puan", "Yüzdelik %",
          ]}
          rows={rows.map((r) => [
            r.rank, r.classRank, r.studentNo, r.name, r.className, r.booklet,
            ...r.stats.flatMap((s) => [s.d, s.y, s.net]),
            r.totalNet, r.score, r.percentile,
          ])}
        />
      </div>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{exam.name} – Sıralı Liste</h1>
        <p className="mb-2 text-sm">{fmtDate(exam.date)}{sel ? ` · ${sel.name}` : ""}</p>
      </div>
      <div className="card overflow-x-auto print:shadow-none print:ring-0">
        <table className="w-full text-xs">
          <thead className="bg-paper">
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
              <th className={`${th} text-right`}>Puan</th>
              <th className={`${th} text-right`} title="Kurum içi yüzdelik dilim">%</th>
              <th className="no-print" />
            </tr>
            <tr className="text-[10px] text-lead/70">
              <th colSpan={6} />
              {exam.secs.map((s) => (
                <Sub key={s.name} />
              ))}
              <th colSpan={4} />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper">
                <td className={`${td} font-bold`}>{r.rank}</td>
                <td className={td}>{r.classRank}</td>
                <td className={`${td} num`}>{r.studentNo}</td>
                <td className={td}>
                  <Link href={`${base}/karne/${r.id}`} className="font-medium hover:text-brand-600">{r.name}</Link>
                </td>
                <td className={td}>{r.className}</td>
                <td className={td}>{r.booklet}</td>
                {r.stats.map((s, i) => (
                  <Cells key={i} s={s} />
                ))}
                <td className={`${td} text-right text-sm font-bold tabular-nums`}>{fmtNet(r.totalNet)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNet(r.score)}</td>
                <td className={`${td} text-right tabular-nums text-lead`}>{r.percentile}</td>
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
