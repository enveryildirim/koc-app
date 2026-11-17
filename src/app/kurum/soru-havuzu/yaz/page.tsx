import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { DEFAULT_SUBJECTS, GRADES } from "@/modules/question-bank";
import { bankSummary, findWrittenItem } from "@/modules/question-bank/server";
import { gradeSortKey, mergeSubjectNames, mergeTopicSuggestions, normGrade } from "@/modules/curriculum";
import { listCourses } from "@/modules/schedule/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { curriculumOutcomes, curriculumTopicNames } from "@/modules/curriculum/server";
import QuestionWriter from "@/modules/question-bank/ui/QuestionWriter";
import { PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/** Soru yazma: `?mod=yapistir` yapıştır-böl kipinde açılır; `?id=` yazılan bir soruyu düzenler. */
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; mod?: string }> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const [summary, curTopics, cur, courses, rooms, edit] = await Promise.all([
    bankSummary(ownerId),
    curriculumTopicNames(ownerId),
    curriculumOutcomes(ownerId),
    listCourses(ownerId),
    classroomsOf(ownerId),
    sp.id ? findWrittenItem(ownerId, sp.id) : Promise.resolve(null),
  ]);
  if (sp.id && !edit) notFound();
  // Ders adları önce Dersler'den (kayıt tek yerden), sonra müfredat, havuz ve varsayılan liste; aynı ders bir kez
  const subjects = mergeSubjectNames(courses.filter((c) => c.kind !== "STUDY").map((c) => c.name), Object.keys(curTopics), summary.subjects, DEFAULT_SUBJECTS);
  // Düzeyler: sınıfların düzeyi (ör. Seviye-2), müfredat ve varsayılanlar
  const grades = [...new Set([...rooms.map((r) => normGrade(r.level)).filter(Boolean), ...cur.map((r) => r.grade), ...GRADES])].sort((a, b) => gradeSortKey(a).localeCompare(gradeSortKey(b)));

  return (
    <div>
      <PageHeader
        title={edit ? "Soruyu düzenle" : "Soru yaz"}
        sub={edit ? undefined : "Tek tek yazın ya da Word'deki soruları yapıştırıp bölün. PDF ya da fotoğraftan kesmek için Soru havuzu → Kaynaktan soru kes."}
        back={{ href: "/kurum/soru-havuzu", label: "Soru havuzu" }}
      />
      <QuestionWriter subjects={subjects} topics={mergeTopicSuggestions(curTopics, summary.topics)} grades={grades} outcomes={cur} edit={edit} initialMode={sp.mod === "yapistir" ? "yapistir" : "tek"} />
    </div>
  );
}
