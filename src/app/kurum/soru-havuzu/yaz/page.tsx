import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { DEFAULT_SUBJECTS, GRADES } from "@/modules/question-bank";
import { bankSummary, findWrittenItem } from "@/modules/question-bank/server";
import { gradeSortKey, mergeTopicSuggestions } from "@/modules/curriculum";
import { curriculumOutcomes, curriculumTopicNames } from "@/modules/curriculum/server";
import QuestionWriter from "@/modules/question-bank/ui/QuestionWriter";
import { PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/** Soru yazma: `?mod=yapistir` yapıştır-böl kipinde açılır; `?id=` yazılan bir soruyu düzenler. */
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; mod?: string }> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const [summary, curTopics, cur, edit] = await Promise.all([
    bankSummary(ownerId),
    curriculumTopicNames(ownerId),
    curriculumOutcomes(ownerId),
    sp.id ? findWrittenItem(ownerId, sp.id) : Promise.resolve(null),
  ]);
  if (sp.id && !edit) notFound();
  const subjects = [...new Set([...Object.keys(curTopics), ...summary.subjects, ...DEFAULT_SUBJECTS])].sort((a, b) => a.localeCompare(b, "tr"));
  const grades = [...new Set([...cur.map((r) => r.grade), ...GRADES])].sort((a, b) => gradeSortKey(a).localeCompare(gradeSortKey(b)));

  return (
    <div>
      <PageHeader
        title={edit ? "Soruyu düzenle" : "Soru yaz"}
        sub={edit ? undefined : "Tek tek yazın ya da Word'deki soruları yapıştırıp bölün. Kesilecek PDF ya da fotoğraf için Kaynaklar sekmesi."}
        back={{ href: "/kurum/soru-havuzu", label: "Soru havuzu" }}
      />
      <QuestionWriter subjects={subjects} topics={mergeTopicSuggestions(curTopics, summary.topics)} grades={grades} outcomes={cur} edit={edit} initialMode={sp.mod === "yapistir" ? "yapistir" : "tek"} />
    </div>
  );
}
