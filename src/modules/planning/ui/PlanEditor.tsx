"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { schoolYearLabel, schoolYearRange } from "../calendar";
import { isHolidayWeek, layoutPlan, mondayOf, parsePlan, PLAN_HELP, type Range } from "../plan";
import { addDays } from "@/shared/date";
import { subjectMatches } from "@/shared/subjects";

type Holiday = Range & { classroomId: string | null };

type Props = {
  planId?: string;
  year: number;
  classrooms: { id: string; name: string }[];
  subjectsByClass: Record<string, string[]>;
  /** Sınıfın düzeyine uyan müfredat setlerinden hazır plan metinleri (müfredat ekranından). */
  templatesByClass?: Record<string, { subject: string; grade: string; topics: number; source: string }[]>;
  holidays: Holiday[];
  initial: { classroomId: string; subject: string; startDate: string; source: string };
};

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

const EXAMPLE = "Çarpanlar ve Katlar | 3\nÜslü İfadeler | 3\nKareköklü İfadeler | 4\n+ Kareköklü ifadelerde problemler\nVeri Analizi | 2";

/** Yıllık ders planı oluşturma / düzenleme: metin + canlı haftalık önizleme. */
export default function PlanEditor(p: Props) {
  const router = useRouter();
  const editing = !!p.planId;
  /** Ders sınıfın derslerinden seçilir; düzenlenen planın (eski) dersi listede yoksa o da seçenek olur. */
  const optionsFor = (classroomId: string) => {
    const list = p.subjectsByClass[classroomId] ?? [];
    return editing && p.initial.subject && !list.includes(p.initial.subject) ? [p.initial.subject, ...list] : list;
  };
  const pickSubject = (classroomId: string, wanted: string) => {
    const opts = optionsFor(classroomId);
    return opts.find((s) => s === wanted) ?? opts.find((s) => subjectMatches(s, wanted)) ?? opts[0] ?? "";
  };
  const [f, setF] = useState(() => ({ ...p.initial, subject: pickSubject(p.initial.classroomId, p.initial.subject) }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (x: Partial<typeof f>) => setF({ ...f, ...x });
  const range = schoolYearRange(p.year);

  const holidays = useMemo(() => p.holidays.filter((h) => !h.classroomId || h.classroomId === f.classroomId), [p.holidays, f.classroomId]);
  const { lines, errors } = useMemo(() => parsePlan(f.source), [f.source]);
  const slots = useMemo(() => (f.startDate ? layoutPlan(lines, f.startDate, holidays) : []), [lines, f.startDate, holidays]);
  const last = slots.length ? slots[slots.length - 1].endWeek : null;
  const overflow = last !== null && addDays(last, 4) > range.to;

  // Önizleme satırları: haftalar sırayla, tatil haftaları arada gösterilir
  const weeks = useMemo(() => {
    if (!slots.length) return [];
    const out: { week: string; topics: string[]; holiday: boolean }[] = [];
    for (let w = mondayOf(f.startDate); w <= last!; w = addDays(w, 7)) {
      out.push({ week: w, topics: slots.filter((s) => s.week <= w && w <= s.endWeek).map((s) => s.topic), holiday: isHolidayWeek(w, holidays) });
    }
    return out;
  }, [slots, f.startDate, last, holidays]);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(editing ? `/api/kurum/plan/${p.planId}` : "/api/kurum/plan", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, year: p.year }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Kaydedilemedi.");
    router.push(`/kurum/takvim/plan/${editing ? p.planId : json.id}`);
    router.refresh();
  }

  const subjects = optionsFor(f.classroomId);
  const allTemplates = p.templatesByClass?.[f.classroomId] ?? [];
  const templates = f.subject.trim() ? allTemplates.filter((t) => subjectMatches(t.subject, f.subject)) : allTemplates;
  const gradeName = (g: string) => (/^\d+$/.test(g) ? `${g}. sınıf` : g);
  function applyTemplate(t: (typeof allTemplates)[number]) {
    if (f.source.trim() && !confirm("Konu listesi müfredattaki konularla değiştirilsin mi?")) return;
    set({ source: t.source, subject: f.subject.trim() || t.subject });
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sınıf</label>
            <select className="input" value={f.classroomId} disabled={editing} onChange={(e) => set({ classroomId: e.target.value, subject: pickSubject(e.target.value, f.subject) })}>
              {p.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ders</label>
            {subjects.length ? (
              <select className="input" value={f.subject} disabled={editing} onChange={(e) => set({ subject: e.target.value })}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <p className="pt-2 text-sm text-amber-700">
                Bu sınıfın dersi yok.{" "}
                <Link href={`/kurum/dersler?sinif=${f.classroomId}&yeni=1`} className="font-medium text-brand-600 hover:underline">Dersler sayfasında ekleyin</Link>.
              </p>
            )}
          </div>
          <div>
            <label className="label">Eğitim yılı</label>
            <input className="input" value={schoolYearLabel(p.year)} disabled />
          </div>
          <div>
            <label className="label">İlk hafta</label>
            <input type="date" className="input" min={range.from} max={range.to} value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="flex items-end justify-between">
            <label className="label">Konular</label>
            {!f.source && (
              <button className="text-xs text-brand-700 hover:underline" onClick={() => set({ source: EXAMPLE })}>Örnek doldur</button>
            )}
          </div>
          {templates.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="text-lead">Müfredattan doldur:</span>
              {templates.map((t) => (
                <button key={t.subject + t.grade} type="button" className="btn-secondary px-2 py-0.5 text-[13px]" onClick={() => applyTemplate(t)}>
                  {t.subject} · {gradeName(t.grade)} <span className="font-normal text-lead">({t.topics} konu)</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            className="input font-mono text-sm"
            rows={16}
            value={f.source}
            onChange={(e) => set({ source: e.target.value })}
            placeholder={EXAMPLE}
          />
          <p className="mt-1 text-xs text-lead">{PLAN_HELP} Excel&apos;den iki sütun (konu, hafta) kopyalayıp yapıştırabilirsiniz.</p>
        </div>
        {errors.length > 0 && (
          <ul className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        {editing && <p className="text-xs text-lead">Kaydedince konular yeniden dağıtılır; aynı adı taşıyan konuların &quot;işlendi&quot; bilgisi korunur.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => router.back()}>Vazgeç</button>
          <button className="btn-primary" disabled={busy || errors.length > 0 || !lines.length || !f.subject.trim()} onClick={save}>
            {editing ? "Kaydet" : "Planı oluştur"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-rule/70 px-5 py-3">
          <h3 className="font-semibold">Önizleme</h3>
          <span className="text-xs text-lead">
            {lines.length} konu · {weeks.filter((w) => !w.holiday).length} ders haftası
          </span>
        </div>
        {overflow && (
          <p className="bg-amber-50 px-5 py-2 text-sm text-amber-800">Plan eğitim yılının sonunu ({fmt(range.to)}) aşıyor; bazı konuları kısaltın.</p>
        )}
        {weeks.length === 0 ? (
          <p className="p-8 text-center text-sm text-lead">Konuları yazdıkça haftalara dağılımı burada görünür.</p>
        ) : (
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-rule/70">
                {weeks.map((w, i) => (
                  <tr key={w.week} className={w.holiday ? "bg-red-50/60 text-red-700" : ""}>
                    <td className="w-12 px-3 py-1.5 text-right text-xs text-lead/70">{i + 1}.</td>
                    <td className="w-36 whitespace-nowrap px-3 py-1.5 text-lead">{fmt(w.week)} – {fmt(addDays(w.week, 4))}</td>
                    <td className="px-3 py-1.5">{w.holiday ? "Tatil haftası" : w.topics.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
