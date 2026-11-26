import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { bankSummary, findWrittenItem } from "@/modules/question-bank/server";
import { mergeGrades, mergeSubjectNames, mergeTopicSuggestions } from "@/modules/curriculum";
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
  // Ders adları önce Dersler'den (kayıt tek yerden), sonra müfredat ve havuz; aynı ders bir kez (sabit varsayılan liste yok)
  const subjects = mergeSubjectNames(courses.filter((c) => c.kind !== "STUDY").map((c) => c.name), Object.keys(curTopics), summary.subjects);
  // Düzeyler: sınıfların düzeyi (ör. Seviye-2), müfredat ve havuzdaki sorular; sabit liste yok
  const grades = mergeGrades(rooms.map((r) => r.level), cur.map((r) => r.grade), summary.grades);

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
