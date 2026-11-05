import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { bankPickerItems } from "@/modules/question-bank/server";
import BankExamBuilder from "@/modules/exams/ui/BankExamBuilder";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const items = await bankPickerItems(ownerId);
  return (
    <div>
      <PageHeader title="Havuzdan deneme" sub="Bölümlere havuzdan soru seçin; cevap anahtarı ve konular kendiliğinden dolar." back={{ href: "/kurum/denemeler", label: "Denemeler" }} />
      {items.length === 0 ? (
        <Empty>
          Soru havuzu boş. Önce <Link href="/kurum/soru-havuzu/kaynaklar" className="font-semibold text-graphite underline">bir kaynaktan soru kesin</Link>.
        </Empty>
      ) : (
        <BankExamBuilder items={items} />
      )}
    </div>
  );
}
