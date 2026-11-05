import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { DEFAULT_SUBJECTS } from "@/modules/question-bank";
import { bankSummary, findSource } from "@/modules/question-bank/server";
import { mergeTopicSuggestions } from "@/modules/curriculum";
import { curriculumTopicNames } from "@/modules/curriculum/server";
import CropStudio from "@/modules/question-bank/ui/CropStudio";
import { PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const source = await findSource(ownerId, (await params).id);
  if (!source) notFound();
  const [summary, curTopics] = await Promise.all([bankSummary(ownerId), curriculumTopicNames(ownerId)]);
  const subjects = [...new Set([...summary.subjects, ...Object.keys(curTopics), ...DEFAULT_SUBJECTS])].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <div>
      <PageHeader title={source.name} sub="Soruları kutulayın, cevaplarını işaretleyin, havuza ekleyin." back={{ href: "/kurum/soru-havuzu/kaynaklar", label: "Kaynaklar" }} />
      <CropStudio
        source={{ id: source.id, name: source.name, kind: source.kind, files: source.files }}
        saved={source.cut}
        subjects={subjects}
        topics={mergeTopicSuggestions(curTopics, summary.topics)}
      />
    </div>
  );
}
