import { classroomsOf } from "@/modules/enrollment/server";
import { fullName } from "@/modules/enrollment";
import { LESSON_TYPES } from "@/modules/schedule";
import { requireOwner } from "@/modules/identity/server";
import { absenceByStudent, absentees, lessonsByStudent, teacherLessonCounts, type LessonRange } from "@/modules/reporting/server";
import { ymd } from "@/shared/date";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";
import ExportButton from "@/shared/ui/ExportButton";

export const dynamic = "force-dynamic";

const REPORTS = {
  devamsizlik: "Öğrenci Bazında Devamsızlık",
  gelmeyen: "Gelmeyen Öğrenciler",
  ogretmen: "Öğretmen Ders Sayıları",
  ders: "Öğrenci Bazında Ders Listesi",
} as const;
type Key = keyof typeof REPORTS;

type SP = Promise<{ rapor?: string; bas?: string; bit?: string; sinif?: string }>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const rapor: Key = sp.rapor && sp.rapor in REPORTS ? (sp.rapor as Key) : "devamsizlik";
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const bas = sp.bas && DATE.test(sp.bas) ? sp.bas : ymd(monthAgo);
  const bit = sp.bit && DATE.test(sp.bit) ? sp.bit : ymd();
  const classrooms = await classroomsOf(ownerId);
  const sinif = classrooms.find((c) => c.id === sp.sinif)?.id ?? "";

  const qs = (r: string) => `/kurum/raporlar?rapor=${r}&bas=${bas}&bit=${bit}${sinif ? `&sinif=${sinif}` : ""}`;
  const range: LessonRange = { from: bas, to: bit, classroomId: sinif || undefined };
  const rangeLabel = `${fmt(bas)} – ${fmt(bit)}${sinif ? ` · ${classrooms.find((c) => c.id === sinif)?.name}` : " · tüm sınıflar"}`;

  return (
    <div>
      <PageHeader title="Devam raporları" sub={rangeLabel} actions={<PrintButton />} />
      <Tabs tabs={Object.entries(REPORTS).map(([k, label]) => ({ key: k, label, href: qs(k) }))} active={rapor} />
      <form method="get" className="no-print card mb-6 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="rapor" value={rapor} />
        <div>
          <label className="label">Başlangıç</label>
          <input type="date" name="bas" defaultValue={bas} className="input" />
        </div>
        <div>
          <label className="label">Bitiş</label>
          <input type="date" name="bit" defaultValue={bit} className="input" />
        </div>
        <div>
          <label className="label">Sınıf</label>
          <select name="sinif" defaultValue={sinif} className="input">
            <option value="">Tüm sınıflar</option>
            {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-primary">Uygula</button>
      </form>
      <h2 className="mb-3 hidden text-xl font-bold print:block">{REPORTS[rapor]} · {rangeLabel}</h2>
      {rapor === "devamsizlik" && <Absence ownerId={ownerId} range={range} />}
      {rapor === "gelmeyen" && <Absentees ownerId={ownerId} range={range} />}
      {rapor === "ogretmen" && <TeacherCounts ownerId={ownerId} range={range} />}
      {rapor === "ders" && <LessonList ownerId={ownerId} range={range} />}
    </div>
  );
}

type P = { ownerId: string; range: LessonRange };

/* a. Öğrenci bazında devamsızlık */
async function Absence({ ownerId, range }: P) {
  const { records, rows } = await absenceByStudent(ownerId, range);
  if (!records) return <Empty>Seçilen aralıkta yoklama kaydı yok.</Empty>;
  const totalAbs = rows.reduce((x, r) => x + r.absent, 0);
  const avgRate = Math.round(rows.filter((r) => r.rate !== null).reduce((x, r) => x + (r.rate ?? 0), 0) / Math.max(1, rows.filter((r) => r.rate !== null).length));
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Öğrenci" value={rows.length} />
        <Kpi label="Yoklama kaydı" value={records} />
        <Kpi label="Toplam devamsızlık" value={totalAbs} />
        <Kpi label="Ortalama devam" value={`%${avgRate}`} />
      </div>
      <ExportBar
        fileName="devamsizlik_raporu"
        headers={["Sıra", "Öğrenci No", "Ad Soyad", "Sınıf", "Ders", "Gelmedi", "Geç", "İzinli", "Devam %"]}
        rows={rows.map((r, i) => [i + 1, r.s.studentNo, fullName(r.s), r.s.classroom?.name ?? "", r.total, r.absent, r.late, r.excused, r.rate])}
      />
      <Table head={["#", "Öğrenci", "Sınıf", "Ders", "Gelmedi", "Geç", "İzinli", "Devam %"]} pin={1} hideOnMobile={0}>
        {rows.map((r, i) => (
          <tr key={r.s.id} className={r.rate !== null && r.rate < 80 ? "bg-red-50/50" : ""}>
            <td className={td + " text-lead/70 max-sm:hidden"}>{i + 1}</td>
            <td className={td + " pin font-medium"}>
              <span className="num text-xs text-lead/70">{r.s.studentNo}</span> {fullName(r.s)}
            </td>
            <td className={td}>{r.s.classroom?.name ?? "—"}</td>
            <td className={td}>{r.total}</td>
            <td className={td + " font-semibold text-red-600"}>{r.absent || "—"}</td>
            <td className={td + " text-amber-700"}>{r.late || "—"}</td>
            <td className={td + " text-sky-700"}>{r.excused || "—"}</td>
            <td className={td}>{r.rate === null ? "—" : <RateBar v={r.rate} />}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* b. Gelmeyen öğrenciler */
async function Absentees({ ownerId, range }: P) {
  const rows = await absentees(ownerId, range);
  if (!rows.length) return <Empty>Seçilen aralıkta gelmeyen öğrenci kaydı yok. 🎉</Empty>;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-lead">{rows.length} devamsızlık kaydı · {new Set(rows.map((r) => r.studentId)).size} farklı öğrenci</p>
        <ExportButton
          fileName="gelmeyen_ogrenciler"
          headers={["Tarih", "Saat", "Sınıf", "Ders", "Öğretmen", "Öğrenci No", "Öğrenci", "Veli", "Veli telefonu"]}
          rows={rows.map((r) => [fmt(r.session.date), `${r.session.startTime}–${r.session.endTime}`, r.session.classroom.name, r.session.subject, r.session.teacher.name, r.student.studentNo, fullName(r.student), r.student.parentName, r.student.parentPhone])}
        />
      </div>
      <Table head={["Tarih", "Saat", "Sınıf", "Ders", "Öğrenci", "Veli", "Veli telefonu"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td + " whitespace-nowrap"}>{fmt(r.session.date)}</td>
            <td className={td + " whitespace-nowrap num text-xs"}>{r.session.startTime}–{r.session.endTime}</td>
            <td className={td}>{r.session.classroom.name}</td>
            <td className={td}>{r.session.subject} <span className="text-xs text-lead/70">({r.session.teacher.name})</span></td>
            <td className={td + " font-medium"}>{fullName(r.student)}</td>
            <td className={td}>{r.student.parentName || "—"}</td>
            <td className={td + " whitespace-nowrap"}>{r.student.parentPhone ? <a className="num underline decoration-rule underline-offset-4 hover:decoration-graphite" href={`tel:${r.student.parentPhone.replace(/\s/g, "")}`}>{r.student.parentPhone}</a> : "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* c. Öğretmen ders sayıları */
async function TeacherCounts({ ownerId, range }: P) {
  const { sessions, rows } = await teacherLessonCounts(ownerId, range);
  if (!rows.length) return <Empty>Henüz öğretmen yok.</Empty>;
  const totalMin = rows.reduce((x, r) => x + r.minutes, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Kpi label="Öğretmen" value={rows.length} />
        <Kpi label="İşlenen ders" value={sessions} />
        <Kpi label="Toplam süre" value={`${hours(totalMin)} saat`} />
      </div>
      <ExportBar
        fileName="ogretmen_ders_sayilari"
        headers={["Öğretmen", "Branş", "Toplam ders", ...Object.values(LESSON_TYPES), "Toplam saat"]}
        rows={rows.map((r) => [r.t.name, r.t.branch, r.count, ...Object.keys(LESSON_TYPES).map((k) => r.byType[k] ?? 0), Math.round((r.minutes / 60) * 10) / 10])}
      />
      <Table pin={0} head={["Öğretmen", "Branş", "Toplam ders", ...Object.values(LESSON_TYPES), "Toplam saat"]}>
        {rows.map((r) => (
          <tr key={r.t.id}>
            <td className={td + " pin font-medium"}>{r.t.name}</td>
            <td className={td}>{r.t.branch}</td>
            <td className={td + " font-semibold"}>{r.count}</td>
            {Object.keys(LESSON_TYPES).map((k) => <td key={k} className={td}>{r.byType[k] || "—"}</td>)}
            <td className={td}>{hours(r.minutes)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* d. Öğrenci bazında ders listesi / planlanan ders türleri */
async function LessonList({ ownerId, range }: P) {
  const { records, rows } = await lessonsByStudent(ownerId, range);
  if (!records) return <Empty>Seçilen aralıkta ders kaydı yok.</Empty>;
  return (
    <>
      <p className="mb-3 text-sm text-lead">
        Planlanan: öğrencinin sınıfına düşen ve yoklaması alınmış ders sayısı · Katıldı: Geldi + Geç kaldı.
        Ders kutularında <b>katıldı/planlanan</b> gösterilir.
      </p>
      <ExportBar
        fileName="ogrenci_ders_listesi"
        headers={["Öğrenci No", "Öğrenci", "Sınıf", "Planlanan", "Katıldı", ...Object.values(LESSON_TYPES), "Derslere göre (katıldı/planlanan)"]}
        rows={rows.map(({ s, m }) => [
          s.studentNo,
          fullName(s),
          s.classroom?.name ?? "",
          m.planned,
          m.attended,
          ...Object.keys(LESSON_TYPES).map((k) => m.byType[k] ?? 0),
          Object.entries(m.bySubject)
            .sort((a, b) => a[0].localeCompare(b[0], "tr"))
            .map(([sub, [p, c]]) => `${sub} ${c}/${p}`)
            .join(", "),
        ])}
      />
      <Table pin={0} head={["Öğrenci", "Sınıf", "Planlanan", "Katıldı", ...Object.values(LESSON_TYPES), "Derslere göre"]}>
        {rows.map(({ s, m }) => (
          <tr key={s.id}>
            <td className={td + " pin whitespace-nowrap font-medium"}>{fullName(s)}</td>
            <td className={td}>{s.classroom?.name}</td>
            <td className={td}>{m.planned}</td>
            <td className={td + " font-semibold"}>{m.attended}</td>
            {Object.keys(LESSON_TYPES).map((k) => <td key={k} className={td}>{m.byType[k] || "—"}</td>)}
            <td className={td}>
              <div className="flex flex-wrap gap-1">
                {Object.entries(m.bySubject)
                  .sort((a, b) => a[0].localeCompare(b[0], "tr"))
                  .map(([sub, [p, c]]) => (
                    <span key={sub} className={`badge ${c < p ? "bg-amber-50 text-amber-800" : "bg-mist text-graphite/90"}`}>
                      {sub} {c}/{p}
                    </span>
                  ))}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ---------------------------------- yardımcılar ---------------------------------- */

function ExportBar(props: React.ComponentProps<typeof ExportButton>) {
  return (
    <div className="no-print mb-3 flex justify-end">
      <ExportButton {...props} />
    </div>
  );
}

/** pin: telefonda yana kayarken sabit kalan sütun; hideOnMobile: telefonda gizlenen sütun (ör. sıra no). */
function Table({ head, children, pin, hideOnMobile }: { head: string[]; children: React.ReactNode; pin?: number; hideOnMobile?: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`${th} ${i === pin ? "pin" : ""} ${i === hideOnMobile ? "max-sm:hidden" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/70">{children}</tbody>
      </table>
    </div>
  );
}

function RateBar({ v }: { v: number }) {
  const color = v >= 90 ? "bg-emerald-500" : v >= 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-mist">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className={`text-xs font-semibold ${v < 80 ? "text-red-600" : ""}`}>%{v}</span>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const hours = (m: number) => (m / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
