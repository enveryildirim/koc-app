import Link from "next/link";

/** Açılış: optik form şeridi doldurulur, net hesaplanır. Sayfanın tek hareketli anı. */
const SHEET: { section: string; answers: string; key: string }[] = [
  { section: "Türkçe", answers: "CADBBCACDA", key: "CADBBDACDA" },
  { section: "Matematik", answers: "BDA CDBAAC", key: "BDACCDBAAD" },
];
/** LGS: 4 şık, 3 yanlış 1 doğruyu götürür. */
const LETTERS = "ABCD";
const WRONG_PER = 3;

function AnswerSheet() {
  let n = 0;
  const stats = SHEET.map((s) => {
    let d = 0;
    let y = 0;
    let b = 0;
    [...s.answers].forEach((a, i) => (a === " " ? b++ : a === s.key[i] ? d++ : y++));
    return { d, y, b, net: d - y / WRONG_PER };
  });
  const total = stats.reduce((a, s) => a + s.net, 0);
  const fmt = (x: number) => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <figure aria-label="Örnek optik form ve hesaplanan net" className="rounded-lg bg-white p-5 ring-1 ring-rule sm:p-6">
      <div className="flex items-baseline justify-between border-b border-ink/30 pb-2 text-[13px] text-ink">
        <span className="font-semibold">LGS Deneme 3, A kitapçığı</span>
        <span className="num">Öğrenci no 1035</span>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {SHEET.map((s, si) => (
          <div key={s.section}>
            <div className="mb-2 text-[13px] font-semibold text-ink">{s.section}</div>
            <ol className="space-y-1.5">
              {[...s.answers].map((a, qi) => {
                const delay = 0.25 + n++ * 0.07;
                return (
                  <li key={qi} className="flex items-center gap-2">
                    <span className="num w-5 text-right text-[12px] text-ink/80">{qi + 1}</span>
                    {[...LETTERS].map((L) => (
                      <span key={L} className="relative grid size-[18px] place-items-center rounded-full border border-ink/60 text-[9px] text-ink/70">
                        {L}
                        {a === L && <span className="sheet-mark absolute inset-[1.5px] rounded-full bg-graphite" style={{ animationDelay: `${delay}s` }} />}
                      </span>
                    ))}
                    {si === 1 && qi === 3 && <span className="text-[11px] text-lead">boş</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <figcaption className="sheet-result mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-rule pt-3 text-[15px]" style={{ animationDelay: `${0.35 + n * 0.07}s` }}>
        {SHEET.map((s, i) => (
          <span key={s.section} className="num">
            {s.section} <b>{fmt(stats[i].net)}</b>
          </span>
        ))}
        <span className="num ml-auto">
          Toplam net <b className="font-display text-2xl [font-stretch:85%]">{fmt(total)}</b>
        </span>
      </figcaption>
    </figure>
  );
}

const WEEK: [string, string][] = [
  ["Deneme sonrası", "Hafta sonu denemesinin optik formlarını telefonla okutun ya da okuyucunun TXT dosyasını yükleyin. Sıralı liste, öğrenci karneleri ve konu analizi hazır olur."],
  ["Her derste", "Yoklamayı birkaç dokunuşla alın, o derste işlenen konuyu yıllık planda işaretleyin."],
  ["Hafta ortası", "Plana göre geride kalan dersleri, devamsızlığı artan ve ödev yapmayan öğrencileri tek ekranda görün."],
  ["Hafta sonu", "Veli karnesini WhatsApp ile paylaşın: deneme sonuçları, ödevler, devam ve yaklaşan sınavlar."],
];

export default function Home() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1fr_minmax(0,30rem)] md:py-20">
        <div className="max-w-xl">
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold sm:text-[3.4rem]">Dershanenin günü: deneme, yoklama, plan ve veli karnesi bir arada</h1>
          <p className="mt-5 max-w-[56ch] text-lg text-lead">
            SınavKur deneme sınavlarını optik formdan okur, neti ve sıralamayı hesaplar. Yoklamayı, ödevleri ve yıllık ders planını takip eder, velilere karne gönderir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/giris?demo=1" className="btn-primary px-5 py-2.5 text-base">Demo kurumu gezin</Link>
            <Link href="/kayit" className="btn-secondary px-5 py-2.5 text-base">Kurum hesabı açın</Link>
          </div>
          <p className="mt-3 text-sm text-lead">Demo hesabında örnek sınıflar, denemeler ve bir aylık yoklama hazır.</p>
        </div>
        <AnswerSheet />
      </section>

      <section className="border-t border-rule bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-3xl font-semibold">Bir haftanız</h2>
          <ol className="mt-6 divide-y divide-rule border-y border-rule">
            {WEEK.map(([when, what]) => (
              <li key={when} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <span className="font-display text-xl font-semibold [font-stretch:82%]">{when}</span>
                <span className="max-w-[68ch] text-[15px]">{what}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[68ch] text-[15px] text-lead">
            Öğretmenler soru havuzundan sınav ve çalışma kâğıdı hazırlar; kâğıt sınavlar için optik form yazdırıp telefonla okutur.
          </p>
        </div>
      </section>
    </div>
  );
}
