"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Filter = { name: string; label: string; options: { value: string; label: string }[] };

/** URL arama parametrelerini değiştiren seçim kutuları. */
export default function FilterBar({ filters }: { filters: Filter[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <select
          key={f.name}
          aria-label={f.label}
          className="input w-auto"
          value={params.get(f.name) ?? ""}
          onChange={(e) => {
            const p = new URLSearchParams(params.toString());
            if (e.target.value) p.set(f.name, e.target.value);
            else p.delete(f.name);
            router.push(`${path}${p.size ? `?${p}` : ""}`);
          }}
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}
