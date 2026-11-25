"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const DEMO = { email: "demo@sinavkur.com", password: "demo1234" };

/** `demo`: "Demo hesabıyla gir" düğmesi; `registration`: kayıt bağlantısı. Sunucu ayarlarından gelir (identity > config). */
export default function AuthForm({ mode, demo, registration }: { mode: "login" | "register"; demo: boolean; registration: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(() =>
    params.get("link") === "gecersiz" ? "Giriş linki geçersiz ya da yenilenmiş. Yöneticinizden yeni link isteyin." : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(data: typeof form) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Bir hata oluştu.");
    router.push("/kurum");
    router.refresh();
  }

  useEffect(() => {
    if (mode === "login" && demo && params.get("demo")) submit({ name: "", ...DEMO });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{mode === "login" ? "Giriş yap" : "Hesap oluştur"}</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(form);
          }}
        >
          {mode === "register" && (
            <div>
              <label className="label">Kurum adı</label>
              <input className="input" placeholder="ör. Başarı Akademi" value={form.name} onChange={set("name")} required />
            </div>
          )}
          <div>
            <label className="label">E-posta</label>
            <input className="input" type="email" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <label className="label">Şifre</label>
            <input className="input" type="password" value={form.password} onChange={set("password")} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Lütfen bekleyin…" : mode === "login" ? "Giriş yap" : "Kayıt ol"}
          </button>
        </form>
        {mode === "login" && demo && (
          <button className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => submit({ name: "", ...DEMO })}>
            Demo hesabıyla gir
          </button>
        )}
        {(mode === "register" || registration) && (
        <p className="mt-6 text-center text-sm text-lead">
          {mode === "login" ? (
            <>Hesabınız yok mu? <Link className="font-semibold text-brand-600" href="/kayit">Kayıt olun</Link></>
          ) : (
            <>Zaten üye misiniz? <Link className="font-semibold text-brand-600" href="/giris">Giriş yapın</Link></>
          )}
        </p>
        )}
      </div>
    </div>
  );
}
