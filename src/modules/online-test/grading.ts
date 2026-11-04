export type GradableQuestion = {
  id: string;
  type: string;
  points: number;
  correctText: string;
  options: { id: string; isCorrect: boolean }[];
};

export type SubmittedAnswer = { optionIds?: string[]; text?: string };

const norm = (s: string) =>
  s.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

export function gradeAnswer(q: GradableQuestion, a: SubmittedAnswer | undefined) {
  let isCorrect = false;
  if (q.type === "SHORT") {
    const accepted = q.correctText.split("|").map(norm).filter(Boolean);
    isCorrect = !!a?.text && accepted.includes(norm(a.text));
  } else {
    const chosen = new Set(a?.optionIds ?? []);
    const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    isCorrect =
      chosen.size > 0 &&
      chosen.size === correct.size &&
      [...chosen].every((id) => correct.has(id));
  }
  return { isCorrect, points: isCorrect ? q.points : 0 };
}

export function gradeAll(
  questions: GradableQuestion[],
  answers: Record<string, SubmittedAnswer>,
) {
  let score = 0;
  let maxScore = 0;
  const rows = questions.map((q) => {
    const a = answers[q.id];
    const g = gradeAnswer(q, a);
    score += g.points;
    maxScore += q.points;
    return {
      questionId: q.id,
      optionIds: JSON.stringify(a?.optionIds ?? []),
      text: a?.text ?? "",
      isCorrect: g.isCorrect,
      points: g.points,
    };
  });
  return { score, maxScore, rows };
}

export const QUESTION_TYPES: Record<string, string> = {
  SINGLE: "Çoktan seçmeli (tek cevap)",
  MULTI: "Çoktan seçmeli (çok cevap)",
  TRUE_FALSE: "Doğru / Yanlış",
  SHORT: "Kısa cevap",
};

export function shareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const pct = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 100) : 0;
