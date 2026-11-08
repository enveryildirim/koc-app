import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { ASSESSMENT_TYPES, assessmentSheet, fmtPercent, percentTone } from "@/modules/assessment/server";
import { PageHeader, th, td } from "@/shared/ui/kurum";
import ScoreEntry from "@/modules/assessment/ui/ScoreEntry";
import DeleteAssessment from "@/modules/assessment/ui/DeleteAssessment";
import { OutlierToggle, withOutliers } from "@/shared/ui/Outliers";
import { outliersOn, splitOutliers } from "@/shared/stats";

export const dynamic = "force-dynamic";

/** Değerlendirme sonucu: öğrenci × kriter tablosu, kriter ortalamaları; `?gir=1` ile puan girişi. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gir?: string; uc?: string }> }) {
  const ownerId = await requireOwner();
  const sheet = await assessmentSheet(ownerId, (await params).id);
  if (!sheet) notFound();
  const { gir, uc: ucParam } = await searchParams;
  const uc = outliersOn(ucParam) && !gir;
  const { assessment: a, course, students } = sheet;
  const allScored = students.filter((s) => s.score && !s.score.absent && s.score.percent !== null);
  // Uç değerler (düğme açıkken) ortalamaya ve kriter ortalamalarına katılmaz; tabloda işaretli kalır
  const split = splitOutliers(allScored, (s) => s.score!.percent!);
  const mark = new Map<string, "low" | "high">(uc ? [...split.low.map((s) => [s.id, "low"] as const), ...split.high.map((s) => [s.id, "high"] as const)] : []);
  const scored = allScored.filter((s) => !mark.has(s.id));
  const fullAvg = allScored.length ? allScored.reduce((p, s) => p + s.score!.percent!, 0) / allScored.length : null;
  const critAvg = a.criteria.map((c, i) => {
    const v = scored.map((s) => s.score!.scores[i]).filter((x) => typeof x === "number");
    return v.length ? (v.reduce((p, q) => p + q, 0) / v.length / c.max) * 100 : null;
  });
  const avg = scored.length ? scored.reduce((p, s) => p + s.score!.percent!, 0) / scored.length : null;
  const dateLabel = new Date(a.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <PageHeader
        title={a.title}
        sub={`${ASSESSMENT_TYPES[a.type]?.label} · ${course.name} · ${course.classroom} · ${dateLabel}${a.planTopic ? ` · Konu: ${a.planTopic}` : ""}`}
        back={{ href: "/kurum/degerlendirme", label: "Sözlü ve yazılı" }}
        actions={
          <>
            <Link href={`/kurum/degerlendirme/${a.id}/form`} className="btn-secondary">Kâğıt form</Link>
            <Link href={gir ? `/kurum/degerlendirme/${a.id}` : `/kurum/degerlendirme/${a.id}?gir=1`} className="btn-primary">{gir ? "Sonuç tablosu" : "Puan gir"}</Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card p-3"><div className="text-[12.5px] text-lead">Girilen</div><div className="num text-xl font-semibold">{students.filter((s) => s.score).length}/{students.length}</div></div>
        <div className="card p-3">
          <div className="text-[12.5px] text-lead">Ortalama</div>
          <div className={`num text-xl font-semibold ${percentTone(avg)}`}>{fmtPercent(avg)}</div>
          {mark.size > 0 && <div className="text-[11.5px] text-lead">{mark.size} ayrıldı · hepsiyle {fmtPercent(fullAvg)}</div>}
        </div>
        {a.criteria.slice(0, 2).map((c, i) => (
          <div key={c.name} className="card p-3"><div className="text-[12.5px] text-lead">{c.name} ort.</div><div className={`num text-xl font-semibold ${percentTone(critAvg[i])}`}>{fmtPercent(critAvg[i])}</div></div>
        ))}
      </div>

      {!gir && (
        <div className="flex flex-wrap items-center gap-3">
          <OutlierToggle on={uc} href={withOutliers(`/kurum/degerlendirme/${a.id}`, !uc)} />
          {uc && <span className="text-[13px] text-lead">{split.fences ? (mark.size ? "İşaretli puanlar ortalamalara katılmadı." : "Uç değer yok.") : "Puanlanan öğrenci az, ayrılmadı."}</span>}
        </div>
      )}
      {gir ? (
        <div className="max-w-2xl">
          <ScoreEntry assessmentId={a.id} criteria={a.criteria} maxTotal={a.maxTotal} students={students.map((s) => ({ id: s.id, no: s.no, name: s.name, guest: s.guest, score: s.score }))} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>No</th>
                <th className={th}>Öğrenci</th>
                {a.criteria.map((c) => (
                  <th key={c.name} className={`${th} text-right`}>{c.name} <span className="font-normal">/{c.max}</span></th>
                ))}
                <th className={`${th} text-right`}>Toplam <span className="font-normal">/{a.maxTotal}</span></th>
                <th className={`${th} text-right`}>%</th>
                <th className={th}>Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} num text-lead`}>{s.no}</td>
                  <td className={td}>
                    <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    {s.guest && <span className="text-[12.5px] text-lead"> · {s.guest}</span>}
                    {mark.has(s.id) && (
                      <span className={`ml-1.5 whitespace-nowrap text-[11px] font-semibold ${mark.get(s.id) === "low" ? "text-red-600" : "text-emerald-700"}`} title="Uç değer: ortalamaya katılmadı">
                        {mark.get(s.id) === "low" ? "uç ↓" : "uç ↑"}
                      </span>
                    )}
                  </td>
                  {s.score?.absent ? (
                    <td className={`${td} text-lead`} colSpan={a.criteria.length + 2}>Gelmedi</td>
                  ) : (
                    <>
                      {a.criteria.map((c, i) => (
                        <td key={c.name} className={`${td} num text-right`}>{s.score?.scores[i] ?? "—"}</td>
                      ))}
                      <td className={`${td} num text-right font-semibold`}>{s.score?.total ?? "—"}</td>
                      <td className={`${td} num text-right font-semibold ${percentTone(s.score?.percent)}`}>{fmtPercent(s.score?.percent)}</td>
                    </>
                  )}
                  <td className={`${td} text-lead`}>{s.score?.note}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-paper">
              <tr>
                <td className={td} colSpan={2}>Kriter ortalaması</td>
                {critAvg.map((v, i) => (
                  <td key={i} className={`${td} num text-right font-semibold ${percentTone(v)}`}>{fmtPercent(v)}</td>
                ))}
                <td className={td} />
                <td className={`${td} num text-right font-semibold ${percentTone(avg)}`}>{fmtPercent(avg)}</td>
                <td className={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="text-right"><DeleteAssessment id={a.id} backHref="/kurum/degerlendirme" /></div>
    </div>
  );
}
