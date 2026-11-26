import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { bankSummary, findSource } from "@/modules/question-bank/server";
import { mergeGrades, mergeSubjectNames, mergeTopicSuggestions } from "@/modules/curriculum";
import { curriculumOutcomes, curriculumTopicNames } from "@/modules/curriculum/server";
import { listCourses } from "@/modules/schedule/server";
import { classroomsOf } from "@/modules/enrollment/server";
import CropStudio from "@/modules/question-bank/ui/CropStudio";
import { PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const source = await findSource(ownerId, (await params).id);
  if (!source) notFound();
  const [summary, curTopics, cur, courses, rooms] = await Promise.all([bankSummary(ownerId), curriculumTopicNames(ownerId), curriculumOutcomes(ownerId), listCourses(ownerId), classroomsOf(ownerId)]);
  // Seçenekler yalnız kurumun girdiklerinden (soru yazma ekranıyla aynı): Dersler, müfredat, havuz; sınıfların düzeyi
  const subjects = mergeSubjectNames(courses.filter((c) => c.kind !== "STUDY").map((c) => c.name), Object.keys(curTopics), summary.subjects);
  const grades = mergeGrades(rooms.map((r) => r.level), cur.map((r) => r.grade), summary.grades);

  return (
    <div>
      <PageHeader title={source.name} sub="Soruları kutulayın, cevaplarını işaretleyin, havuza ekleyin." back={{ href: "/kurum/soru-havuzu/kaynaklar", label: "Kaynaktan soru kes" }} />
      <CropStudio
        source={{ id: source.id, name: source.name, kind: source.kind, files: source.files }}
        saved={source.cut}
        subjects={subjects}
        grades={grades}
        topics={mergeTopicSuggestions(curTopics, summary.topics)}
      />
    </div>
  );
}
