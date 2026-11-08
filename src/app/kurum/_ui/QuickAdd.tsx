"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COURSE_KINDS, guessCourseKind, TEACHER_ROLES } from "@/modules/schedule";

/**
 * "+ Ekle": her sayfadan tek dokunuşla kayıt. Kısa kayıtlar (sınıf, öğretmen, ders) pencerede eklenir,
 * uzun formlar (öğrenci, değerlendirme, ödev, deneme) ilgili sayfayı açar.
 */
type Kind = "sinif" | "ogretmen" | "ders";
type Options = { classes: { id: string; name: string }[]; teachers: { id: string; name: string; branch: string }[] };
type Done = { text: string; href: string; teacherId?: string; teacherName?: string };

const LINKS: [string, string][] = [
  ["/kurum/ogrenciler?tab=yeni", "Öğrenci"],
  ["/kurum/ogrenciler?tab=ice-aktar", "Öğrenci (Excel'den)"],
  ["/kurum/degerlendirme?tab=yeni", "Sözlü / yazılı"],
  ["/kurum/odevler?yeni=1#yeni-odev", "Ödev"],
  ["/kurum/denemeler#yeni-deneme", "Deneme"],
];
const INLINE: [Kind, string][] = [["sinif", "Sınıf"], ["ogretmen", "Öğretmen"], ["ders", "Ders"]];

export default function QuickAdd({ compact = false }: { compact?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  useEffect(() => {
    setOpen(false);
    setKind(null);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const close = () => {
    setOpen(false);
    setKind(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={compact ? "inline-flex size-10 items-center justify-center rounded-md text-xl font-semibold text-graphite hover:bg-surface" : "btn-primary w-full justify-center"}
      >
        {compact ? <><span aria-hidden="true">+</span><span className="sr-only">Ekle</span></> : "+ Ekle"}
      </button>
      {/* Pencere body'ye taşınır: telefon üst çubuğundaki backdrop-blur, içindeki "fixed" öğeyi çubuğa hapseder */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Ekle">
          <button type="button" aria-label="Kapat" onClick={close} className="absolute inset-0 bg-graphite/30" />
          <div className="relative w-full max-w-md rounded-t-xl bg-surface p-4 ring-1 ring-rule sm:rounded-xl">
            {kind ? (
              <InlineForm kind={kind} onBack={() => setKind(null)} onClose={close} />
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Ne eklemek istiyorsunuz?</h2>
                  <button type="button" onClick={close} className="text-sm text-lead hover:text-graphite">Kapat</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {INLINE.map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setKind(k)} className="min-h-12 rounded-md bg-paper px-2 text-sm font-semibold ring-1 ring-rule hover:ring-graphite">
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[12.5px] text-lead">Sınıf, öğretmen ve ders burada eklenir; diğerleri kendi formunu açar.</p>
                <ul className="mt-3 divide-y divide-rule/70 rounded-md ring-1 ring-rule">
                  {LINKS.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} onClick={close} className="flex min-h-11 items-center justify-between px-3 text-sm hover:bg-paper">
                        {label} <span aria-hidden="true" className="text-lead">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function InlineForm({ kind, onBack, onClose }: { kind: Kind; onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const [opts, setOpts] = useState<Options | null>(null);
  const [f, setF] = useState({ name: "", level: "", branch: "", role: "TEACHER", classroomId: "", kind: "SCHOOL", kindTouched: false, teacherId: "", external: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (kind !== "ders") return;
    fetch("/api/kurum/secenekler").then((r) => r.json()).then(setOpts).catch(() => setError("Sınıflar yüklenemedi."));
  }, [kind]);

  const title = { sinif: "Yeni sınıf", ogretmen: "Yeni öğretmen", ders: "Yeni ders" }[kind];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const req =
      kind === "sinif"
        ? { url: "/api/kurum/siniflar", body: { name: f.name, level: f.level } }
        : kind === "ogretmen"
          ? { url: "/api/kurum/ogretmenler", body: { name: f.name, branch: f.branch, role: f.role } }
          : { url: "/api/kurum/dersler", body: { classroomId: f.classroomId, name: f.name, kind: f.kind, teacherId: f.teacherId || null, external: f.external } };
    const res = await fetch(req.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Kaydedilemedi.");
    router.refresh();
    const name = f.name.trim();
    if (kind === "sinif") setDone({ text: `${name} sınıfı eklendi.`, href: `/kurum/siniflar/${j.id}` });
    else if (kind === "ogretmen") setDone({ text: `${name} eklendi.`, href: "/kurum/ogretmenler", teacherId: j.id, teacherName: name });
    else setDone({ text: `${opts?.classes.find((c) => c.id === f.classroomId)?.name} · ${name} dersi eklendi.`, href: `/kurum/siniflar/${f.classroomId}` });
  }

  /** Yeni öğretmenin giriş linki: oluştur ve panoya kopyala (WhatsApp'tan gönderilebilir). */
  async function copyLink() {
    if (!done?.teacherId) return;
    setBusy(true);
    const res = await fetch(`/api/kurum/ogretmenler/${done.teacherId}/link`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Link oluşturulamadı.");
    const url = `${window.location.origin}/o/${j.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      prompt("Linki kopyalayın:", url);
    }
  }

  if (done) {
    return (
      <div>
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">{done.text}</p>
        {done.teacherId && (
          <button type="button" className="btn-secondary mt-3 w-full justify-center" disabled={busy} onClick={copyLink}>
            {copied ? "Link kopyalandı ✓" : "Telefondan giriş linkini oluştur ve kopyala"}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={done.href} onClick={onClose} className="btn-primary">{kind === "ogretmen" ? "Öğretmenlere git" : kind === "sinif" ? "Sınıfı aç" : "Sınıfın derslerine git"}</Link>
          <button type="button" className="btn-secondary" onClick={() => { setDone(null); setCopied(false); setF({ ...f, name: "", branch: "" }); }}>Bir tane daha</button>
          <button type="button" className="ml-auto text-sm text-lead hover:text-graphite" onClick={onClose}>Kapat</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm text-lead hover:text-graphite">‹ Geri</button>
        <h2 className="font-semibold">{title}</h2>
        <span className="w-10" />
      </div>
      {kind === "ders" && (
        <div>
          <label className="label">Sınıf</label>
          <select className="input" required value={f.classroomId} onChange={(e) => setF({ ...f, classroomId: e.target.value })}>
            <option value="">{opts ? "Seçin…" : "Yükleniyor…"}</option>
            {opts?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">{kind === "sinif" ? "Sınıf adı" : kind === "ogretmen" ? "Ad soyad" : "Ders adı"}</label>
        <input
          className="input"
          required
          autoFocus
          placeholder={kind === "sinif" ? "ör. 9-C" : kind === "ders" ? "ör. Tecvid" : ""}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value, ...(kind === "ders" && !f.kindTouched ? { kind: guessCourseKind(e.target.value) } : {}) })}
        />
      </div>
      {kind === "sinif" && (
        <div>
          <label className="label">Seviye</label>
          <input className="input" placeholder="ör. 9 ya da Seviye-2" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} />
        </div>
      )}
      {kind === "ogretmen" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Branş</label>
            <input className="input" required placeholder="ör. Matematik" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {Object.entries(TEACHER_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}
      {kind === "ders" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Tür</label>
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, kindTouched: true })}>
                {Object.entries(COURSE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sorumlu</label>
              <select className="input" value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
                <option value="">Sonra seçilir</option>
                {opts?.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.external} onChange={(e) => setF({ ...f, external: e.target.checked })} />
            Başka kurumda alınıyor
          </label>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
    </form>
  );
}
