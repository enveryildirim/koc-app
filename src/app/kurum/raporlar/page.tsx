import { prisma } from "@/lib/db";
import { classroomsOf, fullName, LESSON_TYPES, requireOwner, ymd } from "@/lib/kurum";
import { Empty, Kpi, PageHeader, Tabs, td, th } from "@/components/kurum/ui";
import PrintButton from "@/components/PrintButton";

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
  const sessionWhere = { ownerId, date: { gte: bas, lte: bit }, ...(sinif ? { classroomId: sinif } : {}) };
  const rangeLabel = `${fmt(bas)} – ${fmt(bit)}${sinif ? ` · ${classrooms.find((c) => c.id === sinif)?.name}` : " · tüm sınıflar"}`;

  return (
    <div>
      <PageHeader title="Devam Raporları" sub={rangeLabel} actions={<PrintButton />} />
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
      {rapor === "devamsizlik" && <Absence ownerId={ownerId} sessionWhere={sessionWhere} sinif={sinif} />}
      {rapor === "gelmeyen" && <Absentees sessionWhere={sessionWhere} />}
      {rapor === "ogretmen" && <TeacherCounts ownerId={ownerId} sessionWhere={sessionWhere} />}
      {rapor === "ders" && <LessonList ownerId={ownerId} sessionWhere={sessionWhere} sinif={sinif} />}
    </div>
  );
}

type SW = { ownerId: string; date: { gte: string; lte: string }; classroomId?: string };

/* a. Öğrenci bazında devamsızlık */
async function Absence({ ownerId, sessionWhere, sinif }: { ownerId: string; sessionWhere: SW; sinif: string }) {
  const [students, att] = await Promise.all([
    prisma.student.findMany({ where: { ownerId, external: false, classroomId: sinif || { not: null } }, include: { classroom: true } }),
    prisma.attendance.findMany({ where: { session: sessionWhere }, select: { studentId: true, status: true } }),
  ]);
  const agg = new Map<string, Record<string, number>>();
  for (const a of att) {
    const m = agg.get(a.studentId) ?? {};
    m[a.status] = (m[a.status] ?? 0) + 1;
    agg.set(a.studentId, m);
  }
  const rows = students
    .map((s) => {
      const m = agg.get(s.id) ?? {};
      const total = Object.values(m).reduce((x, y) => x + y, 0);
      const absent = m.ABSENT ?? 0;
      return { s, total, absent, late: m.LATE ?? 0, excused: m.EXCUSED ?? 0, rate: total ? Math.round(((total - absent - (m.EXCUSED ?? 0)) / total) * 100) : null };
    })
    .sort((a, b) => b.absent - a.absent || (a.rate ?? 101) - (b.rate ?? 101) || a.s.firstName.localeCompare(b.s.firstName, "tr"));
  if (!att.length) return <Empty>Seçilen aralıkta yoklama kaydı yok.</Empty>;
  const totalAbs = rows.reduce((x, r) => x + r.absent, 0);
  const avgRate = Math.round(rows.filter((r) => r.rate !== null).reduce((x, r) => x + (r.rate ?? 0), 0) / Math.max(1, rows.filter((r) => r.rate !== null).length));
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Öğrenci" value={rows.length} />
        <Kpi label="Yoklama kaydı" value={att.length} />
        <Kpi label="Toplam devamsızlık" value={totalAbs} />
        <Kpi label="Ortalama devam" value={`%${avgRate}`} />
      </div>
      <Table head={["#", "Öğrenci", "Sınıf", "Ders", "Gelmedi", "Geç", "İzinli", "Devam %"]}>
        {rows.map((r, i) => (
          <tr key={r.s.id} className={r.rate !== null && r.rate < 80 ? "bg-red-50/50" : ""}>
            <td className={td + " text-slate-400"}>{i + 1}</td>
            <td className={td + " font-medium"}>
              <span className="font-mono text-xs text-slate-400">{r.s.studentNo}</span> {fullName(r.s)}
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
async function Absentees({ sessionWhere }: { sessionWhere: SW }) {
  const rows = await prisma.attendance.findMany({
    where: { status: "ABSENT", session: sessionWhere },
    include: { student: true, session: { include: { classroom: true, teacher: true } } },
  });
  rows.sort((a, b) => b.session.date.localeCompare(a.session.date) || a.session.startTime.localeCompare(b.session.startTime));
  if (!rows.length) return <Empty>Seçilen aralıkta gelmeyen öğrenci kaydı yok. 🎉</Empty>;
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">{rows.length} devamsızlık kaydı · {new Set(rows.map((r) => r.studentId)).size} farklı öğrenci</p>
      <Table head={["Tarih", "Saat", "Sınıf", "Ders", "Öğrenci", "Veli", "Veli telefonu"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td + " whitespace-nowrap"}>{fmt(r.session.date)}</td>
            <td className={td + " whitespace-nowrap font-mono text-xs"}>{r.session.startTime}–{r.session.endTime}</td>
            <td className={td}>{r.session.classroom.name}</td>
            <td className={td}>{r.session.subject} <span className="text-xs text-slate-400">({r.session.teacher.name})</span></td>
            <td className={td + " font-medium"}>{fullName(r.student)}</td>
            <td className={td}>{r.student.parentName || "—"}</td>
            <td className={td + " whitespace-nowrap"}>{r.student.parentPhone ? <a className="text-brand-600" href={`tel:${r.student.parentPhone.replace(/\s/g, "")}`}>{r.student.parentPhone}</a> : "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* c. Öğretmen ders sayıları */
async function TeacherCounts({ ownerId, sessionWhere }: { ownerId: string; sessionWhere: SW }) {
  const [teachers, sessions] = await Promise.all([
    prisma.teacher.findMany({ where: { ownerId }, orderBy: { name: "asc" } }),
    prisma.lessonSession.findMany({ where: sessionWhere, select: { teacherId: true, lessonType: true, startTime: true, endTime: true } }),
  ]);
  const rows = teachers
    .map((t) => {
      const mine = sessions.filter((s) => s.teacherId === t.id);
      const byType = Object.fromEntries(Object.keys(LESSON_TYPES).map((k) => [k, mine.filter((s) => s.lessonType === k).length]));
      const minutes = mine.reduce((x, s) => x + diff(s.startTime, s.endTime), 0);
      return { t, count: mine.length, byType, minutes };
    })
    .sort((a, b) => b.count - a.count);
  if (!teachers.length) return <Empty>Henüz öğretmen yok.</Empty>;
  const totalMin = rows.reduce((x, r) => x + r.minutes, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Kpi label="Öğretmen" value={teachers.length} />
        <Kpi label="İşlenen ders" value={sessions.length} />
        <Kpi label="Toplam süre" value={`${hours(totalMin)} saat`} />
      </div>
      <Table head={["Öğretmen", "Branş", "Toplam ders", ...Object.values(LESSON_TYPES), "Toplam saat"]}>
        {rows.map((r) => (
          <tr key={r.t.id}>
            <td className={td + " font-medium"}>{r.t.name}</td>
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
async function LessonList({ ownerId, sessionWhere, sinif }: { ownerId: string; sessionWhere: SW; sinif: string }) {
  const [students, att] = await Promise.all([
    prisma.student.findMany({ where: { ownerId, external: false, classroomId: sinif || { not: null } }, include: { classroom: true } }),
    prisma.attendance.findMany({
      where: { session: sessionWhere },
      select: { studentId: true, status: true, session: { select: { subject: true, lessonType: true } } },
    }),
  ]);
  if (!att.length) return <Empty>Seçilen aralıkta ders kaydı yok.</Empty>;
  type Agg = { planned: number; attended: number; byType: Record<string, number>; bySubject: Record<string, [number, number]> };
  const agg = new Map<string, Agg>();
  for (const a of att) {
    const m = agg.get(a.studentId) ?? { planned: 0, attended: 0, byType: {}, bySubject: {} };
    const came = a.status === "PRESENT" || a.status === "LATE";
    m.planned++;
    if (came) m.attended++;
    m.byType[a.session.lessonType] = (m.byType[a.session.lessonType] ?? 0) + 1;
    const sub = (m.bySubject[a.session.subject] ??= [0, 0]);
    sub[0]++;
    if (came) sub[1]++;
    agg.set(a.studentId, m);
  }
  const rows = students
    .map((s) => ({ s, m: agg.get(s.id) }))
    .filter((r) => r.m)
    .sort((a, b) => (a.s.classroom?.name ?? "").localeCompare(b.s.classroom?.name ?? "", "tr") || a.s.firstName.localeCompare(b.s.firstName, "tr"));
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        Planlanan: öğrencinin sınıfına düşen ve yoklaması alınmış ders sayısı · Katıldı: Geldi + Geç kaldı.
        Ders kutularında <b>katıldı/planlanan</b> gösterilir.
      </p>
      <Table head={["Öğrenci", "Sınıf", "Planlanan", "Katıldı", ...Object.values(LESSON_TYPES), "Derslere göre"]}>
        {rows.map(({ s, m }) => (
          <tr key={s.id}>
            <td className={td + " whitespace-nowrap font-medium"}>{fullName(s)}</td>
            <td className={td}>{s.classroom?.name}</td>
            <td className={td}>{m!.planned}</td>
            <td className={td + " font-semibold"}>{m!.attended}</td>
            {Object.keys(LESSON_TYPES).map((k) => <td key={k} className={td}>{m!.byType[k] || "—"}</td>)}
            <td className={td}>
              <div className="flex flex-wrap gap-1">
                {Object.entries(m!.bySubject)
                  .sort((a, b) => a[0].localeCompare(b[0], "tr"))
                  .map(([sub, [p, c]]) => (
                    <span key={sub} className={`badge ${c < p ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
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

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function RateBar({ v }: { v: number }) {
  const color = v >= 90 ? "bg-emerald-500" : v >= 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className={`text-xs font-semibold ${v < 80 ? "text-red-600" : ""}`}>%{v}</span>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function diff(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - ah * 60 - am);
}
const hours = (m: number) => (m / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
