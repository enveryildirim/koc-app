import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/shared/db";
import { requireOwner } from "@/modules/identity/server";
import { EXAM_TYPES, fmtDate, fmtNet, parseSections, round2 } from "@/modules/exams";
import { combinedTopics } from "@/modules/exams";
import { PageHeader } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

const avg = (a: number[]) => (a.length ? round2(a.reduce((s, x) => s + x, 0) / a.length) : 0);

/** Öğrenci birleştirilmiş karnesi: bir sınav türündeki tüm denemeler, ortalamalar, gelişim ve konu eksikleri. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tur?: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const { tur } = await searchParams;
  const st = await prisma.student.findUnique({
    where: { id },
    include: { classroom: true, results: { include: { exam: true }, orderBy: { exam: { date: "asc" } } } },
  });
  if (!st || st.ownerId !== ownerId) notFound();
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } });
  const types = [...new Set(st.results.map((r) => r.exam.type))];
  const type = tur && types.includes(tur) ? tur : types[0];
  const results = st.results.filter((r) => r.exam.type === type);

  const header = (
    <PageHeader
      title="Birleştirilmiş karne"
      back={{ href: `/kurum/ogrenciler/${st.id}`, label: `${st.firstName} ${st.lastName}` }}
      actions={
        <>
          {types.map((t) => (
            <Link key={t} href={`?tur=${t}`} className={t === type ? "btn-primary" : "btn-secondary"}>{EXAM_TYPES[t]?.label ?? t}</Link>
          ))}
          <PrintButton label="🖨️ Yazdır" />
        </>
      }
    />
  );
  if (!type) return <>{header}<div className="card p-8 text-center text-sm text-slate-500">Öğrencinin deneme sonucu yok.</div></>;

  const secNames: string[] = [];
  for (const r of results) for (const s of parseSections(r.exam.sections)) if (!secNames.includes(s.name)) secNames.push(s.name);

  // Her deneme için sınıf ortalaması ve sınıf sırası
  const rows: { r: (typeof results)[number]; nets: (number | null)[]; classAvg: number; rank: number; peers: number }[] = [];
  for (const r of results) {
    const names = parseSections(r.exam.sections).map((s) => s.name);
    const stats = JSON.parse(r.stats) as { d: number; y: number; b: number; net: number }[];
    const peers = await prisma.examResult.findMany({
      where: { examId: r.examId, ...(st.classroomId ? { student: { classroomId: st.classroomId } } : {}) },
      select: { totalNet: true, score: true },
    });
    rows.push({
      r,
      nets: secNames.map((n) => (names.includes(n) ? stats[names.indexOf(n)]?.net ?? 0 : null)),
      classAvg: avg(peers.map((p) => p.totalNet)),
      rank: peers.filter((p) => p.score > r.score).length + 1,
      peers: peers.length,
    });
  }
  const topics = combinedTopics(results).sort((a, b) => a.rate - b.rate);
  const weak = topics.filter((t) => t.rate < 50);
  const strong = [...topics].reverse().filter((t) => t.rate >= 75).slice(0, 6);
  const maxNet = Math.max(...results.map((r) => parseSections(r.exam.sections).reduce((a, s) => a + s.count, 0)));

  return (
    <>
      {header}
      <article className="karne mx-auto max-w-[210mm] bg-white p-8 text-sm shadow-sm ring-1 ring-slate-200 print:p-6 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between border-b-4 border-brand-600 pb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand-600">{owner.name} · Birleştirilmiş Karne</div>
            <h1 className="text-xl font-extrabold">{st.firstName} {st.lastName}</h1>
            <div className="text-xs text-slate-500">
              No: {st.studentNo} · Sınıf: {st.classroom?.name ?? "—"} · {EXAM_TYPES[type]?.label ?? type} · {results.length} deneme
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-slate-500">Ortalama net / tahmini puan</div>
            <div className="text-2xl font-extrabold text-brand-700">{fmtNet(avg(results.map((r) => r.totalNet)))}</div>
            <div className="font-semibold">{fmtNet(avg(results.map((r) => r.score)))} puan</div>
          </div>
        </header>

        <h2 className="mt-5 mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Denemeler</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand-600 text-white">
              <th className="px-2 py-1.5 text-left">Deneme</th>
              {secNames.map((n) => (
                <th key={n} className="px-2 py-1.5 text-right">{n}</th>
              ))}
              <th className="px-2 py-1.5 text-right">Net</th>
              <th className="px-2 py-1.5 text-right">Puan</th>
              <th className="px-2 py-1.5 text-right">Sınıf ort.</th>
              <th className="px-2 py-1.5 text-right">Sınıf sırası</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.r.id} className="border-b border-slate-200 odd:bg-slate-50">
                <td className="px-2 py-1.5">
                  <b>{x.r.exam.name}</b>
                  <div className="text-[10px] text-slate-500">{fmtDate(x.r.exam.date)}</div>
                </td>
                {x.nets.map((n, j) => (
                  <td key={j} className="px-2 py-1.5 text-right tabular-nums">{n === null ? "—" : fmtNet(n)}</td>
                ))}
                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtNet(x.r.totalNet)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNet(x.r.score)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmtNet(x.classAvg)}</td>
                <td className="px-2 py-1.5 text-right">{x.rank}/{x.peers}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1.5">Ortalama</td>
              {secNames.map((_, j) => (
                <td key={j} className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNet(avg(rows.map((x) => x.nets[j]).filter((n): n is number => n !== null)))}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtNet(avg(results.map((r) => r.totalNet)))}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtNet(avg(results.map((r) => r.score)))}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtNet(avg(rows.map((x) => x.classAvg)))}</td>
              <td />
            </tr>
          </tbody>
        </table>

        {rows.length >= 2 && (
          <>
            <h2 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Net gelişimi</h2>
            <Trend values={rows.map((x) => x.r.totalNet)} classAvg={rows.map((x) => x.classAvg)} labels={rows.map((x) => x.r.exam.name)} max={maxNet} />
          </>
        )}

        {topics.length > 0 && (
          <>
            <h2 className="mt-5 mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Konu analizi (tüm denemeler)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <div className="text-xs font-bold text-red-800">Eksik konular (%50 altı)</div>
                {weak.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-600">Belirgin eksik konu yok.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {weak.slice(0, 12).map((t) => (
                      <li key={t.section + t.topic} className="flex justify-between gap-2">
                        <span>{t.topic} <span className="text-slate-500">· {t.section}</span></span>
                        <b className="text-red-700">%{t.rate}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="text-xs font-bold text-emerald-800">Güçlü konular (%75 ve üstü)</div>
                {strong.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-600">Henüz %75 üstü konu yok.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {strong.map((t) => (
                      <li key={t.section + t.topic} className="flex justify-between gap-2">
                        <span>{t.topic} <span className="text-slate-500">· {t.section}</span></span>
                        <b className="text-emerald-700">%{t.rate}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
        <p className="mt-6 border-t border-slate-200 pt-2 text-[10px] text-slate-400">Puanlar tahminidir; resmi sınav puanı değildir.</p>
      </article>
    </>
  );
}

function Trend({ values, classAvg, labels, max }: { values: number[]; classAvg: number[]; labels: string[]; max: number }) {
  const w = 600;
  const h = 150;
  const pad = 28;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (Math.max(0, v) / max) * (h - pad * 2);
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={w - pad} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" />
          <text x={4} y={y(max * f) + 3} fontSize={9} fill="#94a3b8">{Math.round(max * f)}</text>
        </g>
      ))}
      <polyline points={line(classAvg)} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" />
      <polyline points={line(values)} fill="none" stroke="#1f63dc" strokeWidth={2.5} />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={3.5} fill="#1f63dc" />
          <text x={x(i)} y={y(v) - 7} fontSize={9} textAnchor="middle" fill="#1e293b">{v.toFixed(1)}</text>
          <text x={x(i)} y={h - 8} fontSize={8} textAnchor="middle" fill="#64748b">{labels[i].slice(0, 18)}</text>
        </g>
      ))}
      <g fontSize={9}>
        <line x1={w - 170} x2={w - 155} y1={10} y2={10} stroke="#1f63dc" strokeWidth={2.5} />
        <text x={w - 150} y={13} fill="#334155">Öğrenci</text>
        <line x1={w - 100} x2={w - 85} y1={10} y2={10} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" />
        <text x={w - 80} y={13} fill="#334155">Sınıf ort.</text>
      </g>
    </svg>
  );
}
