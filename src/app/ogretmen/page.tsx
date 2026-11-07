import Link from "next/link";
import { ymd, addDays } from "@/shared/date";
import { requireStaff } from "@/modules/identity/server";
import { teacherAgenda, type AgendaLesson } from "@/modules/reporting/server";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(d + "T12:00:00").toLocaleDateString("tr-TR", opts);

function href(l: AgendaLesson) {
  return l.sessionId ? `/ogretmen/ders?ders=${l.sessionId}` : `/ogretmen/ders?program=${l.slotId}&tarih=${l.date}`;
}

function Chip({ ok, label, muted }: { ok: boolean; label: string; muted?: boolean }) {
  if (muted) return <span className="badge badge-plain bg-zinc-100 text-zinc-500">{label}</span>;
  return <span className={`badge ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{label}</span>;
}

/** Öğretmen ana ekranı: eksik girişler ve günün dersleri. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tarih?: string }> }) {
  const me = await requireStaff();
  const today = ymd();
  const sp = await searchParams;
  const date = sp.tarih && YMD.test(sp.tarih) ? sp.tarih : today;
  const { lessons, missing } = await teacherAgenda(me.ownerId, me.teacherId, date, today);
  const pending = lessons.filter((l) => !l.taken && !l.holiday).length;

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <section className="card overflow-hidden ring-amber-200">
          <div className="border-b border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <h2 className="font-semibold text-amber-900">Eksik girişler ({missing.length})</h2>
            <p className="text-[13px] text-amber-900/80">Son iki haftada yoklaması alınmamış dersleriniz.</p>
          </div>
          <ul className="divide-y divide-rule/70">
            {missing.slice(0, 8).map((l) => (
              <li key={`${l.slotId}-${l.date}`}>
                <Link href={href(l)} className="flex items-center gap-3 px-3.5 py-2.5 active:bg-paper">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l.subject} · {l.classroom}</span>
                    <span className="text-[13px] text-lead">{dayLabel(l.date, { weekday: "short", day: "numeric", month: "short" })} · <span className="num">{l.startTime}</span></span>
                  </span>
                  <span className="text-sm font-semibold text-brand-600">Gir ›</span>
                </Link>
              </li>
            ))}
          </ul>
          {missing.length > 8 && <p className="border-t border-rule/70 px-3.5 py-2 text-[13px] text-lead">ve {missing.length - 8} ders daha</p>}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Link href={`/ogretmen?tarih=${addDays(date, -1)}`} className="btn-secondary px-2.5" aria-label="Önceki gün">‹</Link>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <div className="font-semibold">{date === today ? "Bugün" : dayLabel(date, { weekday: "long" })}</div>
            <div className="text-[13px] text-lead">{dayLabel(date, { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <Link href={`/ogretmen?tarih=${addDays(date, 1)}`} className="btn-secondary px-2.5" aria-label="Sonraki gün">›</Link>
        </div>
        {date !== today && (
          <p className="mb-2 text-center text-[13px]"><Link href="/ogretmen" className="text-brand-600">Bugüne dön</Link></p>
        )}

        {lessons.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-lead">Bu gün dersiniz yok.</div>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={`${l.slotId}-${l.sessionId}`}>
                <Link href={href(l)} className={`card flex items-center gap-3 px-3.5 py-3 active:bg-paper ${l.holiday ? "opacity-60" : ""}`}>
                  <span className="w-12 shrink-0 text-center leading-tight">
                    <span className="num block font-semibold">{l.startTime}</span>
                    <span className="num block text-[12px] text-lead">{l.endTime}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.subject}</span>
                    <span className="block text-[13px] text-lead">{l.classroom} · {l.total} öğrenci</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {l.holiday ? (
                        <Chip ok={false} muted label={`Tatil: ${l.holiday}`} />
                      ) : (
                        <>
                          <Chip ok={l.taken} label={l.taken ? (l.absent ? `Yoklama · ${l.absent} gelmedi` : "Yoklama · hepsi geldi") : "Yoklama bekliyor"} />
                          {l.hasPlan && <Chip ok={l.topicDone} label={l.topicDone ? "Konu işlendi" : "Konu işaretlenmedi"} />}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="text-lg text-lead">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {date === today && lessons.length > 0 && (
          <p className="mt-2 text-center text-[13px] text-lead">{pending ? `${pending} dersin yoklaması bekliyor.` : "Bugünün bütün girişleri tamam."}</p>
        )}
      </section>
    </div>
  );
}
