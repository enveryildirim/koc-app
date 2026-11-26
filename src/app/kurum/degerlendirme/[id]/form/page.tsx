import { notFound } from "next/navigation";
import { institutionName, requireOwner } from "@/modules/identity/server";
import { ASSESSMENT_TYPES, assessmentSheet } from "@/modules/assessment/server";
import { PageHeader } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

/** Kâğıt puan cetveli: sınıf listesi × kriterler, boş kutular. Derste doldurulup sonra sisteme girilir. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const id = (await params).id;
  const [sheet, org] = await Promise.all([assessmentSheet(ownerId, id), institutionName(ownerId)]);
  if (!sheet) notFound();
  const { assessment: a, course, students } = sheet;
  const cell = "border border-graphite/60 px-2 py-1.5";

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Kâğıt puan cetveli" back={{ href: `/kurum/degerlendirme/${a.id}`, label: a.title }} actions={<PrintButton label="Yazdır" />} />
      </div>
      <div className="paper mx-auto max-w-[190mm] bg-white p-2 text-[12px] text-black">
        <div className="mb-2 flex items-end justify-between border-b-2 border-black pb-1">
          <div>
            <div className="text-[11px]">{org}</div>
            <div className="text-base font-bold">{a.title}</div>
            <div>{ASSESSMENT_TYPES[a.type]?.label} · {course.name} · {course.classroom}{a.planTopic ? ` · ${a.planTopic}` : ""}</div>
          </div>
          <div className="text-right">
            <div>Tarih: {new Date(a.date + "T12:00:00").toLocaleDateString("tr-TR")}</div>
            <div>Öğretmen: {course.teacher ?? "................"}</div>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${cell} w-8`}>#</th>
              <th className={`${cell} w-14`}>No</th>
              <th className={`${cell} text-left`}>Ad Soyad</th>
              {a.criteria.map((c) => (
                <th key={c.name} className={`${cell} w-16`}>{c.name}<br /><span className="font-normal">/{c.max}</span></th>
              ))}
              <th className={`${cell} w-16`}>Toplam<br /><span className="font-normal">/{a.maxTotal}</span></th>
              <th className={`${cell} w-28`}>Not</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{s.no}</td>
                <td className={cell}>{s.name}</td>
                {a.criteria.map((c) => (
                  <td key={c.name} className={cell} />
                ))}
                <td className={cell} />
                <td className={cell} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10.5px]">Gelmeyen öğrencinin satırına “G” yazın. Doldurulan form sonra “Puan gir” ekranından sisteme girilir.</p>
      </div>
    </div>
  );
}
