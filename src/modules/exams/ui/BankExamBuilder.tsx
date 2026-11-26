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
function Thumb({ q, className, card = false }: { q: Item; className: string; card?: boolean }) {
  if (q.content)
    return (
      <div className={`overflow-hidden text-left text-graphite ${className}`}>
        <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? IMG(q.id) : null} compact card={card} />
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
type CourseOpt = { id: string; label: string; classroomId: string; classroomName: string; subject: string; level: string };

const gradeName = (g: string) => (/^\d+$/.test(g) ? `${g}. sınıf` : g);
/** Arama anahtarı: büyük/küçük harf ve şapka önemsiz ("iman" → "îmân" bulunur). */
const fold = (t: string) => t.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const haystack = (q: Item) => fold([q.content?.stem ?? "", ...(q.content?.options ?? []), q.topic].join(" "));
type Filter = { subject: string; grade: string; topic: string; difficulty: string; q: string; unused: boolean; unseen: boolean; hideAdded: boolean };

export default function BankExamBuilder({
  items: initial,
  similar = {},
  topicRank = {},
  grades = [],
  courses = [],
  initialCourse = "",
  preset,
  edit,
}: {
  items: Item[];
  similar?: SimilarMap;
  /** "ders<TAB>konu" → müfredattaki sırası; konu süzgeci bu sırayla dizilir, müfredatta olmayanlar sonda (alfabetik) */
  topicRank?: Record<string, number>;
  /** Havuzdaki sınıf / seviye değerleri, sınıf sırasıyla */
  grades?: string[];
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
  // Süzgecin ilk hâli: seçili dersin dersi ve sınıf düzeyi; yoksa açılan sorularınki (hepsi aynıysa); havuzda tek ders varsa o ders
  const courseFilter = (c: CourseOpt | undefined) => ({
    subject: c ? (subjects.find((x) => x === c.subject) ?? subjects.find((x) => subjectMatches(c.subject, x)) ?? "") : "",
    grade: c && grades.includes(c.level) ? c.level : "",
  });
  const [f, setF] = useState<Filter>(() => {
    const fromCourse = courseFilter(courses.find((c) => c.id === (edit?.courseId ?? initialCourse)));
    const opened = (edit ? edit.sections.flatMap((x) => x.items) : (preset?.items ?? [])).map((id) => byId.get(id)).filter((q) => !!q);
    const only = (vals: string[]) => (vals.length && vals.every((v) => v === vals[0]) ? vals[0] : "");
    return {
      subject: fromCourse.subject || only(opened.map((q) => q.subject)) || (subjects.length === 1 ? subjects[0] : ""),
      grade: fromCourse.grade || only(opened.map((q) => q.grade)),
      topic: "",
      difficulty: "",
      q: "",
      unused: false,
      unseen: true,
      hideAdded: false,
    };
  });
  const filter = (patch: Partial<Filter>) => {
    setF((x) => ({ ...x, ...patch }));
    setShown(PAGE);
  };
  // Derse bağlı sınavda o sınıfın daha önce gördüğü sorular varsayılan olarak gizlenir
  const course = courses.find((c) => c.id === meta.courseId);
  const room = course?.classroomId ?? "";
  const [shown, setShown] = useState(PAGE);
  const [mix, setMix] = useState({ 1: 0, 2: 0, 3: 0 } as Record<number, number>);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
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

  // base: zorluk dışındaki süzgeçlere uyanlar (otomatik seçim zorluğu kendisi böler); pool: ekranda gösterilen (eklenenler işaretli kalır)
  // anyTopic: konu dışındaki süzgeçlere uyanlar (konulara göre otomatik seçim konuyu kendisi böler)
  const anyTopic = useMemo(() => {
    const needle = fold(f.q.trim());
    return items.filter(
      (q) =>
        (worksheet || isOptical(q.type)) &&
        (!f.subject || q.subject === f.subject) &&
        (!f.grade || q.grade === f.grade) &&
        (!f.unused || q.uses === 0) &&
        (!room || !f.unseen || !q.classIds.includes(room)) &&
        (!needle || haystack(q).includes(needle)),
    );
  }, [items, f.subject, f.grade, f.unused, f.unseen, f.q, worksheet, room]);
  const base = useMemo(() => (f.topic ? anyTopic.filter((q) => q.topic === f.topic) : anyTopic), [anyTopic, f.topic]);
  const pool = useMemo(
    () => base.filter((q) => (!f.difficulty || q.difficulty === Number(f.difficulty)) && (!f.hideAdded || !chosen.has(q.id))),
    [base, f.difficulty, f.hideAdded, chosen],
  );
  const addedInPool = pool.filter((q) => chosen.has(q.id)).length;
  // Otomatik seçimin adayları: süzgece uyan, henüz eklenmemiş sorular
  const avail = useMemo(() => base.filter((q) => !chosen.has(q.id)), [base, chosen]);
  const availBy = (d: number) => avail.filter((q) => q.difficulty === d).length;
  const availSubjects = new Set(avail.map((q) => q.subject)).size;
  // Otomatik seçim iki türlü: zorluğa göre (kolay / orta / zor sayısı) ya da konulara göre (her konudan kaç soru)
  const [autoMode, setAutoMode] = useState<"difficulty" | "topic">("difficulty");
  const [perTopic, setPerTopic] = useState<Record<string, number>>({});
  const [everyTopic, setEveryTopic] = useState(2);
  const availTopic = useMemo(() => anyTopic.filter((q) => !chosen.has(q.id)), [anyTopic, chosen]);
  const want = autoMode === "topic" ? Object.values(perTopic).reduce((a, b) => a + b, 0) : (mix[1] || 0) + (mix[2] || 0) + (mix[3] || 0);
  const scope = [
    f.subject || "tüm dersler",
    f.grade ? gradeName(f.grade) : "tüm sınıflar",
    autoMode === "topic" ? "" : f.topic || "tüm konular",
    f.unused && "hiç kullanılmamış",
    room && f.unseen && `${course!.classroomName} görmedi`,
    f.q.trim() && `“${f.q.trim()}” geçen`,
  ].filter(Boolean);
  const gradeChoices = grades.filter((g) => g === f.grade || items.some((q) => q.grade === g && (!f.subject || q.subject === f.subject)));
  const seenByRoom = room ? items.filter((q) => !chosen.has(q.id) && q.classIds.includes(room)).length : 0;
  // Sınavda optikle okunamayan sorular havuzda gösterilmez; kaç tane olduğu söylenir
  const hiddenOpen = worksheet ? 0 : items.filter((q) => !isOptical(q.type)).length;
  // Konular müfredat sırasıyla (ders seçili değilse ders ders); müfredatta olmayanlar dersin sonunda, alfabetik
  const topicEntries = useMemo(() => {
    const seen = new Map<string, { subject: string; rank: number }>();
    for (const q of items) {
      if (!q.topic || (f.subject && q.subject !== f.subject) || (f.grade && q.grade !== f.grade) || seen.has(q.topic)) continue;
      seen.set(q.topic, { subject: q.subject, rank: topicRank[`${q.subject}\t${q.topic}`] ?? Infinity });
    }
    return [...seen.entries()].sort(([ta, a], [tb, b]) => a.subject.localeCompare(b.subject, "tr") || a.rank - b.rank || ta.localeCompare(tb, "tr"));
  }, [items, f.subject, f.grade, topicRank]);
  const topicChoices = useMemo(() => topicEntries.map(([t]) => t), [topicEntries]);
  // Ders seçili değilken konu listesi ders başlıkları altında gruplanır (dersler birbirine karışmasın)
  const topicGroups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const [t, { subject }] of topicEntries) (g.get(subject) ?? g.set(subject, []).get(subject)!).push(t);
    return [...g.entries()];
  }, [topicEntries]);
  // Konulara göre seçimin satırları: süzgece uyan, henüz eklenmemiş soru sayısı ve denemeye eklenmiş olanlar
  const topicRows = useMemo(
    () =>
      topicChoices
        .map((t) => ({ topic: t, avail: availTopic.filter((q) => q.topic === t).length, added: [...chosen].filter((id) => byId.get(id)?.topic === t).length }))
        .filter((r) => r.avail || r.added),
    [topicChoices, availTopic, chosen, byId],
  );

  const setSec = (fn: (s: Sec) => Sec) => setSecs((l) => l.map((s, i) => (i === active ? fn(s) : s)));
  const add = (ids: string[]) => setSec((s) => ({ ...s, items: [...s.items, ...ids.filter((id) => !s.items.includes(id))] }));
  /** Soruyu hangi bölümdeyse oradan çıkarır. */
  const remove = (id: string) => setSecs((l) => l.map((s) => ({ ...s, items: s.items.filter((x) => x !== id) })));
  /** Bölüme geçiş: bölümün adı bir dersin adıysa (ör. LGS'de "Matematik") havuz o derse geçer. */
  function selectSection(i: number) {
    setActive(i);
    const match = subjects.find((x) => subjectMatches(secs[i].name, x));
    if (match && match !== f.subject) filter({ subject: match, topic: "" });
  }
  const move = (i: number, d: number) =>
    setSec((s) => {
      const l = [...s.items];
      const j = i + d;
      if (j < 0 || j >= l.length) return s;
      [l[i], l[j]] = [l[j], l[i]];
      return { ...s, items: l };
    });

  /** Yeni bölüm: havuzda seçili ders varsa ve o adla bölüm yoksa dersin adı, yoksa "Bölüm N". */
  function addSection() {
    const name = f.subject && !secs.some((s) => s.name === f.subject) ? f.subject : `Bölüm ${secs.length + 1}`;
    setSecs([...secs, { name, target: 0, items: [] }]);
    setActive(secs.length);
  }

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
      const cand = shuffle(avail.filter((q) => q.difficulty === d)).sort((a, b) => a.uses - b.uses);
      let got = 0;
      for (const q of cand) {
        if (got === want) break;
        if ((similar[q.id] ?? []).some((h) => chosen.has(h.id) || picked.includes(h.id))) continue;
        picked.push(q.id);
        got++;
      }
      if (got < want) short.push(`${DIFFICULTY[d].toLocaleLowerCase("tr")} ${want - got}`);
    }
    if (!picked.length) return setMsg({ ok: false, text: "Süzgece uyan soru yok ya da soru sayısı yazılmadı." });
    add(picked);
    setMix({ 1: 0, 2: 0, 3: 0 });
    setMsg(short.length ? { ok: false, text: `${picked.length} soru “${sec.name}” bölümüne eklendi; yetmeyen: ${short.join(", ")}.` } : { ok: true, text: `${picked.length} soru “${sec.name}” bölümüne eklendi.` });
  }

  /**
   * Konulara göre seçim: her konudan istenen sayı, müfredat sırasıyla eklenir. Konu içinde zorluklar sırayla dağıtılır
   * (kolay, orta, zor, kolay…); her zorlukta önce hiç kullanılmamış sorular. Seçilenlere aynı / benzer sorular atlanır.
   */
  function topicFill() {
    const picked: string[] = [];
    const short: string[] = [];
    for (const r of topicRows) {
      const want = perTopic[r.topic] || 0;
      if (!want) continue;
      const groups = [1, 2, 3].map((d) => shuffle(availTopic.filter((q) => q.topic === r.topic && q.difficulty === d)).sort((a, b) => a.uses - b.uses));
      let got = 0;
      for (let round = 0; got < want && groups.some((g) => g.length); round++) {
        const g = groups[round % 3];
        const q = g.shift();
        if (!q) continue;
        if ((similar[q.id] ?? []).some((h) => chosen.has(h.id) || picked.includes(h.id))) continue;
        picked.push(q.id);
        got++;
      }
      if (got < want) short.push(`${r.topic} (${want - got})`);
    }
    if (!picked.length) return setMsg({ ok: false, text: "Konulara soru sayısı yazılmadı ya da uyan soru yok." });
    add(picked);
    setPerTopic({});
    setMsg(short.length ? { ok: false, text: `${picked.length} soru “${sec.name}” bölümüne eklendi; yetmeyen: ${short.join(", ")}.` } : { ok: true, text: `${picked.length} soru “${sec.name}” bölümüne eklendi.` });
  }

  /** Bu ekranda cevabı girilen sorular: yanlış seçim düzeltilebilsin diye seçim düğmeleri açık kalır. */
  const [answeredHere, setAnsweredHere] = useState<Set<string>>(() => new Set());
  /** Cevabı olmayan soruya cevap: soru havuzundaki soruya kaydedilir. */
  async function setAnswer(id: string, answer: string) {
    const res = await fetch("/api/kurum/soru-havuzu/sorular", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], set: { answer } }),
    });
    if (!res.ok) return setMsg({ ok: false, text: "Cevap kaydedilemedi." });
    setItems((l) => l.map((q) => (q.id === id ? { ...q, answer } : q)));
    setAnsweredHere((x) => new Set(x).add(id));
    setMsg({ ok: true, text: `Cevap (${answer}) soru havuzundaki soruya da kaydedildi.` });
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

  // Ad boş bırakılırsa kullanılacak öneri: "9-A · İlmihal sınavı · 26.11.2026"
  const chosenSubjects = [...new Set([...chosen].map((id) => byId.get(id)?.subject).filter(Boolean))];
  const who = course ? course.label : chosenSubjects.length === 1 ? chosenSubjects[0] : "Kurum";
  const suggestedName = `${who} ${worksheet ? "çalışma kağıdı" : course || chosenSubjects.length === 1 ? "sınavı" : "denemesi"} · ${meta.date.split("-").reverse().join(".")}`;

  // Etkin bölümün özeti: zorluk dağılımı ve konular (müfredat sırasıyla)
  const rankOf = (q: Item | undefined) => (q ? (topicRank[`${q.subject}\t${q.topic}`] ?? Infinity) : Infinity);
  const secQs = sec.items.map((id) => byId.get(id)).filter((q) => !!q);
  const byDiff = [1, 2, 3].map((d) => secQs.filter((q) => q.difficulty === d).length);
  const secTopics = [...secQs.reduce((m, q) => m.set(q.topic || "Konusuz", { n: (m.get(q.topic || "Konusuz")?.n ?? 0) + 1, rank: rankOf(q), subject: q.subject }), new Map<string, { n: number; rank: number; subject: string }>())]
    .sort(([ta, a], [tb, b]) => a.subject.localeCompare(b.subject, "tr") || a.rank - b.rank || ta.localeCompare(tb, "tr"));
  const [topicsOpen, setTopicsOpen] = useState(false);

  /** Etkin bölümün sorularını sıralar: müfredat sırası (aynı konuda kolaydan zora), kolaydan zora ya da karışık. */
  function sortSection(how: string) {
    const d = (id: string) => byId.get(id)?.difficulty ?? 2;
    setSec((s) => {
      const l = [...s.items];
      if (how === "curriculum") l.sort((a, b) => byId.get(a)!.subject.localeCompare(byId.get(b)!.subject, "tr") || rankOf(byId.get(a)) - rankOf(byId.get(b)) || (byId.get(a)!.topic || "").localeCompare(byId.get(b)!.topic || "", "tr") || d(a) - d(b));
      else if (how === "difficulty") l.sort((a, b) => d(a) - d(b));
      else if (how === "shuffle") return { ...s, items: shuffle(l) };
      return { ...s, items: l };
    });
  }

  async function create() {
    const name = meta.name.trim() || suggestedName;
    if (!total) return setMsg({ ok: false, text: "Bölümlere soru ekleyin." });
    if (problems.length) return setMsg({ ok: false, text: `Önce şunları düzeltin: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""}` });
    if (pairs.same && !confirm(`Bu ${worksheet ? "çalışma kağıdında" : "denemede"} ${pairs.same} çift aynı soru var (işaretli sorular). Yine de ${edit ? "kaydedilsin" : "oluşturulsun"} mi?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(edit ? `/api/kurum/denemeler/${edit.id}/sorular` : "/api/kurum/denemeler/havuzdan", {
      method: edit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, name, courseId: meta.courseId || null, sections: secs.map((s) => ({ name: s.name, items: s.items })) }),
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
            <span className="label">Kimin için?</span>
            <select
              className="input"
              title="Bir sınıfın dersini seçerseniz sınav o dersin sınavı olur; sonuçlar dersin öğrencilerine bağlanır"
              value={meta.courseId}
              onChange={(e) => {
                const c = courses.find((x) => x.id === e.target.value);
                setMeta({ ...meta, courseId: e.target.value });
                // Ders seçilince havuz o derse ve sınıfın düzeyine geçer
                const cf = courseFilter(c);
                if (cf.subject || cf.grade) filter({ subject: cf.subject || f.subject, grade: cf.grade || f.grade, topic: "" });
              }}
            >
              <option value="">Kurum geneli (belirli bir ders değil)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-56 flex-1">
          <span className="label">{worksheet ? "Çalışma kağıdı adı" : "Deneme adı"}</span>
          <input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder={suggestedName} title="Boş bırakılırsa gri yazan ad kullanılır" />
        </label>
        {!worksheet && (
          <label>
            <span className="label">Sınav türü</span>
            <select className="input" value={meta.type} onChange={(e) => changeType(e.target.value)} title="LGS / TYT / AYT: bölümler ve soru sayıları şablondan gelir. Serbest: bölümleri siz belirlersiniz.">
              {Object.entries(EXAM_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className="label">Tarih</span>
          <input type="date" className="input" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
        </label>
        {!worksheet && <label>
          <span className="label">Kitapçık</span>
          <select className="input" value={meta.booklets} onChange={(e) => setMeta({ ...meta, booklets: Number(e.target.value) })} title="A dışındaki kitapçıklarda sorular bölüm içinde karıştırılır">
            <option value={1}>Tek kitapçık</option>
            <option value={2}>A, B</option>
            <option value={3}>A, B, C</option>
            <option value={4}>A, B, C, D</option>
          </select>
        </label>}
      </div>

      {/* Bölümler */}
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[13px] font-semibold">Bölümler:</span>
        {secs.map((s, i) => {
          const full = s.target && s.items.length === s.target;
          return (
            <button
              key={i}
              onClick={() => selectSection(i)}
              aria-current={i === active ? "true" : undefined}
              className={`rounded-md px-3 py-1 text-[13.5px] ${i === active ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"}`}
            >
              {s.name} <span className={`num font-normal ${i === active ? "" : full ? "text-emerald-700" : ""}`} title="Bu bölümdeki soru sayısı">({s.items.length}{s.target ? `/${s.target}` : ""} soru)</span>
            </button>
          );
        })}
        {meta.type === "SERBEST" && (
          <button className="rounded-md px-2 py-1 text-[13px] text-lead border border-dashed border-rule hover:text-graphite" onClick={addSection} title="Sınava ayrı bir test ekler (ör. Türkçe'nin yanına Matematik)">
            + Bölüm ekle
          </button>
        )}
        <span className="num ml-auto text-[13px] text-lead">Toplam {total} soru</span>
      </div>
      <p className="mb-3 text-xs text-lead">
        {meta.type === "SERBEST"
          ? "Bölüm, sınavdaki ayrı testtir (ör. Türkçe, Matematik): kitapçıkta kendi başlığıyla basılır, sonuçta neti ayrı hesaplanır. Tek dersin sınavında tek bölüm yeterli; konular (paragraf, sözcükte anlam…) bölüm değildir, sorudan kendiliğinden gelir."
          : `${EXAM_TYPES[meta.type].label} şablonunun testleri; her bölümün neti ayrı hesaplanır.`}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Havuz */}
        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-semibold">Soru havuzu</h2>
            <span className="num text-[13px] text-lead">
              {pool.length} soru{addedInPool > 0 ? ` · ${addedInPool} tanesi eklendi` : ""}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={f.subject} onChange={(e) => filter({ subject: e.target.value, topic: "" })} aria-label="Ders">
              <option value="">Tüm dersler</option>
              {subjects.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {grades.length > 0 && (
              <select className="input w-auto" value={f.grade} onChange={(e) => filter({ grade: e.target.value, topic: "" })} aria-label="Sınıf / seviye">
                <option value="">Tüm sınıflar</option>
                {gradeChoices.map((g) => <option key={g} value={g}>{gradeName(g)}</option>)}
              </select>
            )}
            <select className="input w-auto max-w-64 min-w-40 flex-1" value={f.topic} onChange={(e) => filter({ topic: e.target.value })} aria-label="Konu">
              <option value="">{`Tüm konular (${topicChoices.length})`}</option>
              {f.subject
                ? topicChoices.map((t) => <option key={t} value={t}>{t}</option>)
                : topicGroups.map(([s, ts]) => (
                    <optgroup key={s} label={s}>
                      {ts.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
            </select>
            <select className="input w-auto" value={f.difficulty} onChange={(e) => filter({ difficulty: e.target.value })} aria-label="Zorluk">
              <option value="">Her zorluk</option>
              {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="search" className="input w-48" value={f.q} onChange={(e) => filter({ q: e.target.value })} placeholder="Soru metninde ara…" aria-label="Soru metninde ara" />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={f.unused} onChange={(e) => filter({ unused: e.target.checked })} />
              Yalnız hiç kullanılmamış
            </label>
            {room && (
              <label className="flex items-center gap-1.5" title={`${course!.classroomName} sınıfının daha önceki sınav ya da çalışma kağıtlarında gördüğü sorular`}>
                <input type="checkbox" checked={f.unseen} onChange={(e) => filter({ unseen: e.target.checked })} />
                {course!.classroomName} görmedi{seenByRoom > 0 && f.unseen ? <span className="text-lead"> ({seenByRoom} gizli)</span> : null}
              </label>
            )}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={f.hideAdded} onChange={(e) => filter({ hideAdded: e.target.checked })} />
              Eklenenleri gizle
            </label>
            {hiddenOpen > 0 && <span className="w-full text-xs text-lead">{hiddenOpen} açık uçlu / boşluk doldurma soru optikle okunamadığı için gösterilmiyor; çalışma kağıdında kullanılabilir.</span>}
          </div>

          {/* Otomatik seçim: süzgece uyan, eklenmemiş sorulardan zorluğa ya da konulara göre */}
          <div className="card mb-3 px-3 py-2.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold">Otomatik seç</span>
              <div className="flex rounded-md ring-1 ring-rule" role="group" aria-label="Otomatik seçim türü">
                {(
                  [
                    ["difficulty", "Zorluğa göre"],
                    ["topic", "Konulara göre"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} aria-pressed={autoMode === k} onClick={() => setAutoMode(k)} className={`px-2.5 py-0.5 first:rounded-l-md last:rounded-r-md ${autoMode === k ? "bg-graphite font-semibold text-surface" : "text-lead hover:text-graphite"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-lead">Süzgece uyan sorulardan: {scope.join(" · ")}</p>
            {!f.subject && availSubjects > 1 && <p className="mt-1 text-xs text-amber-700">Ders seçilmedi: sorular {availSubjects} farklı dersten seçilebilir.</p>}
            {autoMode === "difficulty" ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                {[1, 2, 3].map((d) => (
                  <label key={d} className="flex items-center gap-1.5">
                    <span className="font-medium">{DIFFICULTY[d]}</span>
                    <input
                      type="number"
                      min={0}
                      max={availBy(d)}
                      disabled={!availBy(d) && !mix[d]}
                      className="input w-14 px-1.5 py-0.5 text-center"
                      value={mix[d] || ""}
                      placeholder="0"
                      onChange={(e) => setMix({ ...mix, [d]: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <span className="num text-lead">/ {availBy(d)} var</span>
                  </label>
                ))}
              </div>
            ) : topicRows.length === 0 ? (
              <p className="mt-2 text-lead">Süzgece uyan konulu soru yok.</p>
            ) : (
              <div className="mt-2">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    Her konudan
                    <input type="number" min={1} max={20} className="input w-14 px-1.5 py-0.5 text-center" value={everyTopic} onChange={(e) => setEveryTopic(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
                    soru
                  </label>
                  <button className="btn-secondary py-0.5" onClick={() => setPerTopic(Object.fromEntries(topicRows.filter((r) => r.avail).map((r) => [r.topic, Math.min(everyTopic, r.avail)])))}>
                    Tüm konulara yaz
                  </button>
                  {want > 0 && (
                    <button className="text-xs text-lead underline hover:text-graphite" onClick={() => setPerTopic({})}>
                      Sayıları temizle
                    </button>
                  )}
                </div>
                <ul className="max-h-72 divide-y divide-rule/60 overflow-y-auto rounded-md ring-1 ring-rule">
                  {topicRows.map((r) => (
                    <li key={r.topic} className={`flex items-center gap-2 px-2 py-1 ${perTopic[r.topic] ? "bg-graphite/[0.04]" : ""}`}>
                      <span className="min-w-0 flex-1 truncate" title={r.topic}>{r.topic}</span>
                      {r.added > 0 && <span className="shrink-0 text-xs text-emerald-700" title="Bu konudan denemeye eklenmiş soru">✓ {r.added}</span>}
                      <span className="num w-12 shrink-0 text-right text-xs text-lead">{r.avail} var</span>
                      <input
                        type="number"
                        min={0}
                        max={r.avail}
                        disabled={!r.avail}
                        aria-label={`${r.topic}: kaç soru`}
                        className="input w-14 shrink-0 px-1.5 py-0.5 text-center"
                        value={perTopic[r.topic] || ""}
                        placeholder="0"
                        onChange={(e) => setPerTopic({ ...perTopic, [r.topic]: Math.max(0, Math.min(r.avail, Number(e.target.value) || 0)) })}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button className="btn-secondary py-1" disabled={!want} onClick={autoMode === "topic" ? topicFill : randomFill}>
                {want ? `${want} soruyu “${sec.name}” bölümüne ekle` : autoMode === "topic" ? "Konulara soru sayısı yazın" : "Kaç soru istediğinizi yazın"}
              </button>
              <span className="text-xs text-lead">
                {autoMode === "topic" ? "Konular müfredat sırasıyla eklenir; konu içinde zorluklar dağıtılır. " : ""}Önce hiç kullanılmamış sorular seçilir; eklenenlere benzeyen sorular atlanır.
              </span>
            </div>
          </div>

          {pool.length === 0 ? (
            <div className="rounded-lg border border-dashed border-lead/40 px-4 py-6 text-center text-sm text-lead">
              Bu süzgece uyan soru yok.{" "}
              <button className="font-semibold text-graphite underline" onClick={() => filter({ topic: "", difficulty: "", q: "", unused: false, hideAdded: false })}>
                Konu, zorluk ve aramayı temizle
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pool.slice(0, shown).map((q) => {
                const at = where.get(q.id);
                return (
                  <li key={q.id} className={`card flex flex-col overflow-hidden ${at ? "ring-2 ring-emerald-600/70" : ""}`}>
                    {at ? (
                      <div className="bg-surface p-1.5 opacity-60">
                        <Thumb q={q} card className={q.content ? "max-h-44 px-1" : "mx-auto max-h-44 w-auto"} />
                      </div>
                    ) : (
                      <button onClick={() => add([q.id])} className="block bg-surface p-1.5 text-left" title={`“${sec.name}” bölümüne ekle`}>
                        <Thumb q={q} card className={q.content ? "max-h-44 px-1" : "mx-auto max-h-44 w-auto"} />
                      </button>
                    )}
                    <div className="mt-auto flex items-center gap-1.5 border-t border-rule px-2 py-1 text-xs text-lead">
                      <span className="min-w-0 truncate" title={q.topic || q.subject}>{q.topic || q.subject}</span>
                      <span className="ml-auto shrink-0">{DIFFICULTY[q.difficulty]}</span>
                      {room && q.classIds.includes(room) ? (
                        <span className="shrink-0 font-semibold text-amber-700" title="Bu sınıf soruyu daha önce gördü">· {course!.classroomName} gördü</span>
                      ) : q.uses > 0 ? (
                        <span className="shrink-0 text-amber-700" title="Daha önce sınav ya da çalışma kağıdında kullanıldı">· {q.uses}×</span>
                      ) : null}
                      {q.type !== "MC" && <span className="shrink-0">· {QUESTION_TYPES[q.type as QuestionType]?.short}</span>}
                      {q.type === "MC" || q.type === "TF" ? (
                        <span className={`shrink-0 font-semibold ${q.answer ? "text-graphite" : "text-red-700"}`} title={q.answer ? "Doğru cevap" : "Cevabı girilmemiş"}>{q.answer || "?"}</span>
                      ) : null}
                    </div>
                    <ClashNote near={nearChosen(q.id)} where={where} pool />
                    {at ? (
                      <div className="flex items-center gap-2 border-t border-rule bg-emerald-50 px-2 py-1 text-[13px]">
                        <span className="font-semibold text-emerald-800">✓ Eklendi · {at}</span>
                        <button className="ml-auto rounded px-2 py-0.5 text-lead ring-1 ring-rule hover:text-red-700" onClick={() => remove(q.id)}>Çıkar</button>
                      </div>
                    ) : (
                      <button className="border-t border-rule px-2 py-1.5 text-[13px] font-semibold hover:bg-graphite/5" onClick={() => add([q.id])}>
                        + Ekle{secs.length > 1 && <span className="font-normal text-lead"> → {sec.name}</span>}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pool.length > shown && (
            <button className="btn-secondary mt-3 w-full" onClick={() => setShown(shown + PAGE)}>Daha fazla göster ({pool.length - shown})</button>
          )}
        </section>

        {/* Seçilen sorular */}
        <section id="secilenler" className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {meta.type === "SERBEST" ? (
              <label className="flex items-center gap-1.5 text-[13px] text-lead">
                Bölüm adı
                <input className="input w-44 font-semibold text-graphite" value={sec.name} onChange={(e) => setSec((s) => ({ ...s, name: e.target.value }))} placeholder="Ör. Türkçe" />
              </label>
            ) : (
              <h2 className="font-semibold">{sec.name}</h2>
            )}
            <span className="num text-[13px] text-lead">{sec.items.length}{sec.target ? ` / ${sec.target} soru` : " soru"}</span>
            {sec.items.length > 0 && <button className="ml-auto text-xs text-lead hover:text-graphite" onClick={() => setSec((s) => ({ ...s, items: [] }))}>Bölümü boşalt</button>}
            {meta.type === "SERBEST" && secs.length > 1 && (
              <button className="text-xs text-lead hover:text-red-700" onClick={() => { setSecs(secs.filter((_, i) => i !== active)); setActive(0); }}>Bölümü sil</button>
            )}
          </div>
          {secQs.length > 0 && (
            <div className="mb-2 rounded-md bg-graphite/[0.04] px-2.5 py-1.5 text-[13px]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {[1, 2, 3].map((d) => (
                  <span key={d} className={byDiff[d - 1] ? "" : "text-lead"}>
                    {DIFFICULTY[d]} <b className="num">{byDiff[d - 1]}</b>
                  </span>
                ))}
                <button className="text-lead underline decoration-dotted underline-offset-2 hover:text-graphite" onClick={() => setTopicsOpen(!topicsOpen)} aria-expanded={topicsOpen}>
                  {secTopics.length} konu {topicsOpen ? "▴" : "▾"}
                </button>
                {secQs.length > 1 && (
                  <select className="input ml-auto w-auto py-0.5 text-[13px]" value="" onChange={(e) => sortSection(e.target.value)} aria-label="Soruları sırala">
                    <option value="" disabled>Sırala…</option>
                    <option value="curriculum">Müfredat sırasına göre</option>
                    <option value="difficulty">Kolaydan zora</option>
                    <option value="shuffle">Karıştır</option>
                  </select>
                )}
              </div>
              {topicsOpen && (
                <ul className="mt-1.5 space-y-0.5 border-t border-rule/70 pt-1.5 text-xs">
                  {secTopics.map(([t, v]) => (
                    <li key={t} className="flex gap-2">
                      <span className="min-w-0 flex-1 truncate" title={t}>{t}</span>
                      <span className="num shrink-0 font-semibold">{v.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {sec.target > 0 && sec.items.length !== sec.target && (
            <p className="mb-2 text-xs text-lead">{EXAM_TYPES[meta.type].label} şablonunda bu bölüm {sec.target} soru; optik form seçtiğiniz soru sayısına göre hazırlanır.</p>
          )}

          {sec.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-lead/40 px-4 py-8 text-center text-sm text-lead">Havuzdaki sorulardan “+ Ekle” ile seçin ya da Otomatik seç’e soru sayısı yazıp ekleyin.</p>
          ) : (
            <ol className="card max-h-[70vh] divide-y divide-rule/70 overflow-y-auto">
              {sec.items.map((id, i) => {
                const q = byId.get(id);
                const issue = issueOf(q);
                const letters = q?.type === "TF" ? ["D", "Y"] : q?.type === "MC" ? (q.content?.options ? OPTION_LETTERS.slice(0, q.content.options.length) : ANSWERS.slice(0, allowed.length)) : [];
                // Cevap seçimi yalnız cevabı olmayan soruda (ve bu ekranda cevabı girilende, düzeltilebilsin diye)
                const pick = letters.length > 0 && (!q?.answer || answeredHere.has(id));
                return (
                  <li key={id} className="flex items-start gap-2 px-2 py-1.5">
                    <span className="num w-6 pt-1 text-right text-sm font-semibold">{i + 1}</span>
                    {q ? <Thumb q={q} card className={`min-w-0 flex-1 ${q.content ? "max-h-24" : "max-h-24 object-left"}`} /> : <span className="flex-1" />}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {pick ? (
                        <div className="flex flex-col items-end gap-0.5" title="Seçtiğiniz cevap soru havuzundaki soruya da kaydedilir">
                          <span className={`text-[11px] ${q?.answer ? "text-lead" : "font-semibold text-red-700"}`}>{q?.answer ? "Cevap" : "Cevap yok, seçin:"}</span>
                          <div className="flex gap-0.5" role="group" aria-label={`${i + 1}. soru cevabı`}>
                            {letters.map((a) => (
                              <button
                                key={a}
                                aria-pressed={q?.answer === a}
                                onClick={() => setAnswer(id, a)}
                                title={q?.type === "TF" ? answerLabel("TF", a) : undefined}
                                className={`size-6 rounded-full border text-[11px] font-semibold ${q?.answer === a ? "border-graphite bg-graphite text-surface" : q?.answer ? "border-ink/40 text-lead" : "border-red-300 text-red-700"}`}
                              >
                                {a}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : letters.length > 0 ? (
                        <span className="text-[12px] text-lead" title="Doğru cevap (soru havuzunda düzenlenir)">
                          Cevap <b className="text-graphite">{answerLabel(q!.type, q!.answer)}</b>
                        </span>
                      ) : (
                        <span className="max-w-32 truncate text-[11px] text-lead">{QUESTION_TYPES[q?.type as QuestionType]?.label}</span>
                      )}
                      {issue && issue !== "cevap yok" && <span className="max-w-40 text-right text-[11px] text-red-700">{issue}</span>}
                      <ClashNote near={nearChosen(id)} where={where} />
                      <div className="flex gap-1">
                        <IconBtn onClick={() => move(i, -1)} disabled={i === 0} label="Yukarı taşı" d="M6 15l6-6 6 6" />
                        <IconBtn onClick={() => move(i, 1)} disabled={i === sec.items.length - 1} label="Aşağı taşı" d="M6 9l6 6 6-6" />
                        <IconBtn onClick={() => remove(id)} label="Sınavdan çıkar" d="M6 6l12 12M18 6L6 18" danger />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-secondary" disabled={!total} onClick={() => setPreview(true)}>Önizle</button>
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
      {/* Telefonda / dar ekranda: seçilenler havuzun altında kalır; özet ve işlemler hep görünsün */}
      <div className="h-16 lg:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-rule bg-surface px-4 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:hidden">
        <a href="#secilenler" className="num mr-auto text-sm font-semibold underline decoration-dotted underline-offset-2">{total} soru seçildi</a>
        <button className="btn-secondary py-1" disabled={!total} onClick={() => setPreview(true)}>Önizle</button>
        <button className="btn-primary py-1" disabled={busy || !!created} onClick={create}>{edit ? "Kaydet" : "Oluştur"}</button>
      </div>
      {preview && <Preview name={meta.name.trim() || suggestedName} secs={secs} byId={byId} onClose={() => setPreview(false)} />}
    </div>
  );
}

/** Yukarı / aşağı / çıkar düğmesi: parmakla da rahat basılacak boyutta (32 px). */
function IconBtn({ onClick, disabled, label, d, danger = false }: { onClick: () => void; disabled?: boolean; label: string; d: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-md text-lead ring-1 ring-rule hover:bg-graphite/5 disabled:opacity-30 disabled:hover:bg-transparent ${danger ? "hover:text-red-700" : "hover:text-graphite"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

/** Sınavın önizlemesi: bölüm başlıkları ve kesintisiz soru numaralarıyla, kitapçıktaki sırada (A kitapçığı). */
function Preview({ name, secs, byId, onClose }: { name: string; secs: Sec[]; byId: Map<string, Item>; onClose: () => void }) {
  const [answers, setAnswers] = useState(false);
  const shownSecs = secs.filter((s) => s.items.length);
  let no = 0;
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Sınav önizlemesi" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="h-fit w-full max-w-3xl rounded-lg bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-lg border-b border-rule bg-surface px-4 py-2">
          <h2 className="mr-auto font-semibold">Önizleme{name.trim() ? `: ${name.trim()}` : ""}</h2>
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
            Cevapları göster
          </label>
          <button className="btn-secondary py-1" onClick={onClose} autoFocus>Kapat</button>
        </div>
        <div className="px-5 py-4">
          {shownSecs.map((s, si) => (
            <section key={si} className={si ? "mt-6" : ""}>
              {shownSecs.length > 1 && (
                <h3 className="mb-2 border-b border-rule pb-1 font-bold">
                  {s.name} <span className="font-normal text-lead">({s.items.length} soru)</span>
                </h3>
              )}
              <ol className="space-y-4">
                {s.items.map((id) => {
                  const q = byId.get(id);
                  no++;
                  return (
                    <li key={id} className="flex gap-2">
                      <span className="num w-7 shrink-0 text-right font-bold">{no}.</span>
                      <div className="min-w-0 flex-1">
                        {!q ? (
                          <span className="text-sm text-lead">Soru bulunamadı.</span>
                        ) : q.content ? (
                          <QuestionView type={q.type} content={q.content} imageSrc={q.hasImage ? IMG(q.id) : null} answer={answers ? q.answer : undefined} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- kimlik doğrulamalı görsel
                          <img src={IMG(q.id)} alt="" className="h-auto max-w-full bg-white" />
                        )}
                        {q && answers && !q.content && <p className="mt-1 text-sm font-semibold text-emerald-800">Cevap: {q.answer || "?"}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
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

