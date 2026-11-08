import { requireOwner } from "@/modules/identity/server";
import { listRubrics } from "@/modules/assessment/server";
import { PageHeader } from "@/shared/ui/kurum";
import RubricManager from "@/modules/assessment/ui/RubricManager";

export const dynamic = "force-dynamic";

/** Puan cetvelleri: sözlü / yazılı / uygulama değerlendirmelerinin kriterleri. */
export default async function Page() {
  const ownerId = await requireOwner();
  return (
    <>
      <PageHeader title="Puan cetvelleri" sub="Sözlü, yazılı ve uygulama değerlendirmelerinde kullanılan kriterler. Öğretmenler değerlendirme başlatırken seçer." />
      <RubricManager rubrics={await listRubrics(ownerId)} />
    </>
  );
}
