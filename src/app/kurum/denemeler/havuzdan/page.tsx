import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { bankPickerItems, similarPairs } from "@/modules/question-bank/server";
import { listCourses } from "@/modules/schedule/server";
import { curriculumTopicNames } from "@/modules/curriculum/server";
import { gradeSortKey, subjectKey, topicKey } from "@/modules/curriculum";
import { classroomsOf } from "@/modules/enrollment/server";
import { bankUsage, findExam } from "@/modules/exams/server";
import { toInputDate } from "@/shared/date";
import BankExamBuilder from "@/modules/exams/ui/BankExamBuilder";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/**
 * `?ders=` ile ders seçili açılır (sınıf sayfasından "çalışma kağıdı / sınav hazırla").
 * `?sec=id1,id2&amac=calisma&ad=…`: sorular seçili açılır (yanlışlara benzer sorular sayfasından).
 * `?duzenle=<deneme>`: havuzdan kurulmuş, sonucu girilmemiş denemenin soruları düzenlenir.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ ders?: string; sec?: string; amac?: string; ad?: string; duzenle?: string }> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const exam = sp.duzenle ? await findExam(ownerId, sp.duzenle) : null;
  if (sp.duzenle && !exam) notFound();
  const inExam = exam ? exam.secs.flatMap((s) => s.items ?? []) : [];
  if (exam && (!inExam.length || exam.resultCount)) redirect(`/kurum/denemeler/${exam.id}`);
  const [bank, usage, courses, similar, curTopics, rooms] = await Promise.all([
    bankPickerItems(ownerId, 5000, inExam),
    bankUsage(ownerId, exam?.id),
    listCourses(ownerId),
    similarPairs(ownerId),
    curriculumTopicNames(ownerId),
    classroomsOf(ownerId),
  ]);
  const levelOf = new Map(rooms.map((r) => [r.id, r.level ?? ""]));
  // Havuzdaki sınıf / seviye değerleri, sınıf sırasıyla (sınıf süzgeci)
  const grades = [...new Set(bank.map((q) => q.grade).filter(Boolean))].sort((a, b) => gradeSortKey(a).localeCompare(gradeSortKey(b), "tr"));
  // Konu süzgeci müfredat sırasıyla dizilsin: "ders<TAB>konu" → müfredattaki sırası (müfredatta olmayan konu yok)
  const curOrder = new Map(Object.entries(curTopics).map(([s, list]) => [subjectKey(s), new Map(list.map((t, i) => [topicKey(t), i]))]));
  const topicRank: Record<string, number> = {};
  for (const q of bank) {
    const i = q.topic ? curOrder.get(subjectKey(q.subject))?.get(topicKey(q.topic)) : undefined;
    if (i !== undefined) topicRank[`${q.subject}\t${q.topic}`] = i;
  }
  const edit = exam
    ? {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        date: toInputDate(exam.date),
        booklets: exam.letters.length,
        purpose: exam.purpose,
        courseId: exam.courseId ?? "",
        sections: exam.secs.filter((s) => s.items?.length).map((s) => ({ name: s.name, items: s.items! })),
      }
    : undefined;
  const known = new Set(bank.map((q) => q.id));
  const picked = [...new Set((sp.sec ?? "").split(",").filter((x) => known.has(x)))];
  const preset = picked.length ? { items: picked, name: (sp.ad ?? "").slice(0, 120), worksheet: sp.amac === "calisma" } : undefined;
  const items = bank.map((q) => ({ ...q, uses: usage.usage[q.id]?.uses.length ?? 0, classIds: usage.usage[q.id]?.classIds ?? [] }));
  return (
    <div>
      {exam ? (
        <PageHeader title="Soruları düzenle" sub="Soru ekleyin, çıkarın ya da sırasını değiştirin; kaydedince cevap anahtarı, konular ve kitapçıklar yeniden hazırlanır. Sorunun kendisi soru havuzunda düzenlenir." back={{ href: `/kurum/denemeler/${exam.id}`, label: exam.name }} />
      ) : (
        <PageHeader title="Havuzdan sınav / çalışma kağıdı" sub="Bölümlere havuzdan soru seçin; cevap anahtarı ve konular kendiliğinden dolar. Çalışma kağıdı puanlanmaz, yalnızca yazdırılır." back={{ href: "/kurum/denemeler", label: "Denemeler" }} />
      )}
      {items.length === 0 ? (
        <Empty>
          Soru havuzu boş. Önce <Link href="/kurum/soru-havuzu/yaz" className="font-semibold text-graphite underline">soru yazın</Link> ya da{" "}
          <Link href="/kurum/soru-havuzu/kaynaklar" className="font-semibold text-graphite underline">bir kaynaktan soru kesin</Link>.
        </Empty>
      ) : (
        <BankExamBuilder
          items={items}
          similar={similar}
          topicRank={topicRank}
          grades={grades}
          preset={edit ? undefined : preset}
          edit={edit}
          courses={courses
            .filter((c) => c.kind !== "STUDY")
            .map((c) => ({ id: c.id, label: `${c.classroomName} · ${c.name}`, classroomId: c.classroomId, classroomName: c.classroomName, subject: c.name, level: levelOf.get(c.classroomId) ?? "" }))}
          initialCourse={courses.some((c) => c.id === sp.ders) ? sp.ders : ""}
        />
      )}
    </div>
  );
}
