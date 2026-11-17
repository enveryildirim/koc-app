"use client";
import { useState } from "react";
import Link from "next/link";
import { QUESTION_TYPES, SIMILAR_KINDS, type QuestionType } from "@/modules/question-bank";
import QuestionView from "@/modules/question-bank/ui/QuestionView";
import type { PracticeSuggestions } from "../internal/for-practice";

const IMG = (id: string) => `/api/kurum/soru-havuzu/sorular/${id}/gorsel`;

/**
 * Yanlış yapılan soruların benzerleri: öğretmen işaretler, seçtikleriyle çalışma kağıdı hazırlamaya geçer
 * (deneme kurma ekranı seçili sorularla açılır; orada düzenleyip kendisi oluşturur). Hiçbir şey öğrenciye kendiliğinden gitmez.
 */
export default function PracticePicker({ data, name }: { data: PracticeSuggestions; name: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const withCandidates = data.items.filter((i) => i.candidates.length);
  const without = data.items.length - withCandidates.length;
  // Her yanlış sorudan ilk (en benzer, sınıfın görmediği) aday
  const firstOfEach = () =>
    setSel(withCandidates.flatMap((i) => {
      const c = i.candidates.find((x) => !x.seen) ?? i.candidates[0];
      return c ? [c.id] : [];
    }).filter((id, k, a) => a.indexOf(id) === k));
  const href = `/kurum/denemeler/havuzdan?${new URLSearchParams({
    sec: sel.join(","),
    amac: "calisma",
    ad: name,
    ...(data.exam.courseId ? { ders: data.exam.courseId } : {}),
  })}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span>
          <b className="num">{data.items.length}</b> soru yanlış ya da boş
          {without > 0 && <span className="text-lead"> · {without} sorunun havuzda benzeri yok</span>}
        </span>
        {withCandidates.length > 0 && (
          <button type="button" className="text-[13px] text-lead hover:text-graphite" onClick={firstOfEach}>Her sorudan birini işaretle</button>
        )}
        {sel.length > 0 && <button type="button" className="text-[13px] text-lead hover:text-graphite" onClick={() => setSel([])}>Seçimi temizle</button>}
      </div>

      <ol className="space-y-3">
        {data.items.map((it) => (
          <li key={it.id} className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-1.5 text-[13px]">
              <b className="font-semibold">{it.section} {it.no}</b>
              {it.topic && <span className="min-w-0 truncate text-lead">· {it.topic}</span>}
              {data.students > 1 && <span className="ml-auto shrink-0 text-lead"><b className="num text-graphite">{it.wrong}</b> öğrenci yanlış / boş</span>}
            </div>
            <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="border-b border-rule/60 bg-mist/30 p-3 md:border-r md:border-b-0">
                <p className="mb-1 text-xs text-lead">Yanlış yapılan soru</p>
                {it.content ? (
                  <div className="max-h-56 overflow-hidden text-black">
                    <QuestionView type={it.type} content={it.content} imageSrc={it.hasImage ? IMG(it.id) : null} answer={it.answer} compact />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel
                  <img src={IMG(it.id)} alt="" loading="lazy" className="max-h-56 w-auto object-contain" />
                )}
              </div>
              <div className="p-3">
                {it.candidates.length === 0 ? (
                  <p className="text-[13px] text-lead">
                    {it.content ? "Havuzda benzeri yok." : "Kesilmiş (görsel) soru: metni olmadığı için benzeri aranamıyor."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {it.candidates.map((c) => {
                      const on = sel.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className={`flex cursor-pointer gap-2 rounded-md p-2 ring-1 ${on ? "ring-2 ring-ink" : "ring-rule"}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="mt-0.5" />
                            <span className="min-w-0 flex-1">
                              <span className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-lead">
                                <span className={`badge ${c.kind === "same" ? "bg-amber-100 text-amber-900" : "bg-mist text-graphite"}`} title={SIMILAR_KINDS[c.kind].hint}>{SIMILAR_KINDS[c.kind].label}</span>
                                {c.type !== "MC" && <span>{QUESTION_TYPES[c.type as QuestionType]?.short}</span>}
                                {c.seen ? <span className="font-semibold text-amber-700">sınıf daha önce gördü</span> : c.uses > 0 ? <span>{c.uses}× kullanıldı</span> : <span>hiç kullanılmadı</span>}
                              </span>
                              <span className="block max-h-40 overflow-hidden text-black">
                                <QuestionView type={c.type} content={{ stem: c.stem, options: c.options }} imageSrc={c.hasImage ? IMG(c.id) : null} answer={c.answer} compact />
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-rule bg-surface py-3">
        {sel.length > 0 ? (
          <Link href={href} className="btn-primary">Seçilen {sel.length} soruyla çalışma kağıdı hazırla</Link>
        ) : (
          <span className="btn-primary pointer-events-none opacity-50">Çalışma kağıdı hazırla</span>
        )}
        <span className="text-xs text-lead">Deneme kurma ekranı bu sorularla açılır; orada sırayı ve soruları düzenleyip siz oluşturursunuz. Öğrenciye kendiliğinden bir şey gitmez.</span>
      </div>
    </div>
  );
}
