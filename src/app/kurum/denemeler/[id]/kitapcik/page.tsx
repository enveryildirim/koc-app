import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { examFormSpec, keyFor } from "@/modules/exams";
import { bookletOf, examSolutionToken, findExam } from "@/modules/exams/server";
import { answerLabel } from "@/modules/question-bank";
import QuestionView from "@/modules/question-bank/ui/QuestionView";
import FormSvg from "@/shared/omr/FormSvg";
import FormStudentNo from "@/modules/exams/ui/FormStudentNo";
import PrintButton from "@/shared/ui/PrintButton";
import { Empty } from "@/shared/ui/kurum";
import QrCode from "@/shared/ui/QrCode";
import { publicOrigin } from "@/shared/origin";

export const dynamic = "force-dynamic";

type SP = Promise<{ k?: string; sutun?: string; cevap?: string; optik?: string; cozum?: string; qr?: string }>;

/**
 * Havuzdan kurulan denemenin yazdırılabilir soru kitapçığı (A / B, bir ya da iki sütun). Kesilmiş sorular görsel, yazılanlar metin olarak basılır.
 * `optik=1`: optik form soruların arkasına eklenir (tek yazdırmada sorular + form). Form okunabilsin diye kendi sayfası kenar boşluksuz
 * basılır (CSS adlandırılmış sayfa `@page omr`); soru sayfaları kitapçığın kenar boşluğunu korur. Cevap anahtarı açıksa en sondadır.
 * `cozum=1`: çözümü yazılmış soruların çözümleri, kitapçık sırasıyla, en sona ("Çözümler"); düğme yalnızca çözümlü soru varsa görünür.
 * `qr=0`: başlıktaki çözüm QR'ı basılmaz. QR, öğretmen yayınlayana kadar kapalı olan çözüm sayfasını (`/cozum/<anahtar>?k=`) açar.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await findExam(ownerId, id);
  if (!exam) notFound();

  const booklet = (exam.letters as string[]).includes(sp.k ?? "") ? sp.k! : "A";
  const cols = sp.sutun === "1" ? 1 : 2;
  const withKey = sp.cevap === "1";
  const worksheet = exam.purpose === "WORKSHEET";
  const withForm = sp.optik === "1" && !worksheet;
  const sections = await bookletOf(ownerId, exam.secs, booklet);
  const hasItems = exam.secs.some((s) => s.items?.length);
  const missing = sections.reduce((n, s) => n + s.questions.filter((q) => !q).length, 0);
  const solvable = sections.some((s) => s.questions.some((q) => q?.explanation));
  const withSol = sp.cozum === "1" && solvable;
  const withQr = sp.qr !== "0" && hasItems;
  const qrUrl = withQr ? `${await publicOrigin()}/cozum/${await examSolutionToken(ownerId, id)}${exam.letters.length > 1 ? `?k=${booklet}` : ""}` : null;
  const link = (p: Partial<Record<"k" | "sutun" | "cevap" | "optik" | "cozum" | "qr", string>>) => {
    const q = new URLSearchParams({ k: booklet, sutun: String(cols), cevap: withKey ? "1" : "0", optik: withForm ? "1" : "0", cozum: withSol ? "1" : "0", qr: withQr ? "1" : "0", ...p });
    return `?${q}`;
  };
  const pill = (on: boolean) => `rounded-md px-2.5 py-1 text-[13px] ${on ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"}`;
  let n = 0;
  // Cevap anahtarı: optik form eklenmişse formdan sonra, en son sayfada
  const keySection = (
    <section style={{ breakBefore: "page" }} className="mt-8 print:mt-0">
      <h2 className="mb-3 bg-black px-2 py-1 text-sm font-bold text-white [print-color-adjust:exact]">Cevap anahtarı{exam.letters.length > 1 ? ` (${booklet} kitapçığı)` : ""}</h2>
      {worksheet ? (
        <WorksheetKey sections={sections} />
      ) : (() => {
        let k = 0;
        return exam.secs.map((sec, si) => {
          const key = keyFor(sec, booklet);
          return (
            <div key={si} className="mb-3">
              {exam.secs.length > 1 && <h3 className="mb-1 text-sm font-bold">{sec.name}</h3>}
              <div className="grid grid-cols-10 gap-x-3 gap-y-1 text-sm">
                {Array.from({ length: sec.count }, (_, i) => {
                  k++;
                  return <span key={i}><b>{k}.</b> {key[i]?.trim() || "—"}</span>;
                })}
              </div>
            </div>
          );
                });
              })()}
            </section>
  );

  // Çözümler: kitapçıktaki soru numarasıyla, yalnızca çözümü yazılmış sorular
  const solSection = (() => {
    let k = 0;
    const rows = sections.flatMap((s) => s.questions.map((q) => ({ no: ++k, text: q?.explanation ?? "" }))).filter((r) => r.text);
    return (
      <section style={{ breakBefore: "page" }} className="mt-8 print:mt-0">
        <h2 className="mb-3 bg-black px-2 py-1 text-sm font-bold text-white [print-color-adjust:exact]">Çözümler{exam.letters.length > 1 ? ` (${booklet} kitapçığı)` : ""}</h2>
        <ol className="space-y-2 text-[13px]">
          {rows.map((r) => (
            <li key={r.no} className="flex gap-1.5" style={{ breakInside: "avoid" }}>
              <b className="w-6 shrink-0 text-right">{r.no}.</b>
              <span dir="auto" className="min-w-0 whitespace-pre-wrap">{r.text}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  })();
  const tail = (
    <>
      {withKey && keySection}
      {withSol && solSection}
    </>
  );

  return (
    <div>
      <style>{`@page { size: A4; margin: 12mm 12mm 14mm; } @page omr { size: A4; margin: 0; } .omr-sheet { page: omr; } @media print { .booklet { width: auto !important; box-shadow: none !important; padding: 0 !important; } .omr-sheet { margin: 0 !important; box-shadow: none !important; break-before: page; } }`}</style>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2 border-b border-rule pb-3">
        <Link href={`/kurum/denemeler/${id}`} className="mr-2 text-[13px] text-lead hover:text-graphite">‹ {exam.name}</Link>
        {exam.letters.length > 1 && (
          <>
            {exam.letters.map((b) => (
              <Link key={b} href={link({ k: b })} className={pill(booklet === b)}>{b} kitapçığı</Link>
            ))}
            <span className="mx-1 h-4 w-px bg-rule" />
          </>
        )}
        <Link href={link({ sutun: "2" })} className={pill(cols === 2)}>İki sütun</Link>
        <Link href={link({ sutun: "1" })} className={pill(cols === 1)}>Tek sütun</Link>
        <span className="mx-1 h-4 w-px bg-rule" />
        {!worksheet && (
          <Link href={link({ optik: withForm ? "0" : "1" })} className={pill(withForm)} title="Soruların arkasına optik formu ekler; tek seferde sorular ve form yazdırılır">
            Optik formu arkaya ekle
          </Link>
        )}
        {withForm && (
          <span className="ml-1">
            <FormStudentNo examId={id} on={exam.omrStudentNo !== false} compact />
          </span>
        )}
        <Link href={link({ cevap: withKey ? "0" : "1" })} className={pill(withKey)} title={withForm ? "Optik formdan sonra, en son sayfaya cevap anahtarı ekler" : "Son sayfaya cevap anahtarı ekler"}>
          Cevap anahtarı sayfası
        </Link>
        {solvable && (
          <Link href={link({ cozum: withSol ? "0" : "1" })} className={pill(withSol)} title="Çözümü yazılmış soruların çözümlerini en sona ekler">
            Çözümler
          </Link>
        )}
        {hasItems && (
          <Link href={link({ qr: withQr ? "0" : "1" })} className={pill(withQr)} title="Başlığa çözüm sayfasının QR'ını basar. Sayfa, deneme ekranında “Çözümleri yayınla” denene kadar kapalıdır.">
            Çözüm QR’ı
          </Link>
        )}
        <span className="ml-auto flex items-center gap-2">
          <Link href={`/kurum/denemeler/${id}?tab=anahtar`} className="text-[13px] text-lead hover:text-graphite">Cevap anahtarı</Link>
          {!worksheet && !withForm && <Link href={`/kurum/denemeler/${id}/form`} target="_blank" className="btn-secondary">Optik formu yazdır</Link>}
          <PrintButton label={worksheet ? "Çalışma kağıdını yazdır" : withForm ? "Kitapçık + optik formu yazdır" : "Kitapçığı yazdır"} />
        </span>
      </div>

      {!hasItems ? (
        <Empty>
          Bu deneme soru havuzundan kurulmadığı için kitapçığı yok. <Link href="/kurum/denemeler/havuzdan" className="font-semibold text-graphite underline">Havuzdan deneme oluşturun</Link>.
        </Empty>
      ) : (
        <article className="paper booklet mx-auto bg-white px-[12mm] py-[12mm] text-black shadow-lg ring-1 ring-rule" style={{ width: "210mm" }}>
          {missing > 0 && <p className="no-print mb-3 rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-800">{missing} soru havuzdan silinmiş; yerlerinde boşluk var.</p>}
          <header className="mb-4 flex items-stretch gap-4 border-b-2 border-black pb-3">
            <div className="flex-1">
              <h1 className="text-xl leading-tight font-bold">{exam.name}</h1>
              <div className="mt-3 grid grid-cols-[auto_1fr_auto_8rem] items-end gap-x-2 text-sm">
                <span>Adı Soyadı:</span>
                <span className="border-b border-dotted border-black" />
                <span>Numara:</span>
                <span className="border-b border-dotted border-black" />
              </div>
            </div>
            {qrUrl && (
              <div className="flex w-[22mm] flex-col items-center justify-center text-center">
                <QrCode text={qrUrl} size="20mm" title="Çözümler" />
                <span className="mt-0.5 text-[8px] leading-tight">{worksheet ? "Çözümler" : "Çözümler · sınavdan sonra"}</span>
              </div>
            )}
            {exam.letters.length > 1 && (
              <div className="flex w-20 flex-col items-center justify-center rounded border-2 border-black">
                <span className="text-[10px] tracking-wide uppercase">Kitapçık</span>
                <span className="text-4xl leading-none font-bold">{booklet}</span>
              </div>
            )}
          </header>

          {sections.map((s, si) => (
            <section key={si} style={si ? { breakBefore: "page" } : undefined} className={si ? "mt-8 print:mt-0" : ""}>
              <h2 className="mb-3 bg-black px-2 py-1 text-sm font-bold text-white [print-color-adjust:exact]">
                {s.name} <span className="font-normal">({s.questions.length} soru)</span>
              </h2>
              <div style={{ columnCount: cols, columnGap: "8mm", columnRule: cols > 1 ? "1px solid #bbb" : undefined }}>
                {s.questions.map((q, qi) => {
                  n++;
                  return (
                    <div key={qi} className="mb-5 flex gap-1.5" style={{ breakInside: "avoid" }}>
                      <b className="w-6 shrink-0 pt-0.5 text-right text-[13px]">{n}.</b>
                      {q?.content ? (
                        <div className="min-w-0 flex-1 text-[13px]">
                          <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? `/api/kurum/soru-havuzu/sorular/${q.id}/gorsel` : null} print optical={!worksheet} narrow={cols === 2} />
                        </div>
                      ) : q ? (
                        <div className="relative min-w-0 flex-1">
                          {/* eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel */}
                          <img src={`/api/kurum/soru-havuzu/sorular/${q.id}/gorsel`} alt={`${n}. soru`} className="block h-auto" style={{ width: q.widthMm ? `min(100%, ${q.widthMm}mm)` : "100%" }} />
                        </div>
                      ) : (
                        <div className="h-16 flex-1 border border-dashed border-black/40" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!withForm && tail}
        </article>
      )}
      {hasItems && withForm && (
        <>
          {/* Optik form: kenar boşluksuz kendi sayfası (@page omr), okuyucu ölçüleri bozulmasın */}
          <div className="paper omr-sheet mx-auto mt-8 bg-white shadow-lg ring-1 ring-rule" style={{ width: "210mm", height: "297mm" }}>
            <FormSvg info={examFormSpec(exam.name, exam.type, exam.secs, exam.letters, { studentNumber: exam.omrStudentNo, booklet })} style={{ width: "210mm", height: "297mm", display: "block" }} />
          </div>
          {(withKey || withSol) && (
            <article className="paper booklet mx-auto mt-8 bg-white px-[12mm] py-[12mm] text-black shadow-lg ring-1 ring-rule print:mt-0" style={{ width: "210mm", breakBefore: "page" }}>
              {tail}
            </article>
          )}
        </>
      )}
    </div>
  );
}

type KeySection = { name: string; questions: ({ type: string; answer: string } | null)[] };

/** Çalışma kağıdının anahtarı: her sorunun kendi cevabı (şık, Doğru/Yanlış, boşluklar, örnek cevap). */
function WorksheetKey({ sections }: { sections: KeySection[] }) {
  let k = 0;
  const all = sections.flatMap((s) => s.questions);
  const short = all.every((q) => !q || answerLabel(q.type, q.answer).length <= 8);
  return (
    <>
      {sections.map((s, si) => (
        <div key={si} className="mb-3">
          {sections.length > 1 && <h3 className="mb-1 text-sm font-bold">{s.name}</h3>}
          <ol className={short ? "grid grid-cols-6 gap-x-3 gap-y-1 text-sm" : "space-y-1 text-sm"}>
            {s.questions.map((q, i) => {
              k++;
              const a = q ? answerLabel(q.type, q.answer) : "";
              return (
                <li key={i} className="flex gap-1.5">
                  <b className="shrink-0">{k}.</b>
                  <span dir="auto" className="whitespace-pre-wrap">{a || "—"}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </>
  );
}
