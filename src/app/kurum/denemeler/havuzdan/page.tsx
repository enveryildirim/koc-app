import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { bankPickerItems, similarPairs } from "@/modules/question-bank/server";
import { listCourses } from "@/modules/schedule/server";
import { bankUsage } from "@/modules/exams/server";
import BankExamBuilder from "@/modules/exams/ui/BankExamBuilder";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/**
 * `?ders=` ile ders seçili açılır (sınıf sayfasından "çalışma kağıdı / sınav hazırla").
 * `?sec=id1,id2&amac=calisma&ad=…`: sorular seçili açılır (yanlışlara benzer sorular sayfasından).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ ders?: string; sec?: string; amac?: string; ad?: string }> }) {
  const ownerId = await requireOwner();
  const [bank, usage, courses, sp, similar] = await Promise.all([bankPickerItems(ownerId), bankUsage(ownerId), listCourses(ownerId), searchParams, similarPairs(ownerId)]);
  const known = new Set(bank.map((q) => q.id));
  const picked = [...new Set((sp.sec ?? "").split(",").filter((x) => known.has(x)))];
  const preset = picked.length ? { items: picked, name: (sp.ad ?? "").slice(0, 120), worksheet: sp.amac === "calisma" } : undefined;
  const items = bank.map((q) => ({ ...q, uses: usage.usage[q.id]?.uses.length ?? 0, classIds: usage.usage[q.id]?.classIds ?? [] }));
  return (
    <div>
      <PageHeader title="Havuzdan sınav / çalışma kağıdı" sub="Bölümlere havuzdan soru seçin; cevap anahtarı ve konular kendiliğinden dolar. Çalışma kağıdı puanlanmaz, yalnızca yazdırılır." back={{ href: "/kurum/denemeler", label: "Denemeler" }} />
      {items.length === 0 ? (
        <Empty>
          Soru havuzu boş. Önce <Link href="/kurum/soru-havuzu/yaz" className="font-semibold text-graphite underline">soru yazın</Link> ya da{" "}
          <Link href="/kurum/soru-havuzu/kaynaklar" className="font-semibold text-graphite underline">bir kaynaktan soru kesin</Link>.
        </Empty>
      ) : (
        <BankExamBuilder
          items={items}
          similar={similar}
          preset={preset}
          courses={courses.filter((c) => c.kind !== "STUDY").map((c) => ({ id: c.id, label: `${c.classroomName} · ${c.name}`, classroomId: c.classroomId, classroomName: c.classroomName }))}
          initialCourse={courses.some((c) => c.id === sp.ders) ? sp.ders : ""}
        />
      )}
    </div>
  );
}
