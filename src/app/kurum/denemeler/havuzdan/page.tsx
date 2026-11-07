import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { bankPickerItems } from "@/modules/question-bank/server";
import { listCourses } from "@/modules/schedule/server";
import BankExamBuilder from "@/modules/exams/ui/BankExamBuilder";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/** `?ders=` ile ders seçili açılır (sınıf sayfasından "çalışma kağıdı / sınav hazırla"). */
export default async function Page({ searchParams }: { searchParams: Promise<{ ders?: string }> }) {
  const ownerId = await requireOwner();
  const [items, courses, sp] = await Promise.all([bankPickerItems(ownerId), listCourses(ownerId), searchParams]);
  return (
    <div>
      <PageHeader title="Havuzdan sınav / çalışma kağıdı" sub="Bölümlere havuzdan soru seçin; cevap anahtarı ve konular kendiliğinden dolar. Çalışma kağıdı puanlanmaz, yalnızca yazdırılır." back={{ href: "/kurum/denemeler", label: "Denemeler" }} />
      {items.length === 0 ? (
        <Empty>
          Soru havuzu boş. Önce <Link href="/kurum/soru-havuzu/kaynaklar" className="font-semibold text-graphite underline">bir kaynaktan soru kesin</Link>.
        </Empty>
      ) : (
        <BankExamBuilder
          items={items}
          courses={courses.filter((c) => c.kind !== "STUDY").map((c) => ({ id: c.id, label: `${c.classroomName} · ${c.name}` }))}
          initialCourse={courses.some((c) => c.id === sp.ders) ? sp.ders : ""}
        />
      )}
    </div>
  );
}
