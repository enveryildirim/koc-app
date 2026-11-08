"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Topic = { id: string; topic: string; unit?: string; doneDate: string | null; state: "done" | "late" | "current" | "upcoming" };

/** Yoklama ekranında: bu derste işlenen konuları yıllık plandan işaretleme. */
/** `planLink`: yıllık plan bağlantısı (öğretmen ekranında yok; plan sayfası yönetim panelindedir). */
export default function LessonTopics({ planId, items, date, sessionId, planLink = true }: { planId: string; items: Topic[]; date: string; sessionId: string | null; planLink?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(t: Topic) {
    setPending(t.id);
    const res = await fetch(`/api/kurum/plan/konu/${t.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.doneDate, date, sessionId }),
    });
    setPending(null);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
    router.refresh();
  }

  return (
    <div className="card mb-6 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Bu derste işlenen konu</h3>
        {planLink && <Link href={`/kurum/takvim/plan/${planId}`} className="text-sm text-brand-700 hover:underline">Konu takibi</Link>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-lead">Plandaki tüm konular işlendi.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ${
                t.doneDate ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : t.state === "late" ? "ring-red-200" : t.state === "current" ? "ring-brand-300" : "ring-rule"
              }`}
            >
              <input type="checkbox" checked={!!t.doneDate} disabled={pending === t.id} onChange={() => toggle(t)} className="accent-emerald-600" />
              {t.unit && <span className="text-xs text-lead">{t.unit} ·</span>}
              {t.topic}
              {!t.doneDate && t.state === "late" && <span className="text-xs text-red-600">gecikti</span>}
              {!t.doneDate && t.state === "current" && <span className="text-xs text-brand-600">bu hafta</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
