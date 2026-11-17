import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { practiceSuggestions } from "@/modules/exams/server";
import PracticePicker from "@/modules/exams/ui/PracticePicker";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/**
 * Yanlış yapılan soruların benzerleri (öğretmen isteyince açılır). `?sonuc=` tek öğrenci (karneden), `?sinif=` bir sınıf;
 * ikisi de yoksa denemeye giren herkes.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sonuc?: string; sinif?: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const data = await practiceSuggestions(ownerId, id, { resultId: sp.sonuc, classId: sp.sinif });
  if (!data) notFound();
  const who = data.student ?? (data.students ? `${data.students} öğrenci` : "");
  const back = sp.sonuc ? { href: `/kurum/denemeler/${id}/karne/${sp.sonuc}`, label: "Karne" } : { href: `/kurum/denemeler/${id}`, label: data.exam.name };
  const name = `${data.exam.name} · tekrar${data.student ? ` · ${data.student}` : ""}`.slice(0, 120);
  return (
    <div>
      <PageHeader
        title="Yanlışlara benzer sorular"
        sub={`${data.exam.name}${who ? ` · ${who}` : ""}. Öneriler havuzdan; işaretlediklerinizle çalışma kağıdı hazırlayabilirsiniz.`}
        back={back}
      />
      {!data.fromBank ? (
        <Empty>Bu deneme soru havuzundan kurulmadığı için hangi sorunun yanlış yapıldığı havuzla eşleştirilemiyor.</Empty>
      ) : !data.students ? (
        <Empty>Bu denemenin sonucu yok.</Empty>
      ) : !data.items.length ? (
        <Empty>Yanlış ya da boş bırakılan soru yok.</Empty>
      ) : (
        <PracticePicker data={data} name={name} />
      )}
    </div>
  );
}
