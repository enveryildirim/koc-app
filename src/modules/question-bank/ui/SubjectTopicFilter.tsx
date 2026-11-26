"use client";

import { useState } from "react";

/**
 * Soru havuzu süzgecindeki ders + konu seçimi. Ders değişince konu listesi hemen o dersin konularına daralır
 * (Filtrele'ye basmayı beklemeden); seçili konu yeni derste yoksa sıfırlanır. Form GET ile gönderilir: name="ders" / "konu".
 */
export default function SubjectTopicFilter({
  subjects,
  topics,
  subject: initialSubject,
  topic: initialTopic,
}: {
  subjects: string[];
  /** Ders → havuzdaki konular (müfredat sırasıyla) */
  topics: Record<string, string[]>;
  subject?: string;
  topic?: string;
}) {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [topic, setTopic] = useState(initialTopic ?? "");
  const choices = subject
    ? topics[subject] ?? []
    : [...new Set(Object.values(topics).flat())].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <>
      <select
        name="ders"
        value={subject}
        onChange={(e) => {
          const next = e.target.value;
          setSubject(next);
          if (topic && next && !(topics[next] ?? []).includes(topic)) setTopic("");
        }}
        className="input w-auto"
        aria-label="Ders"
      >
        <option value="">Tüm dersler</option>
        {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select name="konu" value={topic} onChange={(e) => setTopic(e.target.value)} className="input w-auto max-w-56" aria-label="Konu">
        <option value="">{subject ? `Tüm konular (${choices.length})` : "Tüm konular"}</option>
        {choices.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </>
  );
}
