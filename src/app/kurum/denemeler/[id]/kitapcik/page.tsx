import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { EXAM_TYPES, fmtDate, keyFor } from "@/modules/exams";
import { bookletOf, findExam } from "@/modules/exams/server";
import { answerLabel } from "@/modules/question-bank";
import QuestionView from "@/modules/question-bank/ui/QuestionView";
import PrintButton from "@/shared/ui/PrintButton";
import { Empty } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type SP = Promise<{ k?: string; sutun?: string; ort?: string; cevap?: string }>;

/** Havuzdan kurulan denemenin yazdırılabilir soru kitapçığı (A / B, bir ya da iki sütun). Kesilmiş sorular görsel, yazılanlar metin olarak basılır. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await findExam(ownerId, id);
  if (!exam) notFound();

  const booklet = (exam.letters as string[]).includes(sp.k ?? "") ? sp.k! : "A";
  const cols = sp.sutun === "1" ? 1 : 2;
  const cover = sp.ort === "1";
  const withKey = sp.cevap === "1";
  const worksheet = exam.purpose === "WORKSHEET";
  const sections = await bookletOf(ownerId, exam.secs, booklet);
  const hasItems = exam.secs.some((s) => s.items?.length);
  const missing = sections.reduce((n, s) => n + s.questions.filter((q) => !q).length, 0);
  const link = (p: Partial<Record<"k" | "sutun" | "ort" | "cevap", string>>) => {
    const q = new URLSearchParams({ k: booklet, sutun: String(cols), ort: cover ? "1" : "0", cevap: withKey ? "1" : "0", ...p });
    return `?${q}`;
  };
  const pill = (on: boolean) => `rounded-md px-2.5 py-1 text-[13px] ${on ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"}`;
  let n = 0;

  return (
    <div>
      <style>{`@page { size: A4; margin: 12mm 12mm 14mm; } @media print { .booklet { width: auto !important; box-shadow: none !important; padding: 0 !important; } }`}</style>

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
        <Link href={link({ ort: cover ? "0" : "1" })} className={pill(cover)} title="Kesimde kaynağın soru numarası varsa üstünü beyazla örter">
          Kaynak numaralarını ört
        </Link>
        <Link href={link({ cevap: withKey ? "0" : "1" })} className={pill(withKey)} title="Son sayfaya cevap anahtarı ekler">
          Cevap anahtarı sayfası
        </Link>
        <span className="ml-auto flex items-center gap-2">
          <Link href={`/kurum/denemeler/${id}?tab=anahtar`} className="text-[13px] text-lead hover:text-graphite">Cevap anahtarı</Link>
          {!worksheet && <Link href={`/kurum/denemeler/${id}/form`} target="_blank" className="btn-secondary">Optik formu yazdır</Link>}
          <PrintButton label={worksheet ? "Çalışma kağıdını yazdır" : "Kitapçığı yazdır"} />
        </span>
      </div>

      {!hasItems ? (
        <Empty>
          Bu deneme soru havuzundan kurulmadığı için kitapçığı yok. <Link href="/kurum/denemeler/havuzdan" className="font-semibold text-graphite underline">Havuzdan deneme oluşturun</Link>.
        </Empty>
      ) : (
        <article className="booklet mx-auto bg-white px-[12mm] py-[12mm] text-black shadow-lg ring-1 ring-rule" style={{ width: "210mm" }}>
          {missing > 0 && <p className="no-print mb-3 rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-800">{missing} soru havuzdan silinmiş; yerlerinde boşluk var.</p>}
          <header className="mb-4 flex items-stretch gap-4 border-b-2 border-black pb-3">
            <div className="flex-1">
              <h1 className="text-xl leading-tight font-bold">{exam.name}</h1>
              <p className="text-sm">{worksheet ? "Çalışma kağıdı" : (EXAM_TYPES[exam.type]?.label ?? exam.type)} · {fmtDate(exam.date)} · {sections.reduce((a, s) => a + s.questions.length, 0)} soru</p>
              <div className="mt-3 grid grid-cols-[auto_1fr_auto_8rem] items-end gap-x-2 text-sm">
                <span>Adı Soyadı:</span>
                <span className="border-b border-dotted border-black" />
                <span>Numara:</span>
                <span className="border-b border-dotted border-black" />
              </div>
            </div>
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
                          <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? `/api/kurum/soru-havuzu/sorular/${q.id}/gorsel` : null} print optical={!worksheet} />
                        </div>
                      ) : q ? (
                        <div className="relative min-w-0 flex-1">
                          {/* eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel */}
                          <img src={`/api/kurum/soru-havuzu/sorular/${q.id}/gorsel`} alt={`${n}. soru`} className="block h-auto" style={{ width: q.widthMm ? `min(100%, ${q.widthMm}mm)` : "100%" }} />
                          {cover && <span aria-hidden="true" className="absolute top-0 left-0 bg-white [print-color-adjust:exact]" style={{ width: "7mm", height: "5.5mm" }} />}
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
          {withKey && (
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
          )}
        </article>
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
