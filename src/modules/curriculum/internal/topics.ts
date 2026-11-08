import { prisma } from "@/shared/db";
import { invalid } from "@/shared/errors";
import { subjectMatches } from "@/shared/subjects";
import { gradeScope, gradeSortKey, normGrade, planSourceOf, SAMPLE_CURRICULUM, topicKey, type CurriculumRow } from "../index";

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Gelen satırı doğrular; hatalıysa invalid fırlatır. */
function cleanRow(r: Partial<CurriculumRow>, i: number): CurriculumRow {
  const subject = str(r.subject, 60);
  const grade = normGrade(str(r.grade, 20));
  const topic = str(r.topic, 120);
  const weeks = Math.round(Number(r.weeks ?? 1));
  if (!subject || !grade) throw invalid(`${i + 1}. satır: ders ve sınıf gerekli.`);
  if (!topic) throw invalid(`${i + 1}. satır: konu boş.`);
  if (!(weeks >= 1 && weeks <= 20)) throw invalid(`${i + 1}. satır: hafta 1–20 arası olmalı.`);
  return { subject, grade, topic, weeks, unit: str(r.unit, 120), code: str(r.code, 40), outcome: str(r.outcome, 400) };
}

/** Kurumun müfredat setleri (ders + sınıf), konu ve toplam hafta sayılarıyla. */
export async function curriculumSets(ownerId: string) {
  const rows = await prisma.curriculumTopic.groupBy({
    by: ["subject", "grade"],
    where: { ownerId },
    _count: { _all: true },
    _sum: { weeks: true },
  });
  return rows
    .map((r) => ({ subject: r.subject, grade: r.grade, topics: r._count._all, weeks: r._sum.weeks ?? 0 }))
    .sort((a, b) => gradeSortKey(a.grade).localeCompare(gradeSortKey(b.grade), "tr") || a.subject.localeCompare(b.subject, "tr"));
}

/** Bir setin konuları (sırasıyla). */
export async function curriculumTopics(ownerId: string, subject: string, grade: string) {
  return prisma.curriculumTopic.findMany({ where: { ownerId, subject, grade }, orderBy: { order: "asc" } });
}

/** Tüm müfredat (dışa aktarma ve diğer ekranlardaki konu önerileri için). */
export async function allCurriculum(ownerId: string) {
  return prisma.curriculumTopic.findMany({
    where: { ownerId },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { order: "asc" }],
    select: { subject: true, grade: true, unit: true, topic: true, code: true, outcome: true, weeks: true },
  });
}

/** Ders → konu adları (tüm düzeyler birleşik, müfredat sırasıyla). Soru havuzu ve anahtar ekranındaki öneriler için. */
export async function curriculumTopicNames(ownerId: string) {
  const rows = await allCurriculum(ownerId);
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const list = (out[r.subject] ??= []);
    if (!list.includes(r.topic)) list.push(r.topic);
  }
  return out;
}

/**
 * Setlerin satırlarını yazar: her (ders, sınıf) seti verilen sırayla yeniden yazılır. Var olan konuların kimliği
 * korunur (aynı ünite + konu adı, sırayla), çünkü yıllık plan satırları konuya kimlikle bağlıdır. Yeni konular
 * eklenir, listede olmayanlar silinir (bağlı plan satırları konu metniyle kalır, bağı boşalır).
 */
async function writeSets(ownerId: string, rows: CurriculumRow[]) {
  const sets = new Map<string, CurriculumRow[]>();
  for (const r of rows) {
    const k = `${r.subject}\u0000${r.grade}`;
    (sets.get(k) ?? sets.set(k, []).get(k)!).push(r);
  }
  const ops = [];
  for (const list of sets.values()) {
    const { subject, grade } = list[0];
    const existing = await prisma.curriculumTopic.findMany({ where: { ownerId, subject, grade }, orderBy: { order: "asc" }, select: { id: true, unit: true, topic: true } });
    const pool = new Map<string, string[]>();
    const key = (unit: string, topic: string) => `${topicKey(unit)}\u0000${topicKey(topic)}`;
    for (const e of existing) (pool.get(key(e.unit, e.topic)) ?? pool.set(key(e.unit, e.topic), []).get(key(e.unit, e.topic))!).push(e.id);
    const kept = new Set<string>();
    const fresh: (CurriculumRow & { ownerId: string; order: number })[] = [];
    list.forEach((r, i) => {
      const id = pool.get(key(r.unit, r.topic))?.shift();
      const data = { ...r, ownerId, order: i };
      if (id) {
        kept.add(id);
        ops.push(prisma.curriculumTopic.update({ where: { id }, data }));
      } else fresh.push(data);
    });
    const gone = existing.filter((e) => !kept.has(e.id)).map((e) => e.id);
    if (gone.length) ops.push(prisma.curriculumTopic.deleteMany({ where: { id: { in: gone } } }));
    if (fresh.length) ops.push(prisma.curriculumTopic.createMany({ data: fresh }));
  }
  await prisma.$transaction(ops);
  return { sets: sets.size, subjects: [...new Set(rows.map((r) => r.subject))] };
}

/** Düzenleme ekranından bir setin tamamını kaydeder (sıra = gönderilen sıra). Boş liste seti siler. */
export async function saveCurriculumSet(ownerId: string, subject: unknown, grade: unknown, rows: unknown) {
  const s = str(subject, 60);
  const g = normGrade(str(grade, 20));
  if (!s || !g) throw invalid("Ders ve sınıf gerekli.");
  if (!Array.isArray(rows)) throw invalid("Geçersiz istek.");
  if (rows.length > 500) throw invalid("Bir sette en fazla 500 konu olabilir.");
  const clean = (rows as Partial<CurriculumRow>[]).map((r, i) => cleanRow({ ...r, subject: s, grade: g }, i));
  if (!clean.length) {
    await prisma.curriculumTopic.deleteMany({ where: { ownerId, subject: s, grade: g } });
    return { saved: 0, subjects: [s] };
  }
  await writeSets(ownerId, clean);
  return { saved: clean.length, subjects: [s] };
}

/**
 * Excel içe aktarma. mode "replace": dosyada geçen her (ders, sınıf) setinin yerine dosyadaki konular yazılır;
 * "append": var olan setin sonuna eklenir. Dosyada geçmeyen setlere dokunulmaz.
 */
export async function importCurriculum(ownerId: string, rows: unknown, mode: unknown) {
  if (!Array.isArray(rows) || !rows.length) throw invalid("İçe aktarılacak konu yok.");
  if (rows.length > 5000) throw invalid("Tek seferde en fazla 5000 satır aktarılabilir.");
  const clean = (rows as Partial<CurriculumRow>[]).map(cleanRow);
  let final = clean;
  if (mode === "append") {
    const keys = [...new Set(clean.map((r) => `${r.subject}\u0000${r.grade}`))];
    const existing = await prisma.curriculumTopic.findMany({
      where: { ownerId, OR: keys.map((k) => ({ subject: k.split("\u0000")[0], grade: k.split("\u0000")[1] })) },
      orderBy: { order: "asc" },
      select: { subject: true, grade: true, unit: true, topic: true, code: true, outcome: true, weeks: true },
    });
    final = [...existing, ...clean];
  }
  const { sets, subjects } = await writeSets(ownerId, final);
  return { rows: clean.length, sets, subjects };
}

/** Örnek müfredatı yükler; kurumda zaten bulunan (ders, sınıf) setlerine dokunmaz. */
export async function loadSampleCurriculum(ownerId: string) {
  const have = new Set((await curriculumSets(ownerId)).map((s) => `${s.subject}\u0000${s.grade}`));
  const rows = SAMPLE_CURRICULUM.filter((r) => !have.has(`${r.subject}\u0000${r.grade}`));
  if (!rows.length) return { rows: 0, sets: 0, subjects: [] as string[] };
  return { rows: rows.length, ...(await writeSets(ownerId, rows)) };
}

export async function deleteCurriculumSet(ownerId: string, subject: unknown, grade: unknown) {
  const r = await prisma.curriculumTopic.deleteMany({ where: { ownerId, subject: str(subject, 60), grade: str(grade, 20) } });
  return { deleted: r.count };
}

export type PlanTemplate = { subject: string; grade: string; topics: number; source: string };

/**
 * Yıllık plan ekranı için: her sınıfa, düzeyine uyan müfredat setlerinden hazır plan metni.
 * Düzeyi girilmemiş sınıfa bütün setler önerilir.
 */
export async function planTemplatesByClass(ownerId: string, classrooms: { id: string; level: string }[]) {
  const rows = await allCurriculum(ownerId);
  const sets = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.subject}\u0000${r.grade}`;
    (sets.get(k) ?? sets.set(k, []).get(k)!).push(r);
  }
  const templates: PlanTemplate[] = [...sets.values()].map((l) => ({
    subject: l[0].subject,
    grade: l[0].grade,
    topics: l.length,
    source: planSourceOf(l),
  }));
  return Object.fromEntries(
    classrooms.map((c) => [c.id, c.level ? templates.filter((t) => gradeScope(t.grade).levels.includes(c.level)) : templates]),
  ) as Record<string, PlanTemplate[]>;
}

/**
 * Bir sınıfın bir dersine karşılık gelen müfredat seti (yıllık plan konularını bağlamak için): ders adı eşleşen
 * ve düzeyi sınıfın düzeyini kapsayan set; sınıf düzeyiyle birebir aynı olan önceliklidir. Yoksa boş liste.
 */
export async function curriculumForClass(ownerId: string, subject: string, level: string) {
  if (!level) return [];
  const sets = (await curriculumSets(ownerId)).filter((s) => subjectMatches(s.subject, subject) && gradeScope(s.grade).levels.includes(level));
  const set = sets.find((s) => s.grade === level && s.subject === subject) ?? sets.find((s) => s.grade === level) ?? sets[0];
  if (!set) return [];
  return prisma.curriculumTopic.findMany({
    where: { ownerId, subject: set.subject, grade: set.grade },
    orderBy: { order: "asc" },
    select: { id: true, unit: true, topic: true, weeks: true },
  });
}
