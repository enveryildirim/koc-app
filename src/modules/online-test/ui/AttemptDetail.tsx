import { pct } from "../grading";

type Q = {
  id: string;
  type: string;
  text: string;
  points: number;
  correctText: string;
  explanation: string;
  options: { id: string; text: string; isCorrect: boolean }[];
};
type A = { questionId: string; optionIds: string; text: string; isCorrect: boolean; points: number };

export default function AttemptDetail({
  questions,
  answers,
  showAnswers,
}: {
  questions: Q[];
  answers: A[];
  showAnswers: boolean;
}) {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const a = byQ.get(q.id);
        const chosen = new Set<string>(a ? JSON.parse(a.optionIds) : []);
        const blank = !a || (chosen.size === 0 && !a.text.trim());
        return (
          <div key={q.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">
                {i + 1}. <span className="whitespace-pre-line">{q.text}</span>
              </div>
              <span
                className={`badge shrink-0 ${blank ? "bg-slate-100 text-slate-600" : a?.isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
              >
                {blank ? "Boş" : a?.isCorrect ? `Doğru +${a.points}` : "Yanlış"}
              </span>
            </div>
            {q.type === "SHORT" ? (
              <div className="mt-3 text-sm">
                <div>Cevap: <b>{a?.text || "—"}</b></div>
                {showAnswers && <div className="text-emerald-700">Doğru cevap: {q.correctText.split("|")[0]}</div>}
              </div>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {q.options.map((o, k) => {
                  const picked = chosen.has(o.id);
                  const correct = showAnswers && o.isCorrect;
                  return (
                    <li
                      key={o.id}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${correct ? "bg-emerald-50 text-emerald-800" : picked ? "bg-red-50 text-red-800" : ""}`}
                    >
                      <span className="w-5 font-bold">{"ABCDEFGH"[k]}</span>
                      {o.text}
                      {picked && <span className="ml-auto text-xs font-semibold">Seçiminiz</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {showAnswers && q.explanation && <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">💡 {q.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function ScoreSummary({ score, maxScore, passPercent, correct, wrong, blank }: { score: number; maxScore: number; passPercent: number; correct: number; wrong: number; blank: number }) {
  const p = pct(score, maxScore);
  const passed = p >= passPercent;
  return (
    <div className="card p-6 text-center">
      <div className={`mx-auto grid h-28 w-28 place-items-center rounded-full text-3xl font-extrabold ${passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
        %{p}
      </div>
      <div className={`mt-3 text-lg font-bold ${passed ? "text-emerald-700" : "text-red-700"}`}>{passed ? "Tebrikler, geçtiniz!" : "Geçme notuna ulaşılamadı"}</div>
      <div className="text-sm text-slate-500">{score} / {maxScore} puan · geçme notu %{passPercent}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-emerald-50 py-2 text-emerald-700"><b className="block text-lg">{correct}</b>Doğru</div>
        <div className="rounded-lg bg-red-50 py-2 text-red-700"><b className="block text-lg">{wrong}</b>Yanlış</div>
        <div className="rounded-lg bg-slate-100 py-2 text-slate-600"><b className="block text-lg">{blank}</b>Boş</div>
      </div>
    </div>
  );
}
