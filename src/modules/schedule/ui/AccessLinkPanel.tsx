"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Öğretmenin kişisel giriş linki: oluştur, kopyala, WhatsApp ile gönder, yenile, kaldır.
 * Link, sahibinin anahtarıdır; yenilenince eski link ve açık oturumlar geçersiz olur.
 */
export default function AccessLinkPanel({ teacherId, name, link }: { teacherId: string; name: string; link: { token: string; lastUsedAt: string | null } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = (t: string) => `${window.location.origin}/o/${t}`;

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/kurum/ogretmenler/${teacherId}/link`, { method });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "İşlem başarısız.");
    router.refresh();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(url(link.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Linki kopyalayın:", url(link.token));
    }
  }

  function whatsapp() {
    if (!link) return;
    const text = `Merhaba ${name}, ders girişleriniz için kişisel bağlantınız (kimseyle paylaşmayın):\n${url(link.token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (!link) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary py-1" disabled={busy} onClick={() => send("POST")}>Link oluştur</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-secondary py-1" onClick={copy}>{copied ? "Kopyalandı" : "Kopyala"}</button>
      <button className="btn-secondary py-1" onClick={whatsapp}>WhatsApp</button>
      <button
        className="text-sm text-lead hover:text-graphite"
        disabled={busy}
        onClick={() => confirm(`${name} için yeni link oluşturulsun mu? Eski link çalışmaz olur.`) && send("POST")}
      >
        Yenile
      </button>
      <button
        className="text-sm text-lead/70 hover:text-red-600"
        disabled={busy}
        onClick={() => confirm(`${name} için link kaldırılsın mı? Açık oturumu da kapanır.`) && send("DELETE")}
      >
        Kaldır
      </button>
      <span className="text-[12.5px] text-lead">
        {link.lastUsedAt ? `Son giriş ${new Date(link.lastUsedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}` : "Henüz kullanılmadı"}
      </span>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
