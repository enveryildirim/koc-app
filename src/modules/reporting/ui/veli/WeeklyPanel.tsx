"use client";
/**
 * Haftalık veli raporu paneli: öğrenci başına mesaj önizlemesi, haftanın öğretmen notu,
 * WhatsApp / kopyalama ile gönderim ve kaydı. Tarayıcı birden fazla pencereyi aynı anda açmaya
 * izin vermediği için toplu WhatsApp yerine "sıradaki veli" düğmesi var.
 */
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WEEKLY_TEMPLATE,
  DISPATCH_CHANNELS,
  LEVELS,
  weeklyMessage,
  type DispatchChannel,
  type ScoreLevel,
  type WeeklyDigest,
  type WeeklyTemplate,
} from "@/modules/reporting";
import { addDays, fmtDateTime } from "@/shared/date";
import { manageLinks, whatsappUrl, type ShareStudent } from "./share";

export type WeeklyPanelRow = ShareStudent & {
  digest: WeeklyDigest;
  dispatch: { note: string; channel: string; sentAt: string | null };
  risk: { level: ScoreLevel | null; reasons: string[] } | null;
};

type Props = { institution: string; weekStart: string; template: WeeklyTemplate; rows: WeeklyPanelRow[] };

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/kurum/veli/haftalik", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "İşlem başarısız.");
  return res.json();
}

const fmt = (iso: string) => fmtDateTime(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function WeeklyPanel({ institution, weekStart, template: initialTemplate, rows: initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [template, setTemplate] = useState(initialTemplate);
  const [draftTemplate, setDraftTemplate] = useState(initialTemplate);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const weekEnd = addDays(weekStart, 6);
  // Bağlantının alan adı tarayıcıda belli olur; sunucu çıktısıyla uyuşsun diye yüklemeden sonra eklenir.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const linkOf = (token: string) => `${origin}/veli/${token}?bas=${weekStart}&bit=${weekEnd}`;

  const notify = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(""), 2500);
  };
  const messageOf = (r: WeeklyPanelRow, note = r.dispatch.note) =>
    weeklyMessage({
      digest: r.digest,
      template,
      weekStart,
      studentName: r.name,
      parentName: r.parentName,
      institution,
      note,
      url: r.token ? linkOf(r.token) : null,
    });

  const pending = rows.filter((r) => !r.dispatch.sentAt);
  const sent = rows.length - pending.length;
  const viewed = rows.filter((r) => r.dispatch.sentAt && r.viewedAt && r.viewedAt >= r.dispatch.sentAt).length;
  const noLink = rows.filter((r) => !r.token);
  const riskNoNote = rows.filter((r) => r.risk?.level === "RISK" && !r.dispatch.note);
  const nextWa = pending.find((r) => r.parentPhone) ?? null;

  const patch = (ids: string[], f: (r: WeeklyPanelRow) => WeeklyPanelRow) => setRows((rs) => rs.map((r) => (ids.includes(r.id) ? f(r) : r)));

  async function markSent(list: WeeklyPanelRow[], channel: DispatchChannel) {
    if (!list.length) return;
    try {
      const out = await post({ action: "sent", weekStart, channel, items: list.map((r) => ({ studentId: r.id, message: messageOf(r) })) });
      patch(
        list.map((r) => r.id),
        (r) => ({ ...r, dispatch: { ...r.dispatch, channel, sentAt: out.sentAt } }),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
  }

  async function unsend(r: WeeklyPanelRow) {
    try {
      await post({ action: "unsent", weekStart, studentIds: [r.id] });
      patch([r.id], (x) => ({ ...x, dispatch: { ...x.dispatch, channel: "", sentAt: null } }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
  }

  function sendWhatsapp(r: WeeklyPanelRow) {
    window.open(whatsappUrl(r, messageOf(r)), "_blank", "noopener");
    markSent([r], "WHATSAPP");
  }

  async function copy(list: WeeklyPanelRow[]) {
    const text = list.map((r) => messageOf(r)).join("\n\n— — —\n\n");
    await navigator.clipboard.writeText(text);
    await markSent(list, "COPY");
    notify(list.length === 1 ? "Mesaj kopyalandı." : `${list.length} mesaj kopyalandı.`);
  }

  async function createLinks() {
    setBusy(true);
    try {
      const res = await manageLinks(
        "share",
        noLink.map((r) => r.id),
      );
      setRows((rs) => rs.map((r) => (res[r.id] ? { ...r, token: res[r.id].token, sharedAt: res[r.id].sharedAt } : r)));
      notify("Bağlantılar hazır.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Hata");
    }
    setBusy(false);
  }

  async function saveNote(r: WeeklyPanelRow) {
    setBusy(true);
    try {
      const out = await post({ action: "note", weekStart, studentId: r.id, note: noteDraft });
      patch([r.id], (x) => ({ ...x, dispatch: { ...x.dispatch, note: out.note } }));
      setNoteFor(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
    setBusy(false);
  }

  async function saveTemplate() {
    setBusy(true);
    try {
      const out = await post({ action: "template", template: draftTemplate });
      setTemplate(out.template);
      setDraftTemplate(out.template);
      notify("Şablon kaydedildi.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
    setBusy(false);
  }

  const templateDirty = useMemo(() => JSON.stringify(draftTemplate) !== JSON.stringify(template), [draftTemplate, template]);

  return (
    <div className="space-y-4">
      <div className="no-print card flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <div className="num text-sm">
          <b>{sent}</b> / {rows.length} gönderildi
          <span className="text-lead"> · {viewed} veli açtı</span>
        </div>
        {nextWa && (
          <button className="btn-primary" onClick={() => sendWhatsapp(nextWa)} title={nextWa.parentPhone}>
            Sıradaki: {nextWa.name}, WhatsApp
          </button>
        )}
        {pending.length > 0 && (
          <button className="btn-secondary" onClick={() => copy(pending)}>
            Bekleyen {pending.length} mesajı kopyala
          </button>
        )}
        {noLink.length > 0 && (
          <button className="btn-secondary" disabled={busy} onClick={createLinks}>
            {noLink.length} öğrenciye karne bağlantısı oluştur
          </button>
        )}
        {flash && <span className="text-sm text-emerald-700">{flash}</span>}
      </div>

      {(riskNoNote.length > 0 || noLink.length > 0) && (
        <ul className="no-print space-y-1 text-[13px] text-lead">
          {riskNoNote.length > 0 && (
            <li>
              <b className="text-red-700">{riskNoNote.length} öğrenci risk altında</b> ve bu hafta için öğretmen notu yok. Veliye kısa bir not eklemeniz önerilir; skor
              veliye gösterilmez.
            </li>
          )}
          {noLink.length > 0 && <li>Karne bağlantısı olmayan öğrencilerin mesajı bağlantısız gider.</li>}
        </ul>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const isSent = !!r.dispatch.sentAt;
          const opened = isSent && r.viewedAt && r.viewedAt >= r.dispatch.sentAt!;
          const editing = noteFor === r.id;
          return (
            <article key={r.id} className={`card grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)] ${isSent ? "" : "ring-graphite/30"}`}>
              <div className="min-w-0 space-y-1.5">
                <div>
                  <b>{r.name}</b> <span className="num text-xs text-lead">{r.studentNo}</span>
                </div>
                <div className="text-[13px] text-lead">
                  {r.parentName || "Veli adı yok"}
                  {r.parentPhone ? <span className="num block">{r.parentPhone}</span> : <span className="block text-amber-700">Telefon yok</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {isSent ? (
                    <span className="badge bg-emerald-50 text-emerald-800">
                      {DISPATCH_CHANNELS[r.dispatch.channel as DispatchChannel] ?? "Gönderildi"} · {fmt(r.dispatch.sentAt!)}
                    </span>
                  ) : (
                    <span className="badge bg-mist text-graphite">Bekliyor</span>
                  )}
                  {opened && <span className="badge bg-emerald-50 text-emerald-800">Veli açtı</span>}
                  {r.risk?.level === "RISK" && <span className={`badge ${LEVELS.RISK.cls}`}>{LEVELS.RISK.label}</span>}
                </div>
                <div className="no-print flex flex-wrap gap-1.5 pt-1">
                  <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => sendWhatsapp(r)}>WhatsApp</button>
                  <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => copy([r])}>Kopyala</button>
                  {r.token && (
                    <a className="btn-secondary px-2.5 py-1 text-xs" href={linkOf(r.token)} target="_blank" rel="noreferrer">
                      Karne
                    </a>
                  )}
                  {isSent && (
                    <button className="px-1 text-xs text-lead underline decoration-rule underline-offset-4 hover:text-graphite" onClick={() => unsend(r)}>
                      Geri al
                    </button>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <pre className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-graphite">{messageOf(r, editing ? noteDraft : r.dispatch.note)}</pre>
                <div className="no-print mt-2">
                  {editing ? (
                    <div className="space-y-2">
                      <textarea
                        className="input min-h-20"
                        value={noteDraft}
                        maxLength={1000}
                        autoFocus
                        placeholder="Bu haftaya özel öğretmen notu"
                        onChange={(e) => setNoteDraft(e.target.value)}
                      />
                      {r.risk && r.risk.reasons.length > 0 && (
                        <div className="text-xs text-lead">
                          Skorun dayandığı bilgiler (veliye uygun bir dille yazın):
                          <ul className="mt-1 space-y-0.5">
                            {r.risk.reasons.map((t) => (
                              <li key={t}>
                                <button
                                  type="button"
                                  className="text-left underline decoration-rule underline-offset-4 hover:text-graphite"
                                  onClick={() => setNoteDraft((d) => (d ? `${d} ${t}.` : `${t}.`))}
                                >
                                  {t}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => saveNote(r)}>Notu kaydet</button>
                        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setNoteFor(null)}>Vazgeç</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-xs text-lead underline decoration-rule underline-offset-4 hover:text-graphite"
                      onClick={() => {
                        setNoteFor(r.id);
                        setNoteDraft(r.dispatch.note);
                      }}
                    >
                      {r.dispatch.note ? "Öğretmen notunu düzenle" : "Öğretmen notu ekle"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <details className="no-print card p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">Mesaj şablonu</summary>
        <p className="mt-2 text-xs text-lead">
          Ortadaki özet otomatik hazırlanır. Kullanılabilecek alanlar: {"{veli}"}, {"{ogrenci}"}, {"{hafta}"}, {"{kurum}"}.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="label">Giriş</span>
            <textarea className="input min-h-20" value={draftTemplate.intro} onChange={(e) => setDraftTemplate({ ...draftTemplate, intro: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Kapanış</span>
            <textarea className="input min-h-20" value={draftTemplate.outro} onChange={(e) => setDraftTemplate({ ...draftTemplate, outro: e.target.value })} />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" disabled={busy || !templateDirty} onClick={saveTemplate}>Şablonu kaydet</button>
          <button className="btn-secondary" onClick={() => setDraftTemplate(DEFAULT_WEEKLY_TEMPLATE)}>Varsayılan metin</button>
        </div>
      </details>
    </div>
  );
}
