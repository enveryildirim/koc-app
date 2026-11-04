"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTopicSpec, LETTERS, makeBooklet, maxScore, parseTopicSpec, randomKey, resolveScoring, Scoring } from "@/lib/exam";

type Sec = { name: string; count: number; keyA: string; keyB: string; topics?: string[]; bOrder?: number[] };
type Init = { name: string; date: string; bookletB: boolean; wrongPer: number; sections: Sec[] };

export default function KeyEditor({
  examId,
  type,
  initial,
  scoring: initialScoring,
  choices,
  hasResults,
}: {
  examId: string;
  type: string;
  initial: Init;
  scoring: Scoring;
  choices: number;
  hasResults: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [scoring, setScoring] = useState<Scoring>(initialScoring);
  // Konu ve eşleme metinleri (düzenlenirken serbest metin, kaydederken çözümlenir)
  const [topicText, setTopicText] = useState(initial.sections.map((s) => formatTopicSpec(s.topics)));
  const [orderText, setOrderText] = useState(initial.sections.map((s) => (s.bOrder ?? []).map((i) => i + 1).join(" ")));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = LETTERS.slice(0, choices);

  const setSec = (i: number, p: Partial<Sec>) => setV({ ...v, sections: v.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const clean = (k: string) => k.toUpperCase().replace(/[^A-E]/g, "");
  const setAt = <T,>(arr: T[], i: number, val: T) => arr.map((x, j) => (j === i ? val : x));

  function parseOrder(text: string, count: number): number[] | undefined | null {
    const nums = text.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (nums.length === 0) return undefined;
    if (nums.length !== count || new Set(nums).size !== count || nums.some((n) => !Number.isInteger(n) || n < 1 || n > count)) return null;
    return nums.map((n) => n - 1);
  }

  async function save() {
    setMsg(null);
    const sections: Sec[] = [];
    for (const [i, s] of v.sections.entries()) {
      const t = parseTopicSpec(topicText[i] ?? "", s.count);
      if (t.errors.length) return setMsg({ ok: false, text: `${s.name} konuları: ${t.errors[0]}` });
      const bOrder = v.bookletB ? parseOrder(orderText[i] ?? "", s.count) : undefined;
      if (bOrder === null) return setMsg({ ok: false, text: `${s.name}: B eşlemesi 1–${s.count} arası her soru numarasını bir kez içermeli.` });
      sections.push({ ...s, topics: t.topics, bOrder });
    }
    setBusy(true);
    const res = await fetch(`/api/kurum/denemeler/${examId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, sections, scoring }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    setMsg({ ok: true, text: hasResults ? "Kaydedildi; tüm sonuçlar ve puanlar yeniden hesaplandı." : "Kaydedildi." });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Deneme ve tüm sonuçları silinsin mi?")) return;
    await fetch(`/api/kurum/denemeler/${examId}`, { method: "DELETE" });
    router.push("/kurum/denemeler");
    router.refresh();
  }

  function addSection() {
    setV({ ...v, sections: [...v.sections, { name: "Yeni bölüm", count: 10, keyA: "", keyB: "" }] });
    setTopicText([...topicText, ""]);
    setOrderText([...orderText, ""]);
    setScoring({ ...scoring, coefs: [...scoring.coefs, 1] });
  }
  function removeSection(i: number) {
    setV({ ...v, sections: v.sections.filter((_, j) => j !== i) });
    setTopicText(topicText.filter((_, j) => j !== i));
    setOrderText(orderText.filter((_, j) => j !== i));
    setScoring({ ...scoring, coefs: scoring.coefs.filter((_, j) => j !== i) });
  }

  const max = maxScore(v.sections, scoring);

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Sınav adı</label>
          <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tarih</label>
          <input type="date" className="input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </div>
        <div>
          <label className="label">Kaç yanlış 1 doğruyu götürür</label>
          <input type="number" min={0} max={10} className="input" value={v.wrongPer} onChange={(e) => setV({ ...v, wrongPer: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" checked={v.bookletB} onChange={(e) => setV({ ...v, bookletB: e.target.checked })} className="accent-brand-600" />
          B kitapçığı var (optik formda kitapçık türü alanı çıkar)
        </label>
      </div>

      {v.sections.map((s, i) => {
        const keys = v.bookletB ? (["keyA", "keyB"] as const) : (["keyA"] as const);
        const parsedTopics = parseTopicSpec(topicText[i] ?? "", s.count);
        const covered = parsedTopics.topics.filter(Boolean).length;
        return (
          <div key={i} className="card p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="label">Bölüm adı</label>
                <input className="input" value={s.name} onChange={(e) => setSec(i, { name: e.target.value })} />
              </div>
              <div className="w-28">
                <label className="label">Soru sayısı</label>
                <input type="number" min={1} max={120} className="input" value={s.count} onChange={(e) => setSec(i, { count: Number(e.target.value) })} />
              </div>
              {v.sections.length > 1 && <button className="btn-danger" onClick={() => removeSection(i)}>Bölümü sil</button>}
            </div>
            {keys.map((k) => {
              const val = s[k];
              const bad = val.split("").some((ch) => !allowed.includes(ch));
              return (
                <div key={k} className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="label mb-0">{k === "keyA" ? "A kitapçığı" : "B kitapçığı"} cevap anahtarı</label>
                    <div className="flex gap-3 text-xs">
                      <span className={val.length === s.count && !bad ? "text-emerald-700" : "text-amber-700"}>
                        {val.length}/{s.count} {bad && `· yalnızca ${allowed} kullanılabilir`}
                      </span>
                      {k === "keyB" && s.keyA.length === s.count && (
                        <button
                          className="font-medium text-brand-600"
                          title="Soruları karıştırarak B kitapçığı anahtarı ve soru eşlemesi üretir"
                          onClick={() => {
                            const b = makeBooklet(s.keyA, Date.now() % 100000);
                            setSec(i, { keyB: b.keyB });
                            setOrderText(setAt(orderText, i, b.bOrder.map((x) => x + 1).join(" ")));
                          }}
                        >
                          A’dan karıştır (+eşleme)
                        </button>
                      )}
                      <button className="font-medium text-brand-600" onClick={() => setSec(i, { [k]: randomKey(s.count, choices) })}>🧪 Rastgele doldur</button>
                    </div>
                  </div>
                  <input
                    className="input mt-1 font-mono tracking-[0.3em]"
                    placeholder={"ör. " + "ABCD".repeat(3)}
                    value={val}
                    maxLength={s.count}
                    onChange={(e) => setSec(i, { [k]: clean(e.target.value) })}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from({ length: s.count }, (_, q) => (
                      <span key={q} className="flex w-9 flex-col items-center rounded bg-slate-50 py-0.5 text-[10px] text-slate-400">
                        {q + 1}
                        <b className={`text-sm ${val[q] ? "text-slate-800" : "text-slate-300"}`}>{val[q] ?? "·"}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            <details className="mt-4 rounded-lg bg-slate-50 p-3" open={covered > 0}>
              <summary className="cursor-pointer text-sm font-medium">
                Konular / kazanımlar{" "}
                <span className={`text-xs ${covered === s.count ? "text-emerald-700" : "text-slate-500"}`}>({covered}/{s.count} soruya konu atandı)</span>
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Her satıra <b>soru aralığı: konu</b> yazın (A kitapçığı numaralarıyla), ör. <code>1-4: Üslü ifadeler</code> veya <code>7: Olasılık</code>.
                Konu analizi ve karnelerdeki konu başarısı bu bilgiyle hesaplanır.
              </p>
              <textarea
                className="input mt-2 font-mono text-xs"
                rows={4}
                value={topicText[i] ?? ""}
                placeholder={"1-5: Sözcükte anlam\n6-12: Paragraf"}
                onChange={(e) => setTopicText(setAt(topicText, i, e.target.value))}
              />
              {parsedTopics.errors.length > 0 && <p className="mt-1 text-xs text-red-600">{parsedTopics.errors[0]}</p>}
              {v.bookletB && (
                <>
                  <label className="label mt-3 text-xs">B kitapçığı soru eşlemesi (isteğe bağlı)</label>
                  <p className="text-xs text-slate-500">
                    B’deki 1., 2., 3. … sorunun A kitapçığındaki numarası, boşlukla ayrılmış. Girilmezse B kitapçıklı öğrenciler konu analizine katılmaz.
                  </p>
                  <input
                    className="input mt-1 font-mono text-xs"
                    value={orderText[i] ?? ""}
                    placeholder={Array.from({ length: Math.min(s.count, 8) }, (_, q) => q + 1).reverse().join(" ") + " …"}
                    onChange={(e) => setOrderText(setAt(orderText, i, e.target.value))}
                  />
                </>
              )}
            </details>
          </div>
        );
      })}

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Tahmini puan ayarları</h2>
          <button className="text-sm font-medium text-brand-600" onClick={() => setScoring(resolveScoring(type, v.sections, null))}>
            Varsayılan katsayılara dön
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Puan = taban puan + Σ (ders neti × katsayı). Varsayılanlar yaklaşık değerlerdir; resmi puan hesaplaması değildir. Kurumunuzun kullandığı katsayıları girebilirsiniz.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="label text-xs">Taban puan</label>
            <input type="number" step="0.001" className="input" value={scoring.base} onChange={(e) => setScoring({ ...scoring, base: Number(e.target.value) })} />
          </div>
          {v.sections.map((s, i) => (
            <div key={i}>
              <label className="label text-xs">{s.name} katsayısı</label>
              <input
                type="number"
                step="0.001"
                min={0}
                className="input"
                value={scoring.coefs[i] ?? 0}
                onChange={(e) => setScoring({ ...scoring, coefs: setAt(scoring.coefs, i, Number(e.target.value)) })}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">Tam net yapan öğrencinin puanı: <b>{max.toLocaleString("tr-TR")}</b></p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={addSection}>+ Bölüm ekle</button>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        <button className="btn-danger ml-auto" onClick={remove}>Denemeyi sil</button>
      </div>
      <p className="text-xs text-slate-500">
        Anahtarı yayıncının cevap anahtarından kopyalayıp yapıştırabilirsiniz; harf dışındaki karakterler otomatik temizlenir. Bölüm yapısını değiştirirseniz optik formu yeniden yazdırın.
      </p>
    </div>
  );
}
