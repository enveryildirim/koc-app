import Link from "next/link";
import { ASSESSMENT_TYPES, fmtPercent, percentTone } from "../index";

type Item = { id: string; date: string; title: string; type: string; course: string; classroom: string; scored: number; absent: number; avg: number | null; planTopic: string };

const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** Değerlendirme listesi (telefon ve masaüstü): tarih, ders, sınıf, girilen sayı ve ortalama. */
export default function AssessmentList({ items, hrefBase, empty }: { items: Item[]; hrefBase: string; empty: string }) {
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
            <span className={`num shrink-0 font-semibold ${percentTone(a.avg)}`}>{fmtPercent(a.avg)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
