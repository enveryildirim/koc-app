"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/shared/date";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

const API = "/api/kurum/api-anahtarlari";
// Sunucu ve tarayıcı aynı metni üretsin diye uygulamanın saat dilimiyle
const fmt = (iso: string) => fmtDateTime(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: undefined });

/** Kurum API anahtarları: oluştur (bir kez gösterilir), listele, iptal et; bağlantı komutu anahtarla birlikte hazırlanır. */
export default function ApiKeys({ keys, endpoint }: { keys: Key[]; endpoint: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState("");

  async function create() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Oluşturulamadı." });
    setFresh({ name, key: json.key });
    setName("");
    router.refresh();
  }

  async function revoke(k: Key) {
    if (!confirm(`“${k.name}” anahtarı iptal edilsin mi? Bu anahtarla bağlanan agent'lar artık havuza erişemez.`)) return;
    const res = await fetch(`${API}/${k.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "İptal edilemedi." });
    setMsg({ ok: true, text: "Anahtar iptal edildi." });
    router.refresh();
  }

  const copy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(label), () => setCopied(""));
  };
  const key = fresh?.key ?? "<ANAHTAR>";
  const commands = [
    { label: "Claude Code", text: `claude mcp add --transport http rea-question-bank ${endpoint} --header "Authorization: Bearer ${key}"` },
    {
      label: "JSON ayarı (Claude Desktop, Cursor ve diğerleri)",
      text: JSON.stringify({ mcpServers: { "rea-question-bank": { type: "http", url: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">Yeni anahtar</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1">
            <span className="label">Ad <span className="font-normal text-lead">(kim, hangi araçta kullanacak)</span></span>
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ör. Ahmet hoca · Claude Code" onKeyDown={(e) => e.key === "Enter" && !busy && create()} />
          </label>
          <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>{busy ? "Oluşturuluyor…" : "Anahtar oluştur"}</button>
        </div>
        {fresh && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950" role="status">
            <p className="font-semibold">“{fresh.name}” anahtarı oluşturuldu. Şimdi kopyalayın: bu sayfadan ayrılınca bir daha gösterilmez.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[13px] ring-1 ring-amber-200">{fresh.key}</code>
              <button type="button" className="btn-secondary py-1" onClick={() => copy("key", fresh.key)}>{copied === "key" ? "Kopyalandı" : "Kopyala"}</button>
            </div>
          </div>
        )}
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Bağlanma</h2>
        <p className="mb-2 text-sm text-lead">
          Adres: <code className="font-mono text-[13px] text-graphite">{endpoint}</code>. {fresh ? "Komutlarda yeni anahtar hazır." : "Komutta <ANAHTAR> yerine anahtarınızı yazın."}
        </p>
        <div className="space-y-3">
          {commands.map((c) => (
            <div key={c.label}>
              <div className="mb-1 flex items-center gap-2 text-xs text-lead">
                {c.label}
                <button type="button" className="ml-auto text-graphite hover:underline" onClick={() => copy(c.label, c.text)}>{copied === c.label ? "Kopyalandı" : "Kopyala"}</button>
              </div>
              <pre className="overflow-x-auto rounded-md bg-mist/60 px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap break-all">{c.text}</pre>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-lead">Uzaktan bağlantıda görseller dosya yolu olarak değil, base64 olarak gönderilir; agent bunu kendisi yapar.</p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Anahtarlar</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-lead">Henüz anahtar yok.</p>
        ) : (
          <ul className="card divide-y divide-rule/70">
            {keys.map((k) => (
              <li key={k.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm ${k.revokedAt ? "text-lead" : ""}`}>
                <span className="min-w-40 font-semibold">{k.name}</span>
                <code className="font-mono text-xs text-lead">{k.prefix}…</code>
                <span className="text-xs text-lead">oluşturuldu {fmt(k.createdAt)}</span>
                <span className="text-xs text-lead">{k.lastUsedAt ? `son kullanım ${fmt(k.lastUsedAt)}` : "hiç kullanılmadı"}</span>
                {k.revokedAt ? (
                  <span className="ml-auto text-xs">iptal edildi · {fmt(k.revokedAt)}</span>
                ) : (
                  <button type="button" className="ml-auto text-xs text-lead hover:text-red-700" onClick={() => revoke(k)}>İptal et</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
