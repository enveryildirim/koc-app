"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Row = { id: string; name: string; studentNo: string; homeClass: string | null };

const norm = (s: string) => s.toLocaleLowerCase("tr-TR");

/**
 * Sınıfın öğrencileri: ana sınıfı burası olanlar ve ek üyeler. Ek üye eklenip çıkarılabilir;
 * öğrencinin ana sınıfı öğrenci profilinden değiştirilir.
 */
export default function ClassMembers({ classroomId, own, members, candidates }: { classroomId: string; own: Row[]; members: Row[]; candidates: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return candidates.filter((c) => norm(c.name).includes(n) || c.studentNo.includes(n)).slice(0, 8);
  }, [q, candidates]);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "İşlem başarısız.");
      return false;
    }
    router.refresh();
    return true;
  }

  const row = (s: Row, member: boolean) => (
    <li key={s.id} className="flex items-center gap-3 px-3.5 py-2">
      <Link href={`/kurum/ogrenciler/${s.id}`} className="min-w-0 flex-1 hover:text-brand-700">
        <span className="font-medium">{s.name}</span>
        <span className="num ml-2 text-[13px] text-lead">{s.studentNo}</span>
        {member && <span className="block text-[13px] text-lead">Ana sınıfı: {s.homeClass ?? "yok"}</span>}
      </Link>
      {member && (
        <button
          className="shrink-0 text-sm text-lead/70 hover:text-red-600"
          disabled={busy}
          onClick={() => confirm(`${s.name} bu sınıftan çıkarılsın mı? Ana sınıfı değişmez.`) && send(`/api/kurum/siniflar/${classroomId}/uyeler/${s.id}`, "DELETE")}
        >
          Çıkar
        </button>
      )}
    </li>
  );

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-rule/70 px-3.5 py-2.5">
        <h2 className="font-semibold">
          Öğrenciler <span className="font-normal text-lead">({own.length + members.length})</span>
        </h2>
        {!open && <button className="text-sm font-medium text-brand-600" onClick={() => setOpen(true)}>+ Başka sınıftan ekle</button>}
      </div>

      {open && (
        <div className="border-b border-rule/70 bg-paper/60 px-3.5 py-3">
          <label className="label" htmlFor="member-q">Öğrenci ara (ad veya numara)</label>
          <div className="flex gap-2">
            <input id="member-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör. Ahmet ya da 1023" autoFocus />
            <button className="btn text-lead" onClick={() => { setOpen(false); setQ(""); }}>Kapat</button>
          </div>
          <p className="mt-1 text-[13px] text-lead">Öğrenci ana sınıfında kalır; bu sınıfın derslerine, yoklamasına ve değerlendirmelerine de girer.</p>
          {matches.length > 0 && (
            <ul className="mt-2 divide-y divide-rule/70 rounded-md bg-surface ring-1 ring-rule">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper active:bg-paper"
                    disabled={busy}
                    onClick={() => send(`/api/kurum/siniflar/${classroomId}/uyeler`, "POST", { studentId: m.id }).then((ok) => ok && setQ(""))}
                  >
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="num ml-2 text-[13px] text-lead">{m.studentNo}</span>
                    </span>
                    <span className="text-[13px] text-lead">{m.homeClass ?? "Sınıfsız"} · Ekle</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && !matches.length && <p className="mt-2 text-sm text-lead">Eşleşen öğrenci yok.</p>}
        </div>
      )}
      {error && <p className="px-3.5 pt-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-rule/70">
        {own.map((s) => row(s, false))}
        {own.length === 0 && <li className="px-3.5 py-3 text-sm text-lead">Ana sınıfı bu sınıf olan öğrenci yok.</li>}
      </ul>
      {members.length > 0 && (
        <>
          <div className="border-t border-rule/70 bg-paper/60 px-3.5 py-1.5 text-[12.5px] font-semibold text-lead">
            Başka sınıftan katılanlar ({members.length})
          </div>
          <ul className="divide-y divide-rule/70">{members.map((s) => row(s, true))}</ul>
        </>
      )}
    </section>
  );
}
