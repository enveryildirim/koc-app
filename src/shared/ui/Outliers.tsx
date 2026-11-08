import Link from "next/link";
import { OUTLIER_MIN_N } from "@/shared/stats";

/**
 * "Uç değerleri ayır" düğmesi. Bağlantıdır (adresteki uc=1); sayfa sunucuda yeniden hesaplanır.
 * Varsayılan kapalı: kullanıcı ne gördüğünü bilsin.
 */
export function OutlierToggle({ on, href }: { on: boolean; href: string }) {
  return (
    <Link
      href={href}
      role="switch"
      aria-checked={on}
      title={`Grubun genelinden belirgin şekilde ayrılan sonuçlar (kutu grafiği kuralı) ortalamaya katılmaz. ${OUTLIER_MIN_N} kişiden az grupta uygulanmaz. Öğrenciler silinmez, ayrıca listelenir.`}
      className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium ring-1 ring-rule hover:bg-paper"
    >
      <span className={`relative inline-block h-4 w-7 rounded-full transition-colors ${on ? "bg-graphite" : "bg-mist"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      Uç değerleri ayır
    </Link>
  );
}

export type OutlierItem = { key: string; name: string; sub?: string; value: string; dir: "low" | "high"; href?: string };

/**
 * Ortalamadan ayrılan öğrenciler: kaybolmasınlar diye ayrı kutuda. Çok düşükler üstte (takip edilmesi gerekenler).
 * Bir kısmı giriş hatası olabilir (ör. yanlış kitapçık); "kontrol et" bağlantısı sonuca götürür.
 */
export function OutlierBox({ items, title = "Uç değerler", note }: { items: OutlierItem[]; title?: string; note?: React.ReactNode }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => (a.dir === b.dir ? 0 : a.dir === "low" ? -1 : 1));
  return (
    <section className="card mt-4">
      <div className="border-b border-rule/70 px-4 py-2.5">
        <h2 className="font-semibold">{title} ({items.length})</h2>
        <p className="text-[13px] text-lead">
          Bu sonuçlar ortalamaya katılmadı. Çok düşük sonuçlar yanlış kitapçık ya da okuma hatası olabilir; önce sonucu kontrol edin.
          {note ? <> {note}</> : null}
        </p>
      </div>
      <ul className="divide-y divide-rule/70">
        {sorted.map((o) => (
          <li key={o.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <span className={`w-24 shrink-0 text-[12.5px] font-semibold ${o.dir === "low" ? "text-red-600" : "text-emerald-700"}`}>
              {o.dir === "low" ? "↓ Çok düşük" : "↑ Çok yüksek"}
            </span>
            <span className="min-w-[11rem] flex-1">
              <span className="font-medium">{o.name}</span>
              {o.sub && <span className="text-lead"> · {o.sub}</span>}
            </span>
            <span className="num font-semibold tabular-nums">{o.value}</span>
            {o.href && <Link href={o.href} className="text-[13px] text-brand-600 hover:underline">Sonucu kontrol et</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sayfa adresine uc=1 ekler ya da çıkarır (diğer parametreler korunur). */
export function withOutliers(href: string, on: boolean) {
  const [path, q = ""] = href.split("?");
  const s = new URLSearchParams(q);
  if (on) s.set("uc", "1");
  else s.delete("uc");
  const qs = s.toString();
  return qs ? `${path}?${qs}` : path;
}
