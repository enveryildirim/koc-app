import Link from "next/link";
import { ASSESSMENT_TYPES, fmtPercent, percentTone } from "../index";

type Item = { id: string; date: string; title: string; type: string; course: string; percent: number | null; absent: boolean; note: string };

/**
 * Öğrencinin sözlü / yazılı / uygulama notları, derslere göre: ortalama, son iki notun yönü ve son değerlendirmeler.
 * Yön: son not öncekinden 10 puan (yüzde) ya da daha fazla düşükse "düşüşte".
 */
export default function StudentAssessments({ items, hrefBase }: { items: Item[]; hrefBase: string }) {
  if (!items.length) return null;
  const byCourse = new Map<string, Item[]>();
  for (const i of items) byCourse.set(i.course, [...(byCourse.get(i.course) ?? []), i]);
  const rows = [...byCourse].map(([course, list]) => {
    const scored = list.filter((x) => !x.absent && x.percent !== null);
    const avg = scored.length ? scored.reduce((s, x) => s + x.percent!, 0) / scored.length : null;
    const trend = scored.length >= 2 ? scored[0].percent! - scored[1].percent! : null;
    return { course, avg, trend, count: list.length, absent: list.filter((x) => x.absent).length, last: list.slice(0, 3) };
  }).sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));

  return (
    <section className="card">
      <h2 className="border-b border-rule/70 px-4 py-3 font-semibold">Sözlü ve yazılı <span className="text-xs font-normal text-lead">(en düşük ortalama üstte)</span></h2>
      <ul className="divide-y divide-rule/70">
        {rows.map((r) => (
          <li key={r.course} className="px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{r.course}</span>
              <span className="text-[12.5px] text-lead">{r.count} değerlendirme{r.absent ? `, ${r.absent} gelmedi` : ""}</span>
              {r.trend !== null && r.trend <= -10 && <span className="badge bg-red-50 text-red-700">düşüşte</span>}
              <span className={`num ml-auto font-semibold ${percentTone(r.avg)}`}>{fmtPercent(r.avg)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-lead">
              {r.last.map((x) => (
                <Link key={x.id} href={`${hrefBase}/${x.id}`} className="hover:underline">
                  {new Date(x.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} {ASSESSMENT_TYPES[x.type]?.short}:{" "}
                  <span className={`num ${percentTone(x.percent)}`}>{x.absent ? "gelmedi" : fmtPercent(x.percent)}</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
