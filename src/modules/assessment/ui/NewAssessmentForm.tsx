"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSESSMENT_TYPES, ASSESSMENT_TYPE_KEYS, maxTotalOf, type Criterion } from "../index";

type Course = { id: string; name: string; classroom: string; kind: string };
type Rubric = { id: string; name: string; kind: string; criteria: Criterion[] };
type Topic = { id: string; topic: string; current?: boolean };

/** Derse göre varsayılan tür: dini → sözlü, mesleki → uygulama, diğerleri → yazılı. */
const defaultType = (kind: string) => (kind === "RELIGIOUS" ? "ORAL" : kind === "VOCATIONAL" ? "PRACTICE" : "WRITTEN");

/**
 * Yeni değerlendirme: ders, tür, puan cetveli, (varsa) plan konusu, tarih ve başlık.
 * Oluşunca `nextBase/<id>` sayfasına (puan girişi) gidilir.
 */
export default function NewAssessmentForm({
  courses,
  courseId,
  rubrics,
  topics,
  today,
  nextBase,
}: {
  courses: Course[];
  courseId?: string;
  rubrics: Rubric[];
  /** Seçili dersin plan konuları (ders sabitse) */
  topics: Topic[];
  today: string;
  nextBase: string;
}) {
  const router = useRouter();
  const [course, setCourse] = useState(courseId ?? courses[0]?.id ?? "");
  const kind = courses.find((c) => c.id === course)?.kind ?? "";
  // Dersin türüne uygun cetveller önce
  const sorted = useMemo(() => [...rubrics].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind)), [rubrics, kind]);
  const [type, setType] = useState(defaultType(kind));
  const [rubricId, setRubricId] = useState(sorted[0]?.id ?? "");
  const [planItemId, setPlanItemId] = useState(topics.find((t) => t.current)?.id ?? "");
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rubric = rubrics.find((r) => r.id === rubricId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/kurum/degerlendirme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course, type, rubricId, planItemId: planItemId || null, date, title }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Oluşturulamadı.");
    router.push(`${nextBase}/${j.id}`);
  }

  if (!rubrics.length) {
    return <div className="card p-4 text-sm text-lead">Henüz puan cetveli yok. Yöneticinin “Sözlü ve yazılı → Puan cetvelleri” bölümünden cetvel eklemesi gerekiyor.</div>;
  }

  return (
    <form onSubmit={submit} className="card space-y-3.5 p-3.5">
      {!courseId && (
        <div>
          <label className="label" htmlFor="course">Ders</label>
          <select
            id="course"
            className="input"
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setType(defaultType(courses.find((c) => c.id === e.target.value)?.kind ?? ""));
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.classroom} · {c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <span className="label">Tür</span>
        <div className="flex flex-wrap gap-1.5">
          {ASSESSMENT_TYPE_KEYS.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setType(k)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${type === k ? "bg-graphite text-surface" : "bg-surface ring-1 ring-rule"}`}
            >
              {ASSESSMENT_TYPES[k].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="rubric">Puan cetveli</label>
        <select id="rubric" className="input" value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>{r.name} ({maxTotalOf(r.criteria)} puan)</option>
          ))}
        </select>
        {rubric && <p className="mt-1 text-[13px] text-lead">{rubric.criteria.map((c) => `${c.name} ${c.max}`).join(" · ")}</p>}
      </div>
      {topics.length > 0 && (
        <div>
          <label className="label" htmlFor="topic">Plan konusu <span className="font-normal text-lead">(isteğe bağlı; ör. ezber parçası)</span></label>
          <select id="topic" className="input" value={planItemId} onChange={(e) => setPlanItemId(e.target.value)}>
            <option value="">— Bağlama —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.topic}{t.current ? " (bu hafta)" : ""}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label" htmlFor="date">Tarih</label>
          <input id="date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="title">Başlık</label>
          <input id="title" className="input" value={title} maxLength={80} placeholder="Boşsa konu / cetvel adı" onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy || !course || !rubricId}>{busy ? "Oluşturuluyor…" : "Başlat ve puan gir"}</button>
    </form>
  );
}
