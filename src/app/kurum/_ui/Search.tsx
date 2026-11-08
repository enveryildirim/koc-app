"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GROUPS } from "@/shared/ui/KurumNav";

/**
 * Hızlı arama (⌘K / Ctrl+K): öğrenci, sınıf, ders, öğretmen ve menü sayfaları. Dizin ilk açılışta bir kez çekilir,
 * arama istemcide yapılır. Türkçe harfler eşlenir ("ozturk" → Öztürk) ve her kelime ayrı aranır ("ela 9-b").
 */
type Index = {
  students: { id: string; name: string; no: string; cls: string }[];
  classes: { id: string; name: string; level: string }[];
  courses: { id: string; name: string; classroomId: string; cls: string; teacher: string }[];
  teachers: { id: string; name: string; branch: string }[];
};
type Hit = { key: string; label: string; sub: string; href: string; group: string };

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
/** Türkçe küçük harf + harf eşleme: "ŞİMŞEK" ve "simsek" aynı. */
export const fold = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => FOLD[c]);

const PAGES: Hit[] = GROUPS.flatMap((g) => g.links.map(([href, label]) => ({ key: `p${href}`, label, sub: g.title === "Bugün" ? "Sayfa" : `Sayfa · ${g.title}`, href, group: "Sayfalar" })));

function search(index: Index | null, q: string): Hit[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const match = (text: string) => {
    const t = fold(text);
    return words.every((w) => t.includes(w));
  };
  const out: Hit[] = [];
  if (index) {
    out.push(
      ...index.students
        .filter((s) => match(`${s.name} ${s.no} ${s.cls}`))
        .slice(0, 8)
        .map((s) => ({ key: `s${s.id}`, label: s.name, sub: [s.no, s.cls].filter(Boolean).join(" · "), href: `/kurum/ogrenciler/${s.id}`, group: "Öğrenciler" })),
      ...index.classes
        .filter((c) => match(`${c.name} ${c.level}`))
        .slice(0, 4)
        .map((c) => ({ key: `c${c.id}`, label: c.name, sub: "Sınıf", href: `/kurum/siniflar/${c.id}`, group: "Sınıflar" })),
      ...index.courses
        .filter((c) => match(`${c.name} ${c.cls}`))
        .slice(0, 5)
        .map((c) => ({ key: `d${c.id}`, label: `${c.cls} · ${c.name}`, sub: c.teacher, href: `/kurum/dersler?sinif=${c.classroomId}`, group: "Dersler" })),
      ...index.teachers
        .filter((t) => match(`${t.name} ${t.branch}`))
        .slice(0, 4)
        .map((t) => ({ key: `t${t.id}`, label: t.name, sub: t.branch, href: `/kurum/ders-programi/ogretmen/${t.id}`, group: "Öğretmenler" })),
    );
  }
  out.push(...PAGES.filter((p) => match(p.label)).slice(0, 4));
  return out;
}

export default function Search({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setOpen(false), [path]);
  // ⌘K / Ctrl+K her sayfada açar. Telefon ve masaüstü örneği aynı anda var: yalnızca masaüstündeki dinler.
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compact]);
  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    setTimeout(() => input.current?.focus(), 0);
    if (!index)
      fetch("/api/kurum/ara")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setIndex)
        .catch(() => setError("Arama dizini yüklenemedi."));
  }, [open, index]);

  const hits = useMemo(() => search(index, q), [index, q]);
  useEffect(() => setSel(0), [q]);

  function go(h: Hit | undefined) {
    if (!h) return;
    setOpen(false);
    router.push(h.href);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") go(hits[sel]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={
          compact
            ? "inline-flex size-10 items-center justify-center rounded-md text-graphite hover:bg-surface"
            : "flex w-full items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-left text-sm text-lead ring-1 ring-rule hover:ring-graphite"
        }
      >
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {compact ? <span className="sr-only">Ara</span> : <><span className="flex-1">Ara…</span><kbd className="text-[11px] text-lead">⌘K</kbd></>}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Ara">
            <button type="button" aria-label="Kapat" onClick={() => setOpen(false)} className="absolute inset-0 bg-graphite/30" />
            <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-surface ring-1 ring-rule">
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Öğrenci adı ya da numarası, sınıf, ders, öğretmen, sayfa…"
                className="w-full border-b border-rule bg-transparent px-4 py-3 text-[15px] outline-none"
                role="combobox"
                aria-expanded={hits.length > 0}
                aria-controls="arama-sonuclari"
                aria-activedescendant={hits[sel] ? `arama-${hits[sel].key}` : undefined}
              />
              <ul id="arama-sonuclari" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
                {hits.map((h, i) => (
                  <li key={h.key} role="option" id={`arama-${h.key}`} aria-selected={i === sel}>
                    {(i === 0 || hits[i - 1].group !== h.group) && <div className="px-4 pt-2 pb-1 text-[11.5px] text-lead">{h.group}</div>}
                    <button
                      type="button"
                      onMouseEnter={() => setSel(i)}
                      onClick={() => go(h)}
                      className={`flex w-full items-baseline gap-2 px-4 py-2 text-left ${i === sel ? "bg-paper" : ""}`}
                    >
                      <span className="font-medium">{h.label}</span>
                      <span className="truncate text-[13px] text-lead">{h.sub}</span>
                    </button>
                  </li>
                ))}
                {q.trim() && !hits.length && <li className="px-4 py-3 text-sm text-lead">{index ? "Sonuç yok." : error || "Yükleniyor…"}</li>}
                {!q.trim() && <li className="px-4 py-3 text-[13px] text-lead">Ör. “ozturk”, “2046”, “9-b”, “yoklama”. ↑ ↓ ile seçin, Enter ile açın.</li>}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
