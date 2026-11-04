import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { cleanStudent } from "@/modules/enrollment";

/**
 * Toplu öğrenci yükleme. rows: [{ studentNo, firstName, lastName, className, phone, parentName, parentPhone }]
 * Aynı numara varsa öğrenci güncellenir; sınıf adı yoksa sınıf oluşturulur.
 */
export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { rows } = (await req.json()) as { rows: Record<string, string>[] };
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "Satır yok." }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "Tek seferde en fazla 2000 öğrenci yüklenebilir." }, { status: 400 });

  const classes = new Map((await prisma.classroom.findMany({ where: { ownerId } })).map((c) => [c.name, c.id]));
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, r] of rows.entries()) {
    const className = String(r.className ?? "").trim().toLocaleUpperCase("tr-TR");
    let classroomId: string | null = null;
    if (className) {
      if (!classes.has(className)) {
        const c = await prisma.classroom.create({ data: { ownerId, name: className, level: className.match(/^\d+/)?.[0] ?? "" } });
        classes.set(className, c.id);
      }
      classroomId = classes.get(className)!;
    }
    const { data, error } = cleanStudent({ ...r, classroomId });
    if (!data) {
      errors.push(`Satır ${i + 2}: ${error}`);
      continue;
    }
    const existing = await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId, studentNo: data.studentNo } } });
    if (existing) {
      await prisma.student.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.student.create({ data: { ownerId, ...data } });
      created++;
    }
  }
  return NextResponse.json({ created, updated, errors });
}
