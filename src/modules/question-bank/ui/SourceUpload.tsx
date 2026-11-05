"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIMITS } from "../index";

/** Kaynak yükleme: tek PDF ya da bir veya daha çok resim. Yükleme bitince kesme ekranına geçer. */
export default function SourceUpload() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return setErr("Dosya seçin.");
    setBusy(true);
    setErr("");
    const form = new FormData();
    form.set("name", name);
    // Resimler dosya adına göre sıralanır (telefon fotoğrafları çekim sırasıyla adlanır).
    [...files].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true })).forEach((f) => form.append("files", f));
    const res = await fetch("/api/kurum/soru-havuzu/kaynaklar", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setErr(json.error ?? "Yüklenemedi.");
    }
    router.push(`/kurum/soru-havuzu/kes/${json.id}`);
  }

  return (
    <form onSubmit={submit} className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-3">
      <label className="min-w-56 flex-1">
        <span className="label">Kaynak adı</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. TYT Matematik Fasikül 3 (boşsa dosya adı)" />
      </label>
      <label className="min-w-56 flex-1">
        <span className="label">Dosya</span>
        <input
          type="file"
          className="input py-1"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          multiple
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
        />
      </label>
      <button className="btn-primary" disabled={busy}>{busy ? "Yükleniyor…" : "Yükle ve kesmeye başla"}</button>
      <p className="w-full text-xs text-lead">
        Tek PDF (en fazla {LIMITS.sourceMB} MB) ya da birden çok sayfa fotoğrafı (her biri en fazla {LIMITS.imageMB} MB) yükleyebilirsiniz. Fotoğraflar dosya adına göre sıralanır.
      </p>
      {err && <p className="w-full text-sm text-red-700">{err}</p>}
    </form>
  );
}
