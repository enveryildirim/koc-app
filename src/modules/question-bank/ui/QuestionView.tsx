import { Fragment } from "react";
import { BLANK_RE, EMPHASIS_RE, OPTION_LETTERS, textDir, type QuestionContent } from "../written";

/**
 * Yazılan sorunun görünümü: ekranda (havuz, önizleme, deneme kurma) ve kitapçıkta aynı düzen.
 * Hook kullanmaz; hem sunucu hem istemci bileşeninde kullanılabilir.
 * Yazı yönü satır satır harf çoğunluğuyla seçilir (textDir): Arapça satır sağdan sola, Türkçe satır soldan sağa akar.
 */
export default function QuestionView({
  type,
  content,
  imageSrc,
  answer,
  print = false,
  optical = false,
  compact = false,
  narrow = false,
}: {
  type: string;
  content: QuestionContent;
  /** Görsel varsa adresi */
  imageSrc?: string | null;
  /** Verilirse doğru şık / D-Y vurgulanır (ekranda) */
  answer?: string;
  /** Kitapçık: açık uçluya cevap alanı bırakılır */
  print?: boolean;
  /** Optik formlu sınav: D/Y "A) Doğru B) Yanlış" olarak basılır */
  optical?: boolean;
  /** Küçük önizleme (deneme kurma ekranındaki kartlar) */
  compact?: boolean;
  /** Dar sütun (iki sütunlu kitapçık): şıklar daha erken ikili / alt alta dizilir, sözcük ortadan bölünmesin */
  narrow?: boolean;
}) {
  const options = content.options ?? [];
  const longest = Math.max(0, ...options.map((o) => o.length));
  const [wide, mid] = narrow ? [5, 16] : [14, 34];
  const cols = longest <= wide ? Math.min(options.length, 5) : longest <= mid ? 2 : 1;
  const mark = (letter: string) => !!answer && answer === letter;
  const tf: [string, string, string][] = optical ? [["A", "Doğru", "D"], ["B", "Yanlış", "Y"]] : [["", "Doğru", "D"], ["", "Yanlış", "Y"]];

  return (
    <div className={compact ? "text-[11.5px] leading-snug" : "text-[14px] leading-relaxed"}>
      {content.stem && (
        <div className="break-words whitespace-pre-wrap">
          {content.stem.split("\n").map((line, i) => (
            <p key={i} dir={textDir(line)} className={line ? "" : "h-[1em]"}>
              <Stem text={line} />
            </p>
          ))}
        </div>
      )}
      {imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel
        <img src={imageSrc} alt="" loading="lazy" className={`my-1.5 block h-auto max-w-full ${compact ? "max-h-24" : print ? "max-h-[90mm]" : "max-h-64"}`} />
      )}
      {type === "MC" && options.length > 0 && (
        <ol className="mt-1 grid gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {options.map((o, i) => {
            const l = OPTION_LETTERS[i];
            return (
              <li key={i} className={`flex min-w-0 gap-1 ${mark(l) ? "font-semibold text-emerald-800" : ""}`}>
                <b className="shrink-0">{l})</b>
                <span dir={textDir(o)} className="min-w-0 break-words"><Emphasis text={o} /></span>
              </li>
            );
          })}
        </ol>
      )}
      {type === "TF" && (
        <div className="mt-1 flex gap-6">
          {tf.map(([l, label, v]) => (
            <span key={v} className={mark(v) ? "font-semibold text-emerald-800" : ""}>
              {l ? <b>{l})</b> : <span className="mr-1 inline-block w-6 text-center">(&nbsp;&nbsp;)</span>} {label}
            </span>
          ))}
        </div>
      )}
      {type === "OPEN" && print && <div aria-hidden="true" className="mt-1 h-[32mm]" />}
    </div>
  );
}

/** Kökteki boşluk işaretlerini (___, .....) yazılabilir çizgiye, **…** vurgusunu kalına çevirir. */
function Stem({ text }: { text: string }) {
  const parts = text.split(BLANK_RE);
  if (parts.length === 1) return <Emphasis text={text} />;
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          <Emphasis text={p} />
          {i < parts.length - 1 && <span className="mx-0.5 inline-block w-[22mm] max-w-full translate-y-[2px] border-b border-current align-baseline" />}
        </Fragment>
      ))}
    </>
  );
}

/** **…** arasını kalın yazar (eşi olmayan yıldızlar olduğu gibi kalır). */
function Emphasis({ text }: { text: string }) {
  const parts = text.split(new RegExp(EMPHASIS_RE.source));
  if (parts.length === 1) return <>{text}</>;
  // split yakalama grubuyla: çift indeksler düz, tek indeksler vurgulu
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="font-bold">{p}</b> : <Fragment key={i}>{p}</Fragment>))}</>;
}

