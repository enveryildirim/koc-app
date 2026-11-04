import Link from "next/link";
import type { SectionCoverage, TopicCoverage } from "../internal/coverage";

type ClassCoverage = {
  classroomId: string;
  classroom: string;
  students: number;
  sections: SectionCoverage[];
  summary: { done: number; late: number; notYet: number; unplanned: number };
};

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

const STATUS: Record<TopicCoverage["status"], { label: string; cls: string }> = {
  done: { label: "İşlenmişti", cls: "bg-emerald-50 text-emerald-700" },
  late: { label: "Gecikmiş", cls: "bg-red-50 text-red-700" },
  notYet: { label: "Sırası gelmemişti", cls: "bg-slate-100 text-slate-600" },
  unplanned: { label: "Planda yok", cls: "bg-amber-50 text-amber-800" },
};

/** Deneme ↔ yıllık plan uyumu (sunucu bileşeni). Sınıf başına, bölüm bölüm konu durumu. */
export default function ExamPlanCoverage({ classes, examDate }: { classes: ClassCoverage[]; examDate: string }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Denemedeki her konunun, sınıfın yıllık planına göre deneme tarihinde ({fmt(examDate)}) durumu. <b>Gecikmiş</b>: planlanan haftası geçmiş ama işlenmemiş.{" "}
        <b>Sırası gelmemişti</b>: planda deneme tarihinden sonraya planlı; bu konulardaki düşük başarı beklenen bir durumdur. İşlenmiş ama düşük kalan konular tekrar gerektirir.
      </p>
      {classes.map((c) => {
        const withPlan = c.sections.filter((s) => s.plan);
        return (
          <div key={c.classroomId} className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
              <h3 className="text-lg font-semibold">{c.classroom}</h3>
              <span className="text-sm text-slate-500">{c.students} öğrenci</span>
              <div className="flex-1" />
              {withPlan.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <span className="badge bg-emerald-50 text-emerald-700">{c.summary.done} işlenmiş</span>
                  {c.summary.late > 0 && <span className="badge bg-red-50 text-red-700">{c.summary.late} gecikmiş</span>}
                  <span className="badge bg-slate-100 text-slate-600">{c.summary.notYet} sırası gelmemiş</span>
                  {c.summary.unplanned > 0 && <span className="badge bg-amber-50 text-amber-800">{c.summary.unplanned} planda yok</span>}
                </div>
              )}
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {c.sections.map((s) =>
                  !s.plan ? (
                    <tr key={s.section} className="bg-slate-50/60">
                      <td className="px-4 py-2 font-medium">{s.section}</td>
                      <td className="px-4 py-2 text-slate-500" colSpan={3}>
                        Bu ders için {c.classroom} yıllık planı yok.{" "}
                        <Link href={`/kurum/takvim/plan/yeni?sinif=${c.classroomId}&ders=${encodeURIComponent(s.section)}`} className="text-brand-700 hover:underline">
                          Plan oluştur
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    s.topics.map((t, i) => {
                      const st = STATUS[t.status];
                      return (
                        <tr key={s.section + t.topic}>
                          <td className="w-40 px-4 py-2 align-top font-medium">
                            {i === 0 && (
                              <Link href={`/kurum/takvim/plan/${s.plan!.id}`} className="hover:text-brand-700">
                                {s.section}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {t.topic}
                            {t.planTopics.length > 0 && t.planTopics.some((p) => p.toLocaleLowerCase("tr-TR") !== t.topic.toLocaleLowerCase("tr-TR")) && (
                              <div className="text-xs text-slate-400">plandaki karşılığı: {t.planTopics.join(", ")}</div>
                            )}
                          </td>
                          <td className="w-56 px-4 py-2">
                            <span className={`badge ${st.cls}`}>{st.label}</span>
                            {t.plannedWeek && <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">planda {fmt(t.plannedWeek)} haftası</div>}
                          </td>
                          <td className="w-44 px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                                <div className={`h-full ${t.rate < 50 ? "bg-red-400" : t.rate < 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${t.rate}%` }} />
                              </div>
                              <span className={`w-10 text-right text-xs font-semibold ${t.rate < 50 ? "text-red-600" : ""}`}>%{t.rate}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ),
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
