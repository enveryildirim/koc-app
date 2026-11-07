import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/server";
import { ASSESSMENT_TYPES, assessmentSheet } from "@/modules/assessment/server";
import ScoreEntry from "@/modules/assessment/ui/ScoreEntry";
import DeleteAssessment from "@/modules/assessment/ui/DeleteAssessment";

export const dynamic = "force-dynamic";

/** Puan girişi (telefon). Öğretmen yalnızca kendi dersinin değerlendirmesini açar. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const sheet = await assessmentSheet(me.ownerId, (await params).id, { teacherId: me.role === "TEACHER" ? me.teacherId : undefined });
  if (!sheet) notFound();
  const { assessment: a, course, students } = sheet;
  const dateLabel = new Date(a.date + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-3">
      <div>
        <Link href="/ogretmen/degerlendirme" className="text-[13px] text-lead">‹ Sözlü ve yazılı</Link>
        <h1 className="font-display text-xl font-bold leading-tight">{a.title}</h1>
        <p className="text-[13px] text-lead">
          {ASSESSMENT_TYPES[a.type]?.label} · {course.name} · {course.classroom} · {dateLabel}
        </p>
        <p className="text-[13px] text-lead">{a.rubricName}: {a.criteria.map((c) => `${c.name} ${c.max}`).join(" · ")}</p>
      </div>
      <ScoreEntry assessmentId={a.id} criteria={a.criteria} maxTotal={a.maxTotal} students={students.map((s) => ({ id: s.id, no: s.no, name: s.name, guest: s.guest, score: s.score }))} />
      <div className="text-right"><DeleteAssessment id={a.id} backHref="/ogretmen/degerlendirme" /></div>
    </div>
  );
}
