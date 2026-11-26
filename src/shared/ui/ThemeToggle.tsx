"use client";

import { useEffect, useState } from "react";

/**
 * Açık / koyu tema seçimi. Tercih tarayıcıda (localStorage "theme") saklanır:
 * "light", "dark" ya da yoksa sistem ayarı. Sayfa açılırken temayı THEME_SCRIPT kurar,
 * böylece ilk boyamada yanıp sönme olmaz.
 */
type Pref = "system" | "light" | "dark";

const KEY = "theme";
const ORDER: Pref[] = ["system", "light", "dark"];
const LABEL: Record<Pref, string> = { system: "Sistem teması", light: "Açık tema", dark: "Koyu tema" };

/** Kök düzenin <head>'ine satır içi konur; tercihi uygular ve sistem değişince günceller. */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=null;try{t=localStorage.getItem("${KEY}")}catch(e){}d.dataset.theme=t==="dark"||(t!=="light"&&m.matches)?"dark":"light"}a();m.addEventListener("change",a);window.__applyTheme=a})()`;

function readPref(): Pref {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export default function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [pref, setPref] = useState<Pref | null>(null);
  useEffect(() => setPref(readPref()), []);

  function next() {
    const p = ORDER[(ORDER.indexOf(pref ?? "system") + 1) % ORDER.length];
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
    setPref(p);
  }

  const shown = pref ?? "system";
  return (
    <button
      type="button"
      onClick={next}
      title={`${LABEL[shown]} (değiştirmek için tıklayın)`}
      aria-label={`${LABEL[shown]}; değiştir`}
      className={`inline-flex items-center gap-1.5 rounded-md text-lead hover:text-graphite ${withLabel ? "" : "size-8 justify-center"} ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {shown === "light" && (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
          </>
        )}
        {shown === "dark" && <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" strokeLinejoin="round" />}
        {shown === "system" && (
          <>
            <circle cx="8" cy="8" r="6" />
            <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
      {withLabel && <span>{LABEL[shown]}</span>}
    </button>
  );
}
