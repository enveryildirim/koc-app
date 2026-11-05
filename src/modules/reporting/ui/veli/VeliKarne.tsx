import { EXAM_TYPES, fmtDate, fmtNet } from "@/modules/exams";
import { ATTENDANCE } from "@/modules/schedule";
import { HOMEWORK } from "@/modules/homework";
import type { ParentReport } from "../../internal/parentReport";

/** Veliye gösterilen dönem karnesi (deneme + ödev + devam). Hem herkese açık sayfada hem kurum önizlemesinde kullanılır. */
export default function VeliKarne({ r }: { r: ParentReport }) {
  const last = r.exams[r.exams.length - 1];
  const prev = r.exams.filter((e) => e.type === last?.type).slice(-2)[0];
  const trend = last && prev && prev !== last ? last.totalNet - prev.totalNet : null;

  return (
    <article className="karne mx-auto max-w-[210mm] bg-white p-6 text-sm shadow-sm ring-1 ring-rule sm:p-8 print:p-6 print:shadow-none print:ring-0">
      <header className="border-b-4 border-brand-600 pb-3">
        <div className="text-xs font-bold tracking-widest text-brand-600">{r.institution} · Veli Bilgilendirme Karnesi</div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold">{r.student.name}</h1>
            <div className="text-xs text-lead">
              No: {r.student.studentNo} · Sınıf: {r.student.className}
              {r.student.parentName && ` · Sayın ${r.student.parentName}`}
            </div>
          </div>
          <div className="text-right text-xs text-lead">
            Dönem
            <div className="font-semibold text-graphite">{fmtDate(r.period.from)} – {fmtDate(r.period.to)}</div>
          </div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:gap-3">
        <Box
          label="Son deneme neti"
          value={last ? fmtNet(last.totalNet) : "—"}
          hint={last ? (trend === null ? last.name : `${trend >= 0 ? "▲" : "▼"} ${fmtNet(Math.abs(trend))} önceki denemeye göre`) : "Bu dönemde deneme yok"}
          tone={trend === null ? "brand" : trend >= 0 ? "good" : "bad"}
        />
        <Box
          label="Derse devam"
          value={r.attendance.rate === null ? "—" : `%${r.attendance.rate}`}
          hint={`${r.attendance.counts.ABSENT} ders gelmedi · ${r.attendance.counts.LATE} geç`}
          tone={r.attendance.rate === null ? "brand" : r.attendance.rate >= 90 ? "good" : r.attendance.rate >= 80 ? "warn" : "bad"}
        />
        <Box
          label="Ödev yapma"
          value={r.homework.rate === null ? "—" : `%${r.homework.rate}`}
          hint={`${r.homework.counts.DONE} yaptı · ${r.homework.counts.PARTIAL} eksik · ${r.homework.counts.NOT_DONE} yapmadı`}
          tone={r.homework.rate === null ? "brand" : r.homework.rate >= 80 ? "good" : r.homework.rate >= 60 ? "warn" : "bad"}
        />
      </div>

      {r.student.note && (
        <section className="mt-5 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="text-xs font-bold text-amber-800">Öğretmen görüşü</h2>
          <p className="mt-1 whitespace-pre-line text-graphite">{r.student.note}</p>
        </section>
      )}

      {r.upcoming.length > 0 && (
        <Section title="Yaklaşanlar (30 gün)">
          <ul className="divide-y divide-rule/70 text-xs">
            {r.upcoming.map((u) => (
              <li key={u.key} className="flex items-start gap-3 py-1.5">
                <span className="w-28 shrink-0 font-medium">
                  {fmtDate(u.start)}
                  {u.end !== u.start && ` – ${fmtDate(u.end)}`}
                </span>
                <span className={`badge shrink-0 ${UPCOMING[u.kind]?.cls ?? "bg-mist text-graphite/90"}`}>{UPCOMING[u.kind]?.label ?? "Etkinlik"}</span>
                <span>
                  {u.title}
                  {u.note && <span className="block text-lead">{u.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Deneme sınavları">
        {r.exams.length === 0 ? (
          <Muted>Bu dönemde girilen deneme yok.</Muted>
        ) : (
          <div className="space-y-4">
            {r.exams.map((e) => (
              <div key={e.id} className="overflow-hidden rounded-lg ring-1 ring-rule">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-3 py-2">
                  <div>
                    <b>{e.name}</b>
                    <span className="ml-2 text-xs text-lead">{EXAM_TYPES[e.type]?.label ?? e.type} · {fmtDate(e.date)}</span>
                  </div>
                  <div className="text-xs">
                    Net <b className="text-base text-brand-700">{fmtNet(e.totalNet)}</b>
                    <span className="text-lead"> / {e.maxNet}</span>
                    <span className="ml-3">Tahmini puan <b>{fmtNet(e.score)}</b></span>
                    <span className="ml-3 text-lead">Sınıf ort. {fmtNet(e.classAvg)}</span>
                    <span className="ml-3 font-semibold">Sınıf sırası {e.rank}/{e.peers}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-lead">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Ders</th>
                        <th className="px-2 py-1.5 text-right font-medium">D</th>
                        <th className="px-2 py-1.5 text-right font-medium">Y</th>
                        <th className="px-2 py-1.5 text-right font-medium">B</th>
                        <th className="px-2 py-1.5 text-right font-medium">Net</th>
                        <th className="px-2 py-1.5 text-right font-medium">Sınıf ort.</th>
                        <th className="w-1/3 px-3 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule/70">
                      {e.sections.map((s) => (
                        <tr key={s.name}>
                          <td className="px-3 py-1.5">{s.name}</td>
                          <td className="px-2 py-1.5 text-right text-emerald-700">{s.d}</td>
                          <td className="px-2 py-1.5 text-right text-red-600">{s.y}</td>
                          <td className="px-2 py-1.5 text-right text-lead/70">{s.b}</td>
                          <td className="px-2 py-1.5 text-right font-bold">{fmtNet(s.net)}</td>
                          <td className="px-2 py-1.5 text-right text-lead">{fmtNet(s.classAvg)}</td>
                          <td className="px-3 py-1.5">
                            <div className="relative h-2 rounded bg-mist">
                              <div className={`h-full rounded ${s.net >= s.classAvg ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.max(0, (s.net / s.count) * 100)}%` }} />
                              <div className="absolute top-[-2px] h-3 w-0.5 bg-slate-700" style={{ left: `${Math.max(0, (s.classAvg / s.count) * 100)}%` }} title="Sınıf ortalaması" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-lead/70">Çubuk: dersteki net / soru sayısı · siyah çizgi: sınıf ortalaması · yeşil: ortalamanın üstü</p>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Section title="Ödevler">
          {r.homework.list.length === 0 ? (
            <Muted>Bu dönemde ödev yok.</Muted>
          ) : (
            <ul className="divide-y divide-rule/70 text-xs">
              {r.homework.list.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-2 py-1.5">
                  <span>
                    <b className="font-medium">{h.title}</b>
                    <span className="block text-lead">{h.subject} · teslim {fmtDate(h.due)}{h.note && ` · ${h.note}`}</span>
                  </span>
                  <span className={`badge shrink-0 ${HOMEWORK[h.status]?.cls}`}>{HOMEWORK[h.status]?.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Devamsızlık">
          {r.attendance.total === 0 ? (
            <Muted>Bu dönemde yoklama kaydı yok.</Muted>
          ) : r.attendance.list.length === 0 ? (
            <p className="text-xs text-emerald-700">{r.attendance.total} dersin tamamına zamanında katıldı. </p>
          ) : (
            <ul className="divide-y divide-rule/70 text-xs">
              {r.attendance.list.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 py-1.5">
                  <span>
                    <b className="font-medium">{fmtDate(a.date)}</b> · {a.time}
                    <span className="block text-lead">{a.subject} · {a.teacher}</span>
                  </span>
                  <span className={`badge shrink-0 ${ATTENDANCE[a.status]?.cls}`}>{ATTENDANCE[a.status]?.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <footer className="mt-6 border-t border-rule pt-3 text-[10px] text-lead/70">
        Bu karne {r.institution} tarafından paylaşılmıştır. Sorularınız için kurumla iletişime geçebilirsiniz.
      </footer>
    </article>
  );
}

const UPCOMING: Record<string, { label: string; cls: string }> = {
  HOLIDAY: { label: "Tatil", cls: "bg-red-50 text-red-700" },
  EXAM: { label: "Sınav", cls: "bg-indigo-50 text-indigo-700" },
  DENEME: { label: "Deneme", cls: "bg-violet-50 text-violet-700" },
  MEETING: { label: "Toplantı", cls: "bg-sky-50 text-sky-700" },
  EVENT: { label: "Etkinlik", cls: "bg-emerald-50 text-emerald-700" },
  ODEV: { label: "Ödev teslimi", cls: "bg-amber-50 text-amber-800" },
  OTHER: { label: "Duyuru", cls: "bg-mist text-graphite/90" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold text-lead">{title}</h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-lead">{children}</p>;
}

const TONES = {
  brand: "bg-paper text-graphite",
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
};

function Box({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-lg px-1 py-2 ${TONES[tone]}`}>
      <div className="text-xl font-extrabold sm:text-2xl">{value}</div>
      <div className="text-[10px] font-semibold">{label}</div>
      <div className="mt-0.5 text-[10px] opacity-80">{hint}</div>
    </div>
  );
}
