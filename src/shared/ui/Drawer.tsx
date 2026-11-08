"use client";
import { useEffect, useRef } from "react";

/**
 * Yan panel: listeden ayrılmadan kayıt ekleme / düzenleme.
 * Masaüstünde sağdan açılır (liste arkada görünür kalır), telefonda tam ekran.
 * Esc ya da arka plana tıklama kapatır; açılınca paneldeki ilk alana odaklanır.
 * Yönetim ekranlarındaki ortak ekleme kalıbı: başlıkta "+ Ekle" → panel → Kaydet → listede yeni satır vurgulanır.
 */
export default function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Altta sabit düğmeler (Kaydet, Kaydet ve yenisini ekle, Vazgeç) */
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // onClose her çizimde yeni olabilir; etki yalnızca açılıp kapanınca çalışsın (odak her tuşta başa dönmesin)
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full flex-col bg-surface shadow-xl sm:max-w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="rounded p-1 text-lead hover:bg-paper hover:text-graphite" onClick={onClose} aria-label="Kapat">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-rule px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
