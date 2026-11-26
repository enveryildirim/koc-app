"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ANSWERS, answerLabel, DIFFICULTY, isOptical, opticalLetter, OPTION_LETTERS, QUESTION_TYPES, SIMILAR_KINDS, type QuestionContent, type QuestionType, type SimilarKind } from "@/modules/question-bank";
import QuestionView from "@/modules/question-bank/ui/QuestionView";
import { subjectMatches } from "@/shared/subjects";
import { toInputDate } from "@/shared/date";
import { choicesFor, EXAM_TYPES, LETTERS } from "../domain";

type Item = {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  difficulty: number;
  answer: string;
  type: string;
  content: QuestionContent | null;
  hasImage: boolean;
  /** Kaç sınav / çalışma kağıdında kullanıldı ve hangi sınıflar gördü (denemelerden hesaplanır) */
  uses: number;
  classIds: string[];
};
type Sec = { name: string; target: number; items: string[] };
/** Soru → havuzdaki aynı / benzer sorular (iki yönlü; question-bank > similarPairs) */
type SimilarMap = Record<string, { id: string; kind: SimilarKind }[]>;

const IMG = (id: string) => `/api/kurum/soru-havuzu/sorular/${id}/gorsel`;
const PAGE = 40;

/** Soru önizlemesi: kesilmiş soruda görsel, yazılanda küçük metin görünümü. */
function Thumb({ q, className }: { q: Item; className: string }) {
  if (q.content)
    return (
      <div className={`overflow-hidden text-left text-graphite ${className}`}>
        <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? IMG(q.id) : null} compact />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel
  return <img src={IMG(q.id)} alt="" loading="lazy" className={`bg-white object-contain ${className}`} />;
}

const templateOf = (type: string): Sec[] => EXAM_TYPES[type].sections.map((s) => ({ name: s.name, target: type === "SERBEST" ? 0 : s.count, items: [] }));

function shuffle<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Havuzdan deneme kurma: bölüm seç, havuzdan soru ekle (elle ya da zorluk dağılımıyla rastgele), sırala, oluştur. */
type CourseOpt = { id: string; label: string; classroomId: string; classroomName: string };

export default function BankExamBuilder({
  items: initial,
  similar = {},
  courses = [],
  initialCourse = "",
  preset,
  edit,
}: {
  items: Item[];
  similar?: SimilarMap;
  /** Hazır seçim (ör. yanlışlara benzer sorular): ilk bölüme eklenir; worksheet ise çalışma kağıdı olarak açılır */
  preset?: { items: string[]; name: string; worksheet: boolean };
  courses?: CourseOpt[];
  initialCourse?: string;
  /** Var olan denemenin sorularını düzenleme: bilgileri ve bölümleriyle açılır, kaydedince deneme güncellenir */
  edit?: { id: string; name: string; type: string; date: string; booklets: number; purpose: string; courseId: string; sections: { name: string; items: string[] }[] };
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const byId = useMemo(() => new Map(items.map((q) => [q.id, q])), [items]);
  const subjects = useMemo(() => [...new Set(items.map((q) => q.subject))].sort((a, b) => a.localeCompare(b, "tr")), [items]);

  const [meta, setMeta] = useState(
    edit
      ? { name: edit.name, type: edit.type, date: edit.date, booklets: edit.booklets, purpose: edit.purpose, courseId: edit.courseId }
      : {
          name: preset?.name ?? "",
          type: "SERBEST",
          date: toInputDate(new Date()),
          booklets: preset?.worksheet ? 1 : 2,
          purpose: preset?.worksheet ? "WORKSHEET" : "EXAM",
          courseId: initialCourse,
        },
  );
  const worksheet = meta.purpose === "WORKSHEET";
  const [secs, setSecs] = useState<Sec[]>(() =>
    edit
      ? edit.sections.map((x, i) => ({ name: x.name, target: edit.type === "SERBEST" ? 0 : (templateOf(edit.type)[i]?.target ?? 0), items: x.items }))
      : templateOf("SERBEST").map((x, i) => (i === 0 && preset?.items.length ? { ...x, items: preset.items } : x)),
  );
  const [active, setActive] = useState(0);
  const [f, setF] = useState({ subject: "", topic: "", difficulty: "", unused: false, unseen: true });
  // Derse bağlı sınavda o sınıfın daha önce gördüğü sorular varsayılan olarak gizlenir
  const course = courses.find((c) => c.id === meta.courseId);
  const room = course?.classroomId ?? "";
  const [shown, setShown] = useState(PAGE);
  const [mix, setMix] = useState({ 1: 0, 2: 0, 3: 0 } as Record<number, number>);
  const [busy, setBusy] = useState(false);
  /** Oluşturulan sınav: yönlendirme gecikirse (ör. geliştirme sunucusu sayfayı derlerken) bağlantı da gösterilir */
  const [created, setCreated] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sec = secs[active] ?? secs[0];
  const chosen = useMemo(() => new Set(secs.flatMap((s) => s.items)), [secs]);
  const allowed = LETTERS.slice(0, choicesFor(meta.type));
  // Seçilen sorunun denemedeki yeri ("Matematik 3") ve aynı denemedeki aynı / benzer soruları
  const where = useMemo(() => new Map(secs.flatMap((s) => s.items.map((id, i) => [id, `${s.name} ${i + 1}`] as const))), [secs]);
  const clashes = (id: string) => (similar[id] ?? []).filter((h) => h.id !== id && chosen.has(h.id));
  const nearChosen = (id: string) => {
    const c = clashes(id);
    return c.find((h) => h.kind === "same") ?? c[0];
  };
  // Çiftler bir kez sayılır
  const pairs = useMemo(() => {
    const seen = new Set<string>();
    const out = { same: 0, sibling: 0 };
    for (const id of chosen)
      for (const h of similar[id] ?? []) {
        const k = [id, h.id].sort().join("|");
        if (h.id === id || !chosen.has(h.id) || seen.has(k)) continue;
        seen.add(k);
        out[h.kind]++;
      }
    return out;
  }, [chosen, similar]);

  // Ders filtresi boşsa bölüm adına uyan dersler; hiçbiri uymuyorsa tüm havuz.
  const pool = useMemo(() => {
    const fits = (q: Item) =>
      !chosen.has(q.id) &&
      (worksheet || isOptical(q.type)) &&
      (!f.topic || q.topic === f.topic) &&
      (!f.difficulty || q.difficulty === Number(f.difficulty)) &&
      (!f.unused || q.uses === 0) &&
      (!room || !f.unseen || !q.classIds.includes(room));
    const bySubject = f.subject ? items.filter((q) => q.subject === f.subject) : items.filter((q) => subjectMatches(sec.name, q.subject));
    return (f.subject || bySubject.length ? bySubject : items).filter(fits);
  }, [items, f, chosen, sec.name, worksheet, room]);
  const seenByRoom = room ? items.filter((q) => !chosen.has(q.id) && q.classIds.includes(room)).length : 0;
  // Sınavda optikle okunamayan sorular havuzda gösterilmez; kaç tane olduğu söylenir
  const hiddenOpen = worksheet ? 0 : items.filter((q) => !isOptical(q.type)).length;
  const topicChoices = useMemo(
    () => [...new Set(items.filter((q) => !f.subject || q.subject === f.subject).map((q) => q.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [items, f.subject],
  );

  const setSec = (fn: (s: Sec) => Sec) => setSecs((l) => l.map((s, i) => (i === active ? fn(s) : s)));
  const add = (ids: string[]) => setSec((s) => ({ ...s, items: [...s.items, ...ids.filter((id) => !s.items.includes(id))] }));
  const move = (i: number, d: number) =>
    setSec((s) => {
      const l = [...s.items];
      const j = i + d;
      if (j < 0 || j >= l.length) return s;
      [l[i], l[j]] = [l[j], l[i]];
      return { ...s, items: l };
    });

  function changeType(type: string) {
    if (chosen.size && !confirm("Sınav türü değişirse bölümler ve seçilen sorular sıfırlanır. Devam edilsin mi?")) return;
    setMeta({ ...meta, type });
    setSecs(templateOf(type));
    setActive(0);
  }

  /** Zorluk dağılımıyla rastgele seçim; önce hiç kullanılmamış sorular. */
  function randomFill() {
    const picked: string[] = [];
    const short: string[] = [];
    for (const d of [1, 2, 3]) {
      const want = mix[d] || 0;
      if (!want) continue;
      // Seçilmiş sorulara ve bu seferde seçilenlere aynı / benzer olan sorular alınmaz
      const cand = shuffle(pool.filter((q) => q.difficulty === d)).sort((a, b) => a.uses - b.uses);
      let got = 0;
      for (const q of cand) {
        if (got === want) break;
        if ((similar[q.id] ?? []).some((h) => chosen.has(h.id) || picked.includes(h.id))) continue;
        picked.push(q.id);
        got++;
      }
      if (got < want) short.push(`${DIFFICULTY[d].toLocaleLowerCase("tr")} ${want - got}`);
    }
    if (!picked.length) return setMsg({ ok: false, text: "Filtreye uyan soru yok ya da adet girilmedi." });
    add(picked);
    setMsg(short.length ? { ok: false, text: `${picked.length} soru eklendi; yetmeyen: ${short.join(", ")}.` } : { ok: true, text: `${picked.length} soru eklendi.` });
  }

  async function setAnswer(id: string, answer: string) {
    const res = await fetch("/api/kurum/soru-havuzu/sorular", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], set: { answer } }),
    });
    if (res.ok) setItems((l) => l.map((q) => (q.id === id ? { ...q, answer } : q)));
  }

  /** Sorunun sorunu (yoksa ""). Çalışma kağıdında cevap zorunlu değil; anahtar isteğe bağlı yazdırılır. */
  const issueOf = (q: Item | undefined) => {
    if (!q) return "";
    if (worksheet) return "";
    if (!isOptical(q.type)) return `${QUESTION_TYPES[q.type as QuestionType]?.label ?? q.type} optikle okunamaz`;
    if ((q.content?.options?.length ?? 0) > allowed.length) return `${q.content!.options!.length} şık var, bu türde ${allowed.length}`;
    const k = opticalLetter(q.type, q.answer);
    if (!k) return "cevap yok";
    if (!allowed.includes(k)) return `${k} şıkkı ${EXAM_TYPES[meta.type].label} türünde yok`;
    return "";
  };
  const problems = secs.flatMap((s) =>
    s.items.flatMap((id, i) => {
      const p = issueOf(byId.get(id));
      return p ? [`${s.name} ${i + 1}: ${p}`] : [];
    }),
  );
  const total = chosen.size;

  async function create() {
    if (!meta.name.trim()) return setMsg({ ok: false, text: worksheet ? "Çalışma kağıdına ad verin." : "Deneme adı girin." });
    if (!total) return setMsg({ ok: false, text: "Bölümlere soru ekleyin." });
    if (problems.length) return setMsg({ ok: false, text: `Önce şunları düzeltin: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""}` });
    if (pairs.same && !confirm(`Bu ${worksheet ? "çalışma kağıdında" : "denemede"} ${pairs.same} çift aynı soru var (işaretli sorular). Yine de ${edit ? "kaydedilsin" : "oluşturulsun"} mi?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(edit ? `/api/kurum/denemeler/${edit.id}/sorular` : "/api/kurum/denemeler/havuzdan", {
      method: edit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, courseId: meta.courseId || null, sections: secs.map((s) => ({ name: s.name, items: s.items })) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setMsg({ ok: false, text: json.error ?? (edit ? "Kaydedilemedi." : "Oluşturulamadı.") });
    }
    if (edit) {
      setMsg({ ok: true, text: "Kaydedildi; deneme açılıyor…" });
      return router.push(`/kurum/denemeler/${edit.id}`);
    }
    setCreated(json.id);
    setMsg({ ok: true, text: worksheet ? "Çalışma kağıdı oluşturuldu; kitapçık açılıyor…" : "Sınav oluşturuldu; kitapçık açılıyor…" });
    router.push(`/kurum/denemeler/${json.id}/kitapcik`);
  }

  return (
    <div>
      {/* Deneme bilgileri */}
      <div className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="w-full">
          <span className="label">Ne hazırlıyorsunuz?</span>
          <div className="flex flex-wrap gap-1.5">
            {[["EXAM", "Sınav / deneme (puanlanır)"], ["WORKSHEET", "Çalışma kağıdı (puanlanmaz, yalnızca yazdırılır)"]].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMeta({ ...meta, purpose: k, booklets: k === "WORKSHEET" ? 1 : meta.booklets })}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${meta.purpose === k ? "bg-graphite text-surface" : "ring-1 ring-rule"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {courses.length > 0 && (
          <label>
            <span className="label">Ders <span className="font-normal text-lead">(hocanın sınavı)</span></span>
            <select className="input" value={meta.courseId} onChange={(e) => setMeta({ ...meta, courseId: e.target.value })}>
              <option value="">— Kurum denemesi —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-56 flex-1">
          <span className="label">{worksheet ? "Çalışma kağıdı adı" : "Deneme adı"}</span>
          <input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Ör. 8. sınıf Kasım kurum denemesi" />
        </label>
        <label>
          <span className="label">Tür</span>
          <select className="input" value={meta.type} onChange={(e) => changeType(e.target.value)}>
            {Object.entries(EXAM_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Tarih</span>
          <input type="date" className="input" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
        </label>
        <label>
          <span className="label">Kitapçık</span>
          <select className="input" value={meta.booklets} onChange={(e) => setMeta({ ...meta, booklets: Number(e.target.value) })} title="A dışındaki kitapçıklarda sorular bölüm içinde karıştırılır">
            <option value={1}>Tek kitapçık</option>
            <option value={2}>A, B</option>
            <option value={3}>A, B, C</option>
            <option value={4}>A, B, C, D</option>
          </select>
        </label>
      </div>

      {/* Bölümler */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {secs.map((s, i) => {
          const full = s.target && s.items.length === s.target;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-current={i === active ? "true" : undefined}
              className={`rounded-md px-3 py-1 text-[13.5px] ${i === active ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"}`}
            >
              {s.name} <span className={`num ${i === active ? "" : full ? "text-emerald-700" : ""}`}>{s.items.length}{s.target ? `/${s.target}` : ""}</span>
            </button>
          );
        })}
        {meta.type === "SERBEST" && (
          <button className="px-2 text-[13px] text-lead hover:text-graphite" onClick={() => { setSecs([...secs, { name: "Yeni bölüm", target: 0, items: [] }]); setActive(secs.length); }}>
            + Bölüm
          </button>
        )}
        <span className="num ml-auto text-[13px] text-lead">Toplam {total} soru</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Havuz */}
        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">Havuz <span className="font-normal text-lead">({pool.length})</span></h2>
            {hiddenOpen > 0 && <span className="w-full text-xs text-lead order-last">{hiddenOpen} açık uçlu / boşluk doldurma soru optikle okunamadığı için gösterilmiyor; çalışma kağıdında kullanılabilir.</span>}
            <select className="input w-auto" value={f.subject} onChange={(e) => { setF({ ...f, subject: e.target.value, topic: "" }); setShown(PAGE); }} aria-label="Ders">
              <option value="">Bölüme uyan dersler</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input w-auto max-w-44" value={f.topic} onChange={(e) => { setF({ ...f, topic: e.target.value }); setShown(PAGE); }} aria-label="Konu">
              <option value="">Tüm konular</option>
              {topicChoices.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input w-auto" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} aria-label="Zorluk">
              <option value="">Her zorluk</option>
              {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={f.unused} onChange={(e) => setF({ ...f, unused: e.target.checked })} />
              Kullanılmamış
            </label>
            {room && (
              <label className="flex items-center gap-1.5 text-[13px]" title={`${course!.classroomName} sınıfının daha önceki sınav ya da çalışma kağıtlarında gördüğü sorular`}>
                <input type="checkbox" checked={f.unseen} onChange={(e) => setF({ ...f, unseen: e.target.checked })} />
                {course!.classroomName} görmedi{seenByRoom > 0 && f.unseen ? <span className="text-lead"> ({seenByRoom} gizli)</span> : null}
              </label>
            )}
          </div>

          <div className="card mb-3 flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
            <span className="font-semibold">Rastgele ekle:</span>
            {[1, 2, 3].map((d) => (
              <label key={d} className="flex items-center gap-1">
                <input type="number" min={0} max={120} className="input w-14 px-1.5 py-0.5 text-center" value={mix[d] || ""} onChange={(e) => setMix({ ...mix, [d]: Math.max(0, Number(e.target.value) || 0) })} />
                {DIFFICULTY[d].toLocaleLowerCase("tr")}
              </label>
            ))}
            <button className="btn-secondary ml-auto py-1" onClick={randomFill}>“{sec.name}” bölümüne ekle</button>
          </div>

          {pool.length === 0 ? (
            <p className="rounded-lg border border-dashed border-lead/40 px-4 py-6 text-center text-sm text-lead">Bu filtreye uyan, seçilmemiş soru yok.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pool.slice(0, shown).map((q) => (
                <li key={q.id} className="card flex flex-col overflow-hidden">
                  <button onClick={() => add([q.id])} className="group relative block bg-surface p-1.5 text-left" title={`“${sec.name}” bölümüne ekle`}>
                    <Thumb q={q} className={q.content ? "max-h-44 px-1" : "mx-auto max-h-44 w-auto"} />
                    <span className="absolute inset-0 hidden items-center justify-center bg-graphite/10 text-sm font-semibold group-hover:flex">+ Ekle</span>
                  </button>
                  <div className="flex items-center gap-1.5 border-t border-rule px-2 py-1 text-xs text-lead">
                    <span className="min-w-0 truncate">{q.topic || q.subject}</span>
                    <span className="ml-auto shrink-0">{DIFFICULTY[q.difficulty]}</span>
                    {room && q.classIds.includes(room) ? (
                      <span className="shrink-0 font-semibold text-amber-700" title="Bu sınıf soruyu daha önce gördü">· {course!.classroomName} gördü</span>
                    ) : q.uses > 0 ? (
                      <span className="shrink-0 text-amber-700" title="Daha önce sınav ya da çalışma kağıdında kullanıldı">· {q.uses}×</span>
                    ) : null}
                    {q.type !== "MC" && <span className="shrink-0">· {QUESTION_TYPES[q.type as QuestionType]?.short}</span>}
                    {q.type === "MC" || q.type === "TF" ? (
                      <span className={`shrink-0 font-semibold ${q.answer ? "text-graphite" : "text-red-700"}`}>{q.answer || "?"}</span>
                    ) : null}
                  </div>
                  <ClashNote near={nearChosen(q.id)} where={where} pool />
                </li>
              ))}
            </ul>
          )}
          {pool.length > shown && (
            <button className="btn-secondary mt-3 w-full" onClick={() => setShown(shown + PAGE)}>Daha fazla göster ({pool.length - shown})</button>
          )}
        </section>

        {/* Seçilen sorular */}
        <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center gap-2">
            {meta.type === "SERBEST" ? (
              <input className="input w-48 font-semibold" value={sec.name} onChange={(e) => setSec((s) => ({ ...s, name: e.target.value }))} aria-label="Bölüm adı" />
            ) : (
              <h2 className="font-semibold">{sec.name}</h2>
            )}
            <span className="num text-[13px] text-lead">{sec.items.length}{sec.target ? ` / ${sec.target} soru` : " soru"}</span>
            {sec.items.length > 0 && <button className="ml-auto text-xs text-lead hover:text-graphite" onClick={() => setSec((s) => ({ ...s, items: [] }))}>Bölümü boşalt</button>}
            {meta.type === "SERBEST" && secs.length > 1 && (
              <button className="text-xs text-lead hover:text-red-700" onClick={() => { setSecs(secs.filter((_, i) => i !== active)); setActive(0); }}>Bölümü sil</button>
            )}
          </div>
          {sec.target > 0 && sec.items.length !== sec.target && (
            <p className="mb-2 text-xs text-lead">{EXAM_TYPES[meta.type].label} şablonunda bu bölüm {sec.target} soru; optik form seçtiğiniz soru sayısına göre hazırlanır.</p>
          )}

          {sec.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-lead/40 px-4 py-8 text-center text-sm text-lead">Havuzdan soruya tıklayın ya da rastgele ekleyin.</p>
          ) : (
            <ol className="card max-h-[70vh] divide-y divide-rule/70 overflow-y-auto">
              {sec.items.map((id, i) => {
                const q = byId.get(id);
                const issue = issueOf(q);
                const bad = !!issue;
                const letters = q?.type === "TF" ? ["D", "Y"] : q?.type === "MC" ? (q.content?.options ? OPTION_LETTERS.slice(0, q.content.options.length) : ANSWERS.slice(0, allowed.length)) : [];
                return (
                  <li key={id} className="flex items-start gap-2 px-2 py-1.5">
                    <span className="num w-6 pt-1 text-right text-sm font-semibold">{i + 1}</span>
                    {q ? <Thumb q={q} className={`min-w-0 flex-1 ${q.content ? "max-h-24" : "max-h-24 object-left"}`} /> : <span className="flex-1" />}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {letters.length > 0 ? (
                        <div className="flex gap-0.5" role="group" aria-label={`${i + 1}. soru cevabı`}>
                          {letters.map((a) => (
                            <button
                              key={a}
                              aria-pressed={q?.answer === a}
                              onClick={() => setAnswer(id, a)}
                              title={q?.type === "TF" ? answerLabel("TF", a) : undefined}
                              className={`size-5 rounded-full border text-[10px] font-semibold ${q?.answer === a ? "border-graphite bg-graphite text-surface" : bad ? "border-red-300 text-red-700" : "border-ink/40 text-lead"}`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="max-w-32 truncate text-[11px] text-lead">{QUESTION_TYPES[q?.type as QuestionType]?.label}</span>
                      )}
                      {issue && issue !== "cevap yok" && <span className="max-w-40 text-right text-[11px] text-red-700">{issue}</span>}
                      <ClashNote near={nearChosen(id)} where={where} />
                      <div className="flex gap-1 text-xs text-lead">
                        <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yukarı" className="px-1 disabled:opacity-30">↑</button>
                        <button onClick={() => move(i, 1)} disabled={i === sec.items.length - 1} aria-label="Aşağı" className="px-1 disabled:opacity-30">↓</button>
                        <button onClick={() => setSec((s) => ({ ...s, items: s.items.filter((x) => x !== id) }))} aria-label="Çıkar" className="px-1 hover:text-red-700">✕</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={busy} onClick={create}>{edit ? (busy ? "Kaydediliyor…" : `Değişiklikleri kaydet (${total} soru)`) : created ? "Oluşturuldu" : busy ? "Oluşturuluyor…" : `${worksheet ? "Çalışma kağıdını oluştur" : "Denemeyi oluştur"} (${total} soru)`}</button>
            {problems.length > 0 && <span className="text-xs text-red-700">{problems.length} soruda cevap sorunu var</span>}
            {pairs.same + pairs.sibling > 0 && (
              <span className="text-xs text-amber-700" title="Aynı soru: olası tekrar. Benzer soru: aynı kalıp, başka sayılar; biri diğerinin cevabını ele verebilir.">
                {[pairs.same && `${pairs.same} çift aynı soru`, pairs.sibling && `${pairs.sibling} çift benzer soru`].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
          {msg && (
            <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">
              {msg.text}
              {created && (
                <>
                  {" "}
                  <Link href={`/kurum/denemeler/${created}/kitapcik`} className="font-semibold underline">Kitapçığı aç</Link>
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-lead">Cevap anahtarı ve konular seçilen sorulardan kendiliğinden doldurulur; sonra soru kitapçığını yazdırabilirsiniz.</p>
        </section>
      </div>
    </div>
  );
}

/** Denemede aynı / benzer soru uyarısı: seçilen listede soru başına, havuzda "seçilene benzer" etiketi. */
function ClashNote({ near, where, pool = false }: { near?: { id: string; kind: SimilarKind }; where: Map<string, string>; pool?: boolean }) {
  if (!near) return null;
  const at = where.get(near.id) ?? "";
  const text = pool ? `${SIMILAR_KINDS[near.kind].label}: seçilen ${at}` : `${near.kind === "same" ? "Aynısı" : "Benzeri"} denemede: ${at}`;
  return (
    <span
      className={`text-[11px] ${pool ? "border-t border-rule/60 bg-amber-50 px-2 py-0.5" : "max-w-40 text-right"} ${near.kind === "same" ? "font-semibold text-amber-800" : "text-amber-700"}`}
      title={SIMILAR_KINDS[near.kind].hint}
    >
      {text}
    </span>
  );
}

