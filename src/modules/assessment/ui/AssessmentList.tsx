import Link from "next/link";
import { ASSESSMENT_TYPES, fmtPercent, percentTone } from "../index";

type Item = { id: string; date: string; title: string; type: string; course: string; classroom: string; scored: number; absent: number; avg: number | null; planTopic: string; trimmedAvg?: number | null; removed?: number };

const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/**
 * Değerlendirme listesi (telefon ve masaüstü): tarih, ders, sınıf, girilen sayı ve ortalama.
 * `trim`: uç değerler ayrılmış ortalama gösterilir (yönetici sayfasındaki düğme).
 */
export default function AssessmentList({ items, hrefBase, empty, trim = false }: { items: Item[]; hrefBase: string; empty: string; trim?: boolean }) {
  if (!items.length) return <div className="card px-4 py-6 text-center text-sm text-lead">{empty}</div>;
  return (
    <ul className="card divide-y divide-rule/70">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`${hrefBase}/${a.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-paper active:bg-paper">
            <span className="num w-12 shrink-0 text-[13px] text-lead">{day(a.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.title}</span>
              <span className="block truncate text-[13px] text-lead">
                {ASSESSMENT_TYPES[a.type]?.short ?? a.type} · {a.course} · {a.classroom} · {a.scored} puan{a.absent ? `, ${a.absent} gelmedi` : ""}
              </span>
            </span>
            {(() => {
              const v = trim ? (a.trimmedAvg ?? a.avg) : a.avg;
              const removed = trim ? (a.removed ?? 0) : 0;
              return (
                <span className={`num shrink-0 text-right font-semibold ${percentTone(v)}`}>
                  {fmtPercent(v)}
                  {removed > 0 && <span className="block text-[11px] font-normal text-lead">{removed} ayrıldı</span>}
                </span>
              );
            })()}
          </Link>
        </li>
      ))}
    </ul>
  );
}
