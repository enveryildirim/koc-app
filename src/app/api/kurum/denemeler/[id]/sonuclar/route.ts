import { NextResponse } from "next/server";
import { apiOwner } from "@/lib/kurum";
import { IncomingRow, loadExam, marksToAnswers, saveResults } from "@/lib/examServer";

/**
 * Sonuç kaydı. İki biçim kabul edilir:
 *  - Optik tarama: { sheets: [{ studentNo, booklet, answers: number[][] }] }
 *  - TXT / elle:   { rows: [{ studentNo, booklet, answers: "ABC D*..." }], source: "TXT" | "MANUAL" }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const exam = ownerId && (await loadExam(ownerId, id));
  if (!exam) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const body = await req.json();

  let rows: IncomingRow[];
  let source: string;
  if (Array.isArray(body.sheets)) {
    rows = body.sheets.map((s: { studentNo: string; booklet: string; answers: number[][] }) => ({
      studentNo: String(s.studentNo ?? ""),
      booklet: s.booklet,
      answers: marksToAnswers(s.answers ?? []),
    }));
    source = "OMR";
  } else if (Array.isArray(body.rows)) {
    rows = body.rows.map((r: IncomingRow) => ({ studentNo: String(r.studentNo ?? ""), booklet: r.booklet, answers: String(r.answers ?? "") }));
    source = body.source === "MANUAL" ? "MANUAL" : "TXT";
  } else {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  return NextResponse.json(await saveResults(exam, rows, source));
}
