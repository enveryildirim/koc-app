import Link from "next/link";
import { classroomsOf, listStudents } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { examResults, listExams } from "@/modules/exams/server";
import { EXAM_TYPES, fmtDate, fmtNet, round2 } from "@/modules/exams";
import { Empty, PageHeader, Tabs, th, td } from "@/shared/ui/kurum";
import ExportButton from "@/shared/ui/ExportButton";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; tur?: string; sinav?: string | string[]; sinif?: string }>;

const avg = (a: number[]) => (a.length ? round2(a.reduce((s, x) => s + x, 0) / a.length) : 0);

/** Birden fazla denemeyi birlikte değerlendiren raporlar. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const tab = sp.tab === "sinif" ? "sinif" : "secili";
  const allExams = await listExams(ownerId, "asc");
  const types = [...new Set(allExams.map((e) => e.type))];
  const tur = sp.tur && types.includes(sp.tur) ? sp.tur : types[0];
  const exams = allExams.filter((e) => e.type === tur);
  const picked = ([] as string[]).concat(sp.sinav ?? []).filter((id) => exams.some((e) => e.id === id));
  const selected = picked.length ? exams.filter((e) => picked.includes(e.id)) : exams;
  const classes = await classroomsOf(ownerId);
  const sinif = sp.sinif ?? "";

  const q = (p: Record<string, string | string[]>) => {
    const u = new URLSearchParams();
    const all = { tab, tur: tur ?? "", ...(sinif ? { sinif } : {}), ...p };
    for (const [k, v] of Object.entries(all)) ([] as string[]).concat(v).forEach((x) => x && u.append(k, x));
    return `/kurum/denemeler/birlesik?${u}`;
  };

  const tabs = [
    { key: "secili", label: "Seçili sınavlar ortalaması", href: q({ tab: "secili" }) },
    { key: "sinif", label: "Sınıf birleştirilmiş karne", href: q({ tab: "sinif" }) },
  ];
  const header = (
    <>
      <PageHeader
        title="Birleştirilmiş raporlar"
        sub="Aynı türdeki birden fazla denemeyi birlikte değerlendirin. Puanlar tahminidir."
        back={{ href: "/kurum/denemeler", label: "Denemeler" }}
        actions={<PrintButton />}
      />
      <Tabs tabs={tabs} active={tab} />
    </>
  );
  if (!tur || exams.length === 0) return <>{header}<Empty>Henüz deneme yok.</Empty></>;

  // Bölüm adları (sıralı birleşim)
  const sectionNames: string[] = [];
  for (const e of selected) for (const s of e.secs) if (!sectionNames.includes(s.name)) sectionNames.push(s.name);

  const results = await examResults(ownerId, selected.map((e) => e.id));
  const secIndex = new Map(selected.map((e) => [e.id, e.secs.map((s) => s.name)]));
  const netsOf = (r: (typeof results)[number]) => {
    const st = JSON.parse(r.stats) as { net: number }[];
    const names = secIndex.get(r.examId)!;
    return sectionNames.map((n) => {
      const i = names.indexOf(n);
      return i >= 0 ? st[i]?.net ?? 0 : null;
    });
  };

  const filters = (
    <form className="no-print card mb-4 space-y-3 p-4" action="/kurum/denemeler/birlesik">
      <input type="hidden" name="tab" value={tab} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Sınav türü</label>
          <select name="tur" defaultValue={tur} className="input w-auto">
            {types.map((t) => (
              <option key={t} value={t}>{EXAM_TYPES[t]?.label ?? t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sınıf</label>
          <select name="sinif" defaultValue={sinif} className="input w-auto">
            {tab === "secili" && <option value="">Tüm sınıflar</option>}
            {tab === "sinif" && <option value="">— Sınıf seçin —</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Uygula</button>
      </div>
      <div>
        <div className="label">Dahil edilecek denemeler {picked.length === 0 && <span className="font-normal text-lead">(seçim yoksa hepsi)</span>}</div>
        <div className="flex flex-wrap gap-2">
          {exams.map((e) => (
            <label key={e.id} className="flex items-center gap-1.5 rounded-lg bg-paper px-3 py-1.5 text-sm ring-1 ring-rule">
              <input type="checkbox" name="sinav" value={e.id} defaultChecked={picked.includes(e.id)} className="accent-brand-600" />
              {e.name} <span className="text-xs text-lead/70">{fmtDate(e.date)}</span>
            </label>
          ))}
        </div>
      </div>
    </form>
  );

  /* ------------------------- Seçili sınavlar ortalaması ------------------------- */
  if (tab === "secili") {
    const byStudent = new Map<string, (typeof results)[number][]>();
    for (const r of results) {
      if (sinif && r.student.classroomId !== sinif) continue;
      byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
    }
    const rows = [...byStudent.values()]
      .map((list) => {
        const st = list[0].student;
        const nets = list.map(netsOf);
        return {
          id: st.id,
          no: st.studentNo,
          name: `${st.firstName} ${st.lastName}`,
          cls: st.classroom?.name ?? (st.external ? "Kurum dışı" : "—"),
          count: list.length,
          sections: sectionNames.map((_, i) => avg(nets.map((n) => n[i]).filter((x): x is number => x !== null))),
          net: avg(list.map((r) => r.totalNet)),
          score: avg(list.map((r) => r.score)),
        };
      })
      .sort((a, b) => b.score - a.score || b.net - a.net);
    return (
      <>
        {header}
        {filters}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-lead">
            {selected.length} deneme · {rows.length} öğrenci. Ortalamalar öğrencinin girdiği denemeler üzerinden hesaplanır.
          </p>
          <ExportButton
            fileName={`Seçili sınavlar ortalaması - ${tur}`}
            headers={["Sıra", "No", "Ad Soyad", "Sınıf", "Girdiği", ...sectionNames.map((n) => `${n} ort. net`), "Ort. net", "Ort. puan"]}
            rows={rows.map((r, i) => [i + 1, r.no, r.name, r.cls, r.count, ...r.sections, r.net, r.score])}
          />
        </div>
        {rows.length === 0 ? (
          <Empty>Seçimle eşleşen sonuç yok.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-paper">
                <tr>
                  <th className={th}>Sıra</th>
                  <th className={th}>No</th>
                  <th className={th}>Ad Soyad</th>
                  <th className={th}>Sınıf</th>
                  <th className={`${th} text-right`}>Girdiği</th>
                  {sectionNames.map((n) => (
                    <th key={n} className={`${th} text-right`}>{n}</th>
                  ))}
                  <th className={`${th} text-right`}>Ort. net</th>
                  <th className={`${th} text-right`}>Ort. puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-paper">
                    <td className={`${td} font-bold`}>{i + 1}</td>
                    <td className={`${td} num`}>{r.no}</td>
                    <td className={td}>
                      <Link className="font-medium hover:text-brand-600" href={`/kurum/ogrenciler/${r.id}/birlesik?tur=${tur}`}>{r.name}</Link>
                    </td>
                    <td className={td}>{r.cls}</td>
                    <td className={`${td} text-right ${r.count < selected.length ? "text-amber-600" : ""}`}>{r.count}/{selected.length}</td>
                    {r.sections.map((v, j) => (
                      <td key={j} className={`${td} text-right tabular-nums`}>{fmtNet(v)}</td>
                    ))}
                    <td className={`${td} text-right text-sm font-bold tabular-nums`}>{fmtNet(r.net)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtNet(r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  /* ------------------------- Sınıf birleştirilmiş karne ------------------------- */
  const cls = classes.find((c) => c.id === sinif);
  if (!cls) return <>{header}{filters}<Empty>Bir sınıf seçin.</Empty></>;

  const perExam = selected.map((e) => {
    const all = results.filter((r) => r.examId === e.id);
    const mine = all.filter((r) => r.student.classroomId === cls.id);
    const nets = mine.map(netsOf);
    return {
      exam: e,
      n: mine.length,
      sections: sectionNames.map((_, i) => avg(nets.map((x) => x[i]).filter((x): x is number => x !== null))),
      net: avg(mine.map((r) => r.totalNet)),
      score: avg(mine.map((r) => r.score)),
      kurumNet: avg(all.map((r) => r.totalNet)),
    };
  });
  const students = await listStudents(ownerId, { classroomId: cls.id }, "number");
  const matrix = students
    .map((st) => {
      const nets = selected.map((e) => results.find((r) => r.examId === e.id && r.studentId === st.id)?.totalNet ?? null);
      const taken = nets.filter((x): x is number => x !== null);
      return { st, nets, avg: avg(taken), trend: taken.length >= 2 ? round2(taken[taken.length - 1] - taken[0]) : null };
    })
    .sort((a, b) => b.avg - a.avg);

  return (
    <>
      {header}
      {filters}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{cls.name} – {EXAM_TYPES[tur]?.label ?? tur} Birleştirilmiş Karne</h1>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{cls.name} · deneme bazında sınıf ortalamaları</h2>
        <ExportButton
          fileName={`${cls.name} birleştirilmiş karne - ${tur}`}
          headers={["Deneme", "Tarih", "Katılım", ...sectionNames, "Sınıf ort. net", "Kurum ort. net", "Ort. puan"]}
          rows={perExam.map((p) => [p.exam.name, fmtDate(p.exam.date), p.n, ...p.sections, p.net, p.kurumNet, p.score])}
        />
      </div>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-paper">
            <tr>
              <th className={th}>Deneme</th>
              <th className={th}>Tarih</th>
              <th className={`${th} text-right`}>Katılım</th>
              {sectionNames.map((n) => (
                <th key={n} className={`${th} text-right`}>{n}</th>
              ))}
              <th className={`${th} text-right`}>Sınıf net</th>
              <th className={`${th} text-right`}>Kurum net</th>
              <th className={`${th} text-right`}>Ort. puan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {perExam.map((p, i) => {
              const prev = perExam[i - 1];
              return (
                <tr key={p.exam.id}>
                  <td className={`${td} font-medium`}>
                    <Link href={`/kurum/denemeler/${p.exam.id}?sinif=${cls.id}`} className="hover:text-brand-600">{p.exam.name}</Link>
                  </td>
                  <td className={`${td} text-lead`}>{fmtDate(p.exam.date)}</td>
                  <td className={`${td} text-right`}>{p.n}</td>
                  {p.sections.map((v, j) => (
                    <td key={j} className={`${td} text-right tabular-nums`}>{fmtNet(v)}</td>
                  ))}
                  <td className={`${td} text-right text-sm font-bold tabular-nums`}>
                    {fmtNet(p.net)}
                    {prev && <span className={`ml-1 text-[10px] ${p.net >= prev.net ? "text-emerald-600" : "text-red-600"}`}>{p.net >= prev.net ? "▲" : "▼"}</span>}
                  </td>
                  <td className={`${td} text-right tabular-nums ${p.net >= p.kurumNet ? "text-emerald-700" : "text-red-600"}`}>{fmtNet(p.kurumNet)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtNet(p.score)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-graphite bg-paper font-semibold">
              <td className={td} colSpan={3}>Ortalama</td>
              {sectionNames.map((_, j) => (
                <td key={j} className={`${td} text-right tabular-nums`}>{fmtNet(avg(perExam.map((p) => p.sections[j])))}</td>
              ))}
              <td className={`${td} text-right tabular-nums`}>{fmtNet(avg(perExam.map((p) => p.net)))}</td>
              <td className={`${td} text-right tabular-nums`}>{fmtNet(avg(perExam.map((p) => p.kurumNet)))}</td>
              <td className={`${td} text-right tabular-nums`}>{fmtNet(avg(perExam.map((p) => p.score)))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Öğrenci bazında toplam netler</h2>
        <ExportButton
          fileName={`${cls.name} öğrenci netleri - ${tur}`}
          headers={["No", "Ad Soyad", ...selected.map((e) => e.name), "Ortalama", "Değişim (ilk→son)"]}
          rows={matrix.map((m) => [m.st.studentNo, `${m.st.firstName} ${m.st.lastName}`, ...m.nets, m.avg, m.trend])}
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-paper">
            <tr>
              <th className={th}>No</th>
              <th className={th}>Ad Soyad</th>
              {selected.map((e) => (
                <th key={e.id} className={`${th} text-right`}>{e.name}</th>
              ))}
              <th className={`${th} text-right`}>Ortalama</th>
              <th className={`${th} text-right`}>Değişim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {matrix.map((m) => (
              <tr key={m.st.id}>
                <td className={`${td} num`}>{m.st.studentNo}</td>
                <td className={td}>
                  <Link className="font-medium hover:text-brand-600" href={`/kurum/ogrenciler/${m.st.id}/birlesik?tur=${tur}`}>{m.st.firstName} {m.st.lastName}</Link>
                </td>
                {m.nets.map((n, j) => (
                  <td key={j} className={`${td} text-right tabular-nums`}>{n === null ? <span className="text-amber-600">girmedi</span> : fmtNet(n)}</td>
                ))}
                <td className={`${td} text-right font-bold tabular-nums`}>{fmtNet(m.avg)}</td>
                <td className={`${td} text-right tabular-nums ${m.trend === null ? "" : m.trend >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {m.trend === null ? "—" : `${m.trend >= 0 ? "▲" : "▼"} ${fmtNet(Math.abs(m.trend))}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
