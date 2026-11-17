import type { Metadata } from "next";
import Link from "next/link";
import { fmtDate } from "@/modules/exams";
import { solutionsByToken } from "@/modules/exams/server";
import QuestionView, { Emphasis } from "@/modules/question-bank/ui/QuestionView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Çözümler", robots: { index: false, follow: false } };

/**
 * Girişsiz çözüm sayfası: kitapçıktaki QR (bütün sorular, `?k=` kitapçık) ya da karnedeki kişisel QR (yalnızca yanlış ve boşlar).
 * Öğretmen yayınlayana kadar kapalı. Telefonda okunacak şekilde tek sütun.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ k?: string }> }) {
  const { token } = await params;
  const { k } = await searchParams;
  const s = await solutionsByToken(token, k);

  if (s.state === "invalid")
    return (
      <Notice icon="🔒" title="Bağlantı geçersiz">
        Bu QR kod ya da bağlantı hatalı. Kâğıttaki kodu yeniden okutun ya da öğretmeninize sorun.
      </Notice>
    );
  if (s.state === "closed")
    return (
      <Notice icon="⏳" title="Çözümler henüz açılmadı">
        <b>{s.exam.name}</b> çözümlerini öğretmeniniz {s.exam.worksheet ? "uygun gördüğünde" : "sınavdan sonra"} açacak. Daha sonra bu kodu yeniden okutun.
      </Notice>
    );

  const imgSrc = (id: string) => `/api/cozum/${encodeURIComponent(token)}/gorsel/${id}`;
  const count = s.sections.reduce((n, x) => n + x.questions.length, 0);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="border-b-2 border-graphite pb-3">
        <div className="text-xs font-bold tracking-widest text-lead uppercase">Çözümler</div>
        <h1 className="text-xl leading-tight font-bold">{s.exam.name}</h1>
        <p className="mt-1 text-sm text-lead">
          {fmtDate(s.exam.date)}
          {s.letters.length > 1 || (s.student && s.booklet !== "A") ? ` · ${s.booklet} kitapçığı` : ""}
          {s.student ? ` · ${s.student}` : ""}
        </p>
        {s.student && (
          <p className="mt-2 text-sm">{count ? `Yanlış ya da boş bıraktığın ${count} sorunun çözümü aşağıda.` : "Bütün soruları doğru yaptın, tebrikler! 🎉"}</p>
        )}
        {s.letters.length > 1 && (
          <nav className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Kitapçık">
            <span className="text-lead">Kitapçığın:</span>
            {s.letters.map((b) => (
              <Link key={b} href={`?k=${b}`} className={`rounded-md px-2.5 py-1 ${b === s.booklet ? "bg-graphite font-semibold text-surface" : "ring-1 ring-rule"}`}>
                {b}
              </Link>
            ))}
          </nav>
        )}
        {count > 6 && (
          <nav className="mt-3 flex flex-wrap gap-1" aria-label="Sorular">
            {s.sections.flatMap((x) => x.questions).map((q) => (
              <a key={q.no} href={`#s${q.no}`} className="min-w-8 rounded bg-mist px-1.5 py-1 text-center text-[13px] tabular-nums">
                {q.no}
              </a>
            ))}
          </nav>
        )}
      </header>

      {s.sections.map((sec, si) => (
        <section key={si} className="mt-6">
          {s.sections.length > 1 && <h2 className="mb-3 text-sm font-bold text-lead">{sec.name}</h2>}
          <ol className="space-y-6">
            {sec.questions.map((q) => (
              <li key={q.no} id={`s${q.no}`} className="scroll-mt-4 rounded-lg p-4 ring-1 ring-rule">
                <div className="mb-2 text-sm font-bold">{q.no}. soru</div>
                {q.content ? (
                  <div className="text-[15px]">
                    <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? imgSrc(q.id) : null} />
                  </div>
                ) : q.hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- anahtarla korunan görsel
                  <img src={imgSrc(q.id)} alt={`${q.no}. soru`} className="block h-auto max-w-full" style={{ width: q.widthMm ? `min(100%, ${q.widthMm * 4}px)` : "100%" }} />
                ) : null}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-2 text-sm">
                  <span>
                    Doğru cevap: <b className="text-emerald-700">{q.answer || "—"}</b>
                  </span>
                  {q.given !== undefined && (
                    <span>
                      Senin cevabın: <b className={q.given ? "text-red-700" : "text-lead"}>{q.given || "boş"}</b>
                    </span>
                  )}
                </div>
                {q.explanation ? (
                  <div className="mt-2 rounded-md bg-paper px-3 py-2 text-[15px]">
                    <div className="mb-1 text-xs font-bold text-lead">Çözüm</div>
                    <p dir="auto" className="whitespace-pre-wrap"><Emphasis text={q.explanation} /></p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-lead">Bu sorunun çözümü eklenmemiş.</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Notice({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-4xl">{icon}</div>
      <h1 className="mt-3 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-lead">{children}</p>
    </div>
  );
}
