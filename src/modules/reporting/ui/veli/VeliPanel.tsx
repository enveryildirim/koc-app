"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { waPhone } from "@/shared/phone";
import { manageLinks, reportUrl, saveNote, shareMessage, ShareStudent, whatsappUrl } from "./share";

type Props = {
  institution: string;
  classes: { id: string; name: string }[];
  sinif: string;
  from: string;
  to: string;
  students: ShareStudent[];
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function VeliPanel({ institution, classes, sinif, from, to, students: initial }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState({ from, to });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const go = (p: Record<string, string>) => {
    const q = new URLSearchParams({ sinif, bas: period.from, bit: period.to, ...p });
    router.push(`/kurum/veli-karnesi?${q}`);
  };
  const notify = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(""), 2500);
  };

  async function act(action: "share" | "renew" | "revoke", ids: string[]) {
    if (ids.length === 0) return;
    if (action === "revoke" && !confirm(`${ids.length} öğrencinin veli bağlantısı iptal edilsin mi? Eski bağlantılar çalışmaz.`)) return;
    if (action === "renew" && !confirm("Yeni bağlantı oluşturulsun mu? Veliye gönderilmiş eski bağlantı çalışmaz.")) return;
    setBusy(true);
    try {
      const res = await manageLinks(action, ids);
      setStudents((s) =>
        s.map((x) => (res[x.id] ? { ...x, token: res[x.id].token, sharedAt: res[x.id].sharedAt, viewedAt: action === "share" ? x.viewedAt : null } : x)),
      );
      notify(action === "revoke" ? "Bağlantılar iptal edildi." : `${ids.length} öğrenci için bağlantı hazır.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Hata");
    }
    setBusy(false);
  }

  async function copy(text: string, msg = "Panoya kopyalandı.") {
    await navigator.clipboard.writeText(text);
    notify(msg);
  }

  const withLink = students.filter((s) => s.token);
  const sel = students.filter((s) => selected.has(s.id));
  const allSelected = students.length > 0 && selected.size === students.length;
  const periodChanged = period.from !== from || period.to !== to;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Sınıf</label>
          <select className="input w-auto" value={sinif} onChange={(e) => go({ sinif: e.target.value })}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dönem başlangıcı</label>
          <input type="date" className="input" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
        </div>
        <div>
          <label className="label">Dönem sonu</label>
          <input type="date" className="input" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
        </div>
        {periodChanged && <button className="btn-primary" onClick={() => go({})}>Dönemi uygula</button>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/kurum/veli-karnesi/yazdir?sinif=${sinif}&bas=${from}&bit=${to}`}>🖨️ Sınıfın karnelerini yazdır</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <span className="text-sm text-slate-600">
            {students.length} öğrenci · {withLink.length} bağlantı hazır · {students.filter((s) => s.viewedAt).length} veli görüntüledi
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act("share", (sel.length ? sel : students).map((s) => s.id))}>
              🔗 {sel.length ? `Seçilen ${sel.length} öğrenciye` : "Tüm sınıfa"} bağlantı oluştur
            </button>
            <button
              className="btn-secondary"
              disabled={withLink.length === 0}
              onClick={() =>
                copy(
                  (sel.length ? sel : students)
                    .filter((s) => s.token)
                    .map((s) => `${s.name} – ${s.parentName || "Veli"} ${s.parentPhone}\n${reportUrl(s.token!, from, to)}`)
                    .join("\n\n"),
                  "Bağlantı listesi kopyalandı.",
                )
              }
            >
              📋 Bağlantı listesini kopyala
            </button>
            {sel.length > 0 && (
              <button className="btn-danger" disabled={busy} onClick={() => act("revoke", sel.filter((s) => s.token).map((s) => s.id))}>
                Seçilenlerin bağlantısını iptal et
              </button>
            )}
          </div>
        </div>
        {flash && <div className="bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{flash}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)))}
                  />
                </th>
                <th className="px-3 py-2">Öğrenci</th>
                <th className="px-3 py-2">Veli</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const url = s.token ? reportUrl(s.token, from, to) : "";
                const msg = s.token ? shareMessage(s, url, from, to, institution) : "";
                return (
                  <FragmentRow key={s.id}>
                    <tr className={selected.has(s.id) ? "bg-brand-50/50" : ""}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={selected.has(s.id)}
                          onChange={() => {
                            const n = new Set(selected);
                            if (n.has(s.id)) n.delete(s.id);
                            else n.add(s.id);
                            setSelected(n);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/kurum/ogrenciler/${s.id}`} className="font-medium hover:text-brand-600">{s.name}</Link>
                        <div className="font-mono text-xs text-slate-400">{s.studentNo}</div>
                      </td>
                      <td className="px-3 py-2">
                        {s.parentName || <span className="text-slate-400">—</span>}
                        <div className="text-xs text-slate-500">
                          {s.parentPhone || "telefon yok"}
                          {s.parentPhone && !waPhone(s.parentPhone) && <span className="ml-1 text-amber-600">(cep no değil)</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {!s.token ? (
                          <span className="badge bg-slate-100 text-slate-600">Paylaşılmadı</span>
                        ) : s.viewedAt ? (
                          <span className="badge bg-emerald-50 text-emerald-700" title={`Bağlantı: ${fmt(s.sharedAt)}`}>👁 Veli gördü · {fmt(s.viewedAt)}</span>
                        ) : (
                          <span className="badge bg-sky-50 text-sky-700">Bağlantı hazır · {fmt(s.sharedAt)}</span>
                        )}
                        {s.note && <div className="mt-1 text-xs text-amber-700">✎ Görüş eklendi</div>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          {s.token ? (
                            <>
                              <a className="btn bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700" href={whatsappUrl(s, msg)} target="_blank" rel="noreferrer">
                                WhatsApp
                              </a>
                              <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => copy(msg, "Mesaj ve bağlantı kopyalandı.")}>Kopyala</button>
                              <a className="btn-secondary px-2.5 py-1 text-xs" href={url} target="_blank" rel="noreferrer">Önizle</a>
                            </>
                          ) : (
                            <button className="btn-secondary px-2.5 py-1 text-xs" disabled={busy} onClick={() => act("share", [s.id])}>🔗 Bağlantı oluştur</button>
                          )}
                          <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setNoteFor(noteFor === s.id ? null : s.id)}>✎ Görüş</button>
                          {s.token && (
                            <details className="relative">
                              <summary className="btn-secondary cursor-pointer list-none px-2 py-1 text-xs">⋯</summary>
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg bg-white p-1 text-left shadow-lg ring-1 ring-slate-200">
                                <button className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-slate-50" onClick={() => act("renew", [s.id])}>Yeni bağlantı üret</button>
                                <button className="block w-full rounded px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => act("revoke", [s.id])}>Bağlantıyı iptal et</button>
                              </div>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                    {noteFor === s.id && (
                      <tr className="bg-amber-50/50">
                        <td />
                        <td colSpan={4} className="px-3 py-3">
                          <NoteEditor
                            initial={s.note}
                            onSaved={(note) => {
                              setStudents((x) => x.map((y) => (y.id === s.id ? { ...y, note } : y)));
                              setNoteFor(null);
                              notify("Görüş kaydedildi; veli karnesinde görünecek.");
                            }}
                            studentId={s.id}
                          />
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Bağlantılar tahmin edilemez anahtarlar içerir ve giriş gerektirmez; yalnızca ilgili öğrencinin bilgilerini gösterir.
        WhatsApp düğmesi mesajı velinin numarasıyla hazırlar, gönderimi siz onaylarsınız. Bir bağlantıyı iptal ettiğinizde veya yenilediğinizde eski bağlantı çalışmaz.
      </p>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function NoteEditor({ studentId, initial, onSaved }: { studentId: string; initial: string; onSaved: (note: string) => void }) {
  const [note, setNote] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="label">Öğretmen / rehberlik görüşü (veli karnesinde gösterilir)</label>
      <textarea
        className="input"
        rows={3}
        maxLength={2000}
        placeholder="ör. Matematikte belirgin gelişme var; paragraf sorularında süre yönetimine çalışmalı."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveNote(studentId, note);
              onSaved(note.trim());
            } catch (e) {
              alert(e instanceof Error ? e.message : "Hata");
            }
            setBusy(false);
          }}
        >
          Kaydet
        </button>
        {initial && (
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setNote("")}>Temizle</button>
        )}
      </div>
    </div>
  );
}
