import { EXAM_TYPES, fmtDate, fmtNet, topicStats } from "../domain";
import type { ExamReport as Report } from "../internal/results";

type Row = Report["rows"][number];

/** Yazdırılabilir öğrenci karnesi (A4). */
export default function Karne({ report, row }: { report: Report; row: Row }) {
  const { exam, secs, general } = report;
  const cls = report.classAvg.get(row.classId);
  const classSize = cls?.size ?? 0;
  let offset = 0;
  const errors = secs.map((s) => {
    const start = offset;
    offset += s.count;
    const key = row.booklet === "B" ? s.keyB || s.keyA : s.keyA;
    const list: { q: number; given: string; correct: string }[] = [];
    for (let i = 0; i < s.count; i++) {
      const a = row.answers[start + i] ?? " ";
      if (a !== key[i]) list.push({ q: i + 1, given: a === " " ? "–" : a === "*" ? "Çift" : a, correct: key[i] ?? "?" });
    }
    return list;
  });
  const total = secs.reduce((a, s) => ({ q: a.q + s.count, d: a.d, y: a.y, b: a.b }), { q: 0, d: 0, y: 0, b: 0 });
  row.stats.forEach((s) => {
    total.d += s.d;
    total.y += s.y;
    total.b += s.b;
  });
  const maxSection = Math.max(...secs.map((s) => s.count));
  // Konu başarısı: öğrenci vs kurum
  const myTopics = topicStats(secs, [row]);
  const allTopics = new Map(topicStats(secs, report.rows).map((t) => [t.section + "|" + t.topic, t.rate]));
  const topicsBySection = secs
    .map((s) => ({ name: s.name, list: myTopics.filter((t) => t.section === s.name && t.total > 0) }))
    .filter((x) => x.list.length > 0);
  const weakTopics = myTopics.filter((t) => t.total > 0 && t.rate < 50).sort((a, b) => a.rate - b.rate);

  return (
    <article className="karne mx-auto max-w-[210mm] bg-white p-8 text-sm shadow-sm ring-1 ring-rule print:p-6 print:shadow-none print:ring-0">
      <header className="flex items-start justify-between border-b-4 border-brand-600 pb-3">
        <div>
          <div className="text-xs font-bold tracking-widest text-brand-600">SınavKur · Öğrenci Karnesi</div>
          <h1 className="text-xl font-extrabold">{exam.name}</h1>
          <div className="text-xs text-lead">
            {EXAM_TYPES[exam.type]?.label ?? exam.type} · {fmtDate(exam.date)} · {exam.wrongPer ? `${exam.wrongPer} yanlış 1 doğruyu götürür` : "yanlış götürmez"}
          </div>
        </div>
        <table className="text-xs">
          <tbody>
            <tr><td className="pr-2 text-lead">Ad Soyad</td><td className="font-bold">{row.name}</td></tr>
            <tr><td className="pr-2 text-lead">Numara</td><td className="num">{row.studentNo}</td></tr>
            <tr><td className="pr-2 text-lead">Sınıf</td><td>{row.className}</td></tr>
            <tr><td className="pr-2 text-lead">Kitapçık</td><td>{row.booklet}</td></tr>
          </tbody>
        </table>
      </header>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center">
        <Box label="Toplam net" value={fmtNet(row.totalNet)} big />
        <Box label="Tahmini puan" value={fmtNet(row.score)} big />
        <Box label="Sınıf sırası" value={`${row.classRank} / ${classSize}`} />
        <Box label={`Kurum sırası · ilk %${row.percentile}`} value={`${row.rank} / ${general.n}`} />
      </div>

      <h2 className="mt-5 mb-1 text-xs font-bold text-lead">Ders analizi</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-graphite text-white">
            {["Ders", "Soru", "Doğru", "Yanlış", "Boş", "Net", "Sınıf ort.", "Kurum ort."].map((h, i) => (
              <th key={h} className={`px-2 py-1.5 ${i ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {secs.map((s, i) => {
            const st = row.stats[i];
            return (
              <tr key={s.name} className="border-b border-rule odd:bg-paper">
                <td className="px-2 py-1.5 font-semibold">{s.name}</td>
                <td className="px-2 py-1.5 text-right">{s.count}</td>
                <td className="px-2 py-1.5 text-right text-emerald-700">{st.d}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{st.y}</td>
                <td className="px-2 py-1.5 text-right text-lead">{st.b}</td>
                <td className="px-2 py-1.5 text-right font-bold">{fmtNet(st.net)}</td>
                <td className="px-2 py-1.5 text-right">{fmtNet(cls?.sections[i] ?? 0)}</td>
                <td className="px-2 py-1.5 text-right">{fmtNet(general.sections[i])}</td>
              </tr>
            );
          })}
          <tr className="bg-mist font-bold">
            <td className="px-2 py-1.5">Toplam</td>
            <td className="px-2 py-1.5 text-right">{total.q}</td>
            <td className="px-2 py-1.5 text-right">{total.d}</td>
            <td className="px-2 py-1.5 text-right">{total.y}</td>
            <td className="px-2 py-1.5 text-right">{total.b}</td>
            <td className="px-2 py-1.5 text-right">{fmtNet(row.totalNet)}</td>
            <td className="px-2 py-1.5 text-right">{fmtNet(cls?.total ?? 0)}</td>
            <td className="px-2 py-1.5 text-right">{fmtNet(general.total)}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-5 mb-2 text-xs font-bold text-lead">Net karşılaştırma</h2>
      <div className="space-y-1.5">
        {secs.map((s, i) => (
          <div key={s.name} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs">
            <span className="truncate">{s.name}</span>
            <div className="space-y-0.5">
              <Bar value={row.stats[i].net} max={maxSection} cls="bg-graphite" label={fmtNet(row.stats[i].net)} />
              <Bar value={general.sections[i]} max={maxSection} cls="bg-slate-300" label={fmtNet(general.sections[i])} />
            </div>
          </div>
        ))}
        <div className="flex gap-4 pt-1 text-[10px] text-lead">
          <span><i className="mr-1 inline-block h-2 w-3 bg-graphite" />Öğrenci</span>
          <span><i className="mr-1 inline-block h-2 w-3 bg-slate-300" />Kurum ortalaması</span>
        </div>
      </div>

      <h2 className="mt-5 mb-1 text-xs font-bold text-lead">Hata karnesi (yanlış ve boş sorular)</h2>
      <div className="space-y-1.5 text-xs">
        {secs.map((s, i) => (
          <div key={s.name} className="grid grid-cols-[120px_1fr] gap-2">
            <span className="font-semibold">{s.name}</span>
            <div className="flex flex-wrap gap-1">
              {errors[i].length === 0 ? (
                <span className="text-emerald-700">Hepsi doğru 🎉</span>
              ) : (
                errors[i].map((e) => (
                  <span key={e.q} className={`rounded px-1.5 py-0.5 ${e.given === "–" ? "bg-mist text-lead" : "bg-red-50 text-red-700"}`}>
                    {e.q}: {e.given}→{e.correct}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
        <p className="pt-1 text-[10px] text-lead/70">Biçim: soru no: verdiğiniz cevap → doğru cevap (– boş)</p>
      </div>

      {topicsBySection.length > 0 && (
        <>
          <h2 className="mt-5 mb-1 text-xs font-bold text-lead">Konu başarısı</h2>
          {weakTopics.length > 0 && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
              <b>Öncelikli çalışılması gereken konular:</b> {weakTopics.slice(0, 6).map((t) => `${t.topic} (%${t.rate})`).join(", ")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {topicsBySection.map((sec) => (
              <div key={sec.name} className="break-inside-avoid">
                <div className="mt-1 font-semibold">{sec.name}</div>
                {sec.list.map((t) => {
                  const k = allTopics.get(t.section + "|" + t.topic) ?? 0;
                  return (
                    <div key={t.topic} className="grid grid-cols-[1fr_70px_34px] items-center gap-2">
                      <span className="truncate">{t.topic}</span>
                      <div className="relative h-2 rounded bg-mist">
                        <div className={`h-full rounded ${t.rate < 50 ? "bg-red-400" : t.rate < 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${t.rate}%` }} />
                        <div className="absolute top-[-2px] h-3 w-0.5 bg-slate-700" style={{ left: `${k}%` }} />
                      </div>
                      <span className="text-right tabular-nums">%{t.rate}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="pt-1 text-[10px] text-lead/70">Çubuk: konudaki doğru oranı · siyah çizgi: kurum ortalaması</p>
        </>
      )}
    </article>
  );
}

function Box({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="border-t-2 border-graphite pt-1.5 pb-1">
      <div className={`num font-display font-semibold [font-stretch:85%] ${big ? "text-2xl" : "text-lg"}`}>{value}</div>
      <div className="text-[10px] text-lead">{label}</div>
    </div>
  );
}

function Bar({ value, max, cls, label }: { value: number; max: number; cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-2.5 flex-1 rounded bg-mist">
        <div className={`h-full rounded ${cls}`} style={{ width: `${Math.max(0, (value / max) * 100)}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums text-[10px]">{label}</span>
    </div>
  );
}
