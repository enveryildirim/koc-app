import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { COURSE_KIND_KEYS } from "@/modules/schedule";
import { criteriaError, parseCriteria, type Criterion } from "../index";

function parseRubric(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  if (!name) throw invalid("Cetvel adı gerekli.");
  const kind = String(body.kind ?? "");
  if (kind && !COURSE_KIND_KEYS.includes(kind)) throw invalid("Geçersiz ders türü.");
  const err = criteriaError(body.criteria);
  if (err) throw invalid(err);
  const criteria = (body.criteria as Criterion[]).map((c) => ({ name: String(c.name).trim(), max: Number(c.max) }));
  return { name, kind, criteria: JSON.stringify(criteria) };
}

/** Kurumun puan cetvelleri (ada göre), kriterleri çözülmüş. */
export async function listRubrics(ownerId: string) {
  const list = await prisma.rubric.findMany({ where: { ownerId } });
  return list
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, criteria: parseCriteria(r.criteria) }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function createRubric(ownerId: string, body: Record<string, unknown>) {
  return prisma.rubric.create({ data: { ownerId, ...parseRubric(body) } });
}

export async function updateRubric(ownerId: string, id: string, body: Record<string, unknown>) {
  const r = await prisma.rubric.findFirst({ where: { id, ownerId } });
  if (!r) throw notFound();
  await prisma.rubric.update({ where: { id: r.id }, data: parseRubric(body) });
}

/** Cetveli siler. Açılmış değerlendirmeler kendi kopyalarını taşıdığı için etkilenmez. */
export async function deleteRubric(ownerId: string, id: string) {
  const r = await prisma.rubric.findFirst({ where: { id, ownerId } });
  if (!r) throw notFound();
  await prisma.rubric.delete({ where: { id: r.id } });
}
