/** Kurum sayfalarında ortak kullanılan küçük sunucu bileşenleri. */
import Link from "next/link";

export function PageHeader({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="no-print mb-7">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-lead hover:text-graphite">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="-ml-0.5">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-tight font-semibold">{title}</h1>
          {sub && <p className="mt-0.5 max-w-[70ch] text-[15px] text-lead">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Özet sayısı: kart değil, form başlığındaki gibi üstü çizgili bir hücre. Sayı önde, etiketi altında. */
export function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="border-t-2 border-graphite pt-2.5">
      <div className="num font-display text-[1.9rem] leading-none font-semibold [font-stretch:85%]">{value}</div>
      <div className="mt-1.5 text-sm font-semibold">{label}</div>
      {hint && <div className="mt-0.5 text-[13px] leading-snug text-lead">{hint}</div>}
    </div>
  );
}

/** Boş durum: doldurulmayı bekleyen form alanı gibi kesik çizgili kutu. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-lead/40 px-6 py-10 text-center text-[15px] text-lead">{children}</div>;
}

/** Sunucu bileşenlerinde kullanılabilen sekme çubuğu (aktif sekme parametreyle verilir). */
export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print mb-6 flex gap-5 overflow-x-auto border-b border-rule">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 py-2 text-[15px] ${
            t.key === active ? "border-graphite font-semibold text-graphite" : "border-transparent text-lead hover:text-graphite"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const th = "px-3 py-2 text-left text-[13px] font-semibold text-lead";
export const td = "px-3 py-2";
