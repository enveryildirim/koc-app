/** Kurum sayfalarında ortak kullanılan küçük sunucu bileşenleri. */
import Link from "next/link";

export function PageHeader({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  /* Sıkı başlık: geri bağlantısı, başlık ve açıklama tek satırda; eylemler sağda. */
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {back && (
          <Link href={back.href} className="inline-flex items-center gap-0.5 self-center text-[13px] text-lead hover:text-graphite" title={back.label}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
            <span aria-hidden="true" className="ml-2 h-4 w-px bg-rule" />
          </Link>
        )}
        <h1 className="text-[1.45rem] leading-tight font-semibold">{title}</h1>
        {sub && <p className="max-w-[70ch] text-[13.5px] text-lead">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Özet sayısı: sakin hücre. Geniş ekranda tek satır (sayı solda, etiket yanında);
 * telefonda dar sütunda etiket kesilmesin diye sayı üstte, etiket ve açıklama altında.
 */
export function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md bg-surface px-3 py-2 ring-1 ring-rule sm:flex-row sm:items-center sm:gap-3">
      <div className="num font-display text-[1.4rem] leading-none font-semibold [font-stretch:85%]">{value}</div>
      <div className="min-w-0 sm:border-l sm:border-rule sm:pl-3">
        <div className="text-[13px] leading-tight font-semibold sm:truncate">{label}</div>
        {hint && <div className="text-xs leading-snug text-lead sm:truncate" title={typeof hint === "string" ? hint : undefined}>{hint}</div>}
      </div>
    </div>
  );
}

/** Boş durum: doldurulmayı bekleyen form alanı gibi kesik çizgili kutu. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-lead/40 px-6 py-8 text-center text-sm text-lead">{children}</div>;
}

/** Sunucu bileşenlerinde kullanılabilen sekme çubuğu (aktif sekme parametreyle verilir). */
export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-1 text-[13.5px] ${
            t.key === active ? "bg-graphite font-semibold text-surface" : "text-lead hover:bg-surface hover:text-graphite"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const th = "px-3 py-1.5 text-left text-[12.5px] font-semibold text-lead";
export const td = "px-3 py-1.5";
