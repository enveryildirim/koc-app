"use client";
import Link from "next/link";
import { useState } from "react";
import { manageLinks, reportUrl, shareMessage, ShareStudent, whatsappUrl } from "./share";
import { NoteEditor } from "./VeliPanel";
import { fmtDateTime } from "@/shared/date";

/** Öğrenci profilindeki veli karnesi kartı (son 30 gün). */
export default function VeliCard({ student: initial, institution, from, to }: { student: ShareStudent; institution: string; from: string; to: string }) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const url = s.token ? reportUrl(s.token, from, to) : "";
  const text = s.token ? shareMessage(s, url, from, to, institution) : "";

  async function act(action: "share" | "renew" | "revoke") {
    if (action !== "share" && !confirm(action === "revoke" ? "Veli bağlantısı iptal edilsin mi?" : "Yeni bağlantı üretilsin mi? Eski bağlantı çalışmaz.")) return;
    setBusy(true);
    const r = (await manageLinks(action, [s.id]))[s.id];
    setS({ ...s, token: r.token, sharedAt: r.sharedAt, viewedAt: action === "share" ? s.viewedAt : null });
    setBusy(false);
  }

  return (
    <section className="no-print card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Veli karnesi <span className="text-xs font-normal text-lead">(son 30 gün)</span></h2>
        <div className="text-xs">
          {!s.token ? (
            <span className="badge bg-mist text-lead">Paylaşılmadı</span>
          ) : s.viewedAt ? (
            <span className="badge bg-emerald-50 text-emerald-700">👁 Veli gördü · {fmtDateTime(s.viewedAt)}</span>
          ) : (
            <span className="badge bg-sky-50 text-sky-700">Bağlantı hazır, henüz açılmadı</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="btn-secondary" href={`/kurum/veli-karnesi/yazdir?ogrenci=${s.id}&bas=${from}&bit=${to}`}>Önizle / yazdır</Link>
        {s.token ? (
          <>
            <a className="btn bg-emerald-600 text-white hover:bg-emerald-700" href={whatsappUrl(s, text)} target="_blank" rel="noreferrer">WhatsApp ile gönder</a>
            <button
              className="btn-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setMsg("Mesaj ve bağlantı kopyalandı.");
              }}
            >
              Bağlantıyı kopyala
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => act("renew")}>Yenile</button>
            <button className="btn-danger" disabled={busy} onClick={() => act("revoke")}>İptal et</button>
          </>
        ) : (
          <button className="btn-primary" disabled={busy} onClick={() => act("share")}>Veli bağlantısı oluştur</button>
        )}
        <button className="btn-secondary" onClick={() => setEditing(!editing)}>✎ Öğretmen görüşü{s.note ? " (var)" : ""}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {editing && (
        <div className="mt-3">
          <NoteEditor
            studentId={s.id}
            initial={s.note}
            onSaved={(note) => {
              setS({ ...s, note });
              setEditing(false);
              setMsg("Görüş kaydedildi.");
            }}
          />
        </div>
      )}
    </section>
  );
}
