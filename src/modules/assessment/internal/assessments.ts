import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { ymd } from "@/shared/date";
import { listStudents } from "@/modules/enrollment/server";
import { findCourse, teachesSubject } from "@/modules/schedule/server";
import { findPlanItem } from "@/modules/planning/server";
import { ASSESSMENT_TYPE_KEYS, maxTotalOf, parseCriteria } from "../index";

/*
 * Değerlendirme: bir derste, bir tarihte yapılan sözlü / yazılı / uygulama. Kriterler açılışta
 * cetvelden kopyalanır; cetvel sonradan değişse de puanlar bozulmaz.
 * `teacherId` verilen fonksiyonlar öğretmen oturumu içindir: yalnızca girdiği dersler.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
type Opts = { teacherId?: string };

/** Dersi döndürür; öğretmen oturumunda o dersin öğretmeni değilse notFound. */
async function courseFor(ownerId: string, courseId: string, opts: Opts) {
  const c = await findCourse(ownerId, courseId);
  if (!c) throw notFound("Ders bulunamadı.");
  if (opts.teacherId && c.teacherId !== opts.teacherId && !(await teachesSubject(ownerId, opts.teacherId, c.classroomId, c.name))) throw notFound("Ders bulunamadı.");
  return c;
}

/** Değerlendirmeyi döndürür; öğretmen oturumunda kendi dersi değilse notFound. */
async function ownedAssessment(ownerId: string, id: string, opts: Opts) {
  const a = await prisma.assessment.findFirst({ where: { id, ownerId } });
  if (!a) throw notFound("Değerlendirme bulunamadı.");
  await courseFor(ownerId, a.courseId, opts);
  return a;
}

/**
 * Yeni değerlendirme. Gövde: { courseId, rubricId, type, date?, title?, planItemId? }.
 * `by`: açan öğretmen / etüt mesulü (kayıt için).
 */
export async function createAssessment(ownerId: string, body: Record<string, unknown>, opts: Opts & { by?: string | null } = {}) {
  const course = await courseFor(ownerId, String(body.courseId ?? ""), opts);
  const type = String(body.type ?? "ORAL");
  if (!ASSESSMENT_TYPE_KEYS.includes(type)) throw invalid("Geçersiz değerlendirme türü.");
  const date = String(body.date || ymd());
  if (!YMD.test(date)) throw invalid("Geçerli bir tarih girin.");
  const rubric = await prisma.rubric.findFirst({ where: { id: String(body.rubricId ?? ""), ownerId } });
  if (!rubric) throw invalid("Puan cetveli seçin.");
  const criteria = parseCriteria(rubric.criteria);
  let planItemId: string | null = null;
  let planTopic = "";
  if (body.planItemId) {
    const item = await findPlanItem(ownerId, String(body.planItemId));
    if (!item || item.classroomId !== course.classroomId || item.subject !== course.name) throw invalid("Plan konusu bu derse ait değil.");
    planItemId = item.id;
    planTopic = item.topic;
  }
  const title = String(body.title ?? "").trim() || planTopic || rubric.name;
  return prisma.assessment.create({
    data: {
      ownerId, courseId: course.id, teacherId: opts.by ?? null, date, title: title.slice(0, 80), type,
      rubricName: rubric.name, criteria: JSON.stringify(criteria), maxTotal: maxTotalOf(criteria), planItemId, planTopic,
    },
  });
}

export async function deleteAssessment(ownerId: string, id: string, opts: Opts = {}) {
  const a = await ownedAssessment(ownerId, id, opts);
  await prisma.assessment.delete({ where: { id: a.id } });
}

export type AssessmentFilter = { courseIds?: string[]; classroomId?: string; from?: string };

/** Değerlendirmeler (yeniden eskiye): ders, sınıf, kaç öğrenci puanlandı ve ortalama yüzde. */
export async function listAssessments(ownerId: string, f: AssessmentFilter = {}, take = 100) {
  const list = await prisma.assessment.findMany({
    where: {
      ownerId,
      ...(f.courseIds ? { courseId: { in: f.courseIds } } : {}),
      ...(f.classroomId ? { course: { classroomId: f.classroomId } } : {}),
      ...(f.from ? { date: { gte: f.from } } : {}),
    },
    include: { course: { select: { name: true, kind: true, classroom: { select: { id: true, name: true } } } }, scores: { select: { percent: true, absent: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
  return list.map((a) => {
    const scored = a.scores.filter((s) => !s.absent && s.percent !== null);
    return {
      id: a.id, date: a.date, title: a.title, type: a.type, rubricName: a.rubricName, planTopic: a.planTopic,
      courseId: a.courseId, course: a.course.name, kind: a.course.kind, classroomId: a.course.classroom.id, classroom: a.course.classroom.name,
      scored: scored.length, absent: a.scores.filter((s) => s.absent).length,
      avg: scored.length ? scored.reduce((s, x) => s + x.percent!, 0) / scored.length : null,
    };
  });
}

/** Puan girişi ve sonuç ekranı: değerlendirme, sınıfın öğrencileri (ek üyeler dahil) ve girilmiş puanlar. */
export async function assessmentSheet(ownerId: string, id: string, opts: Opts = {}) {
  const a = await prisma.assessment.findFirst({ where: { id, ownerId } });
  if (!a) return null;
  const course = await courseFor(ownerId, a.courseId, opts).catch(() => null);
  if (!course) return null;
  const [students, scores] = await Promise.all([
    listStudents(ownerId, { inClass: course.classroomId }, "name"),
    prisma.assessmentScore.findMany({ where: { assessmentId: a.id } }),
  ]);
  const byStudent = new Map(scores.map((s) => [s.studentId, s]));
  // Sınıftan sonradan ayrılmış ama puanı olan öğrenciler de sonuçta kalsın
  const missingIds = scores.map((s) => s.studentId).filter((sid) => !students.some((st) => st.id === sid));
  const former = missingIds.length ? await listStudents(ownerId, { ids: missingIds }, "name") : [];
  return {
    assessment: { ...a, criteria: parseCriteria(a.criteria) },
    course: { id: course.id, name: course.name, kind: course.kind, classroomId: course.classroomId, classroom: course.classroom.name, teacher: course.teacher?.name ?? null },
    students: [...students, ...former]
      .map((s) => {
        const sc = byStudent.get(s.id);
        return {
          id: s.id, no: s.studentNo, name: `${s.firstName} ${s.lastName}`,
          guest: s.classroomId !== course.classroomId ? (s.classroom?.name ?? null) : null,
          score: sc ? { scores: JSON.parse(sc.scores) as number[], total: sc.total, percent: sc.percent, note: sc.note, absent: sc.absent } : null,
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name, "tr")),
  };
}

/**
 * Bir öğrencinin puanını kaydeder. Gövde: { studentId, scores: number[], note?, absent? } ya da { studentId, clear: true }.
 * Puanlar kriter sırasıyla, 0 ile kriterin en yüksek puanı arasında olmalı.
 */
export async function saveScore(ownerId: string, id: string, body: Record<string, unknown>, opts: Opts = {}) {
  const a = await ownedAssessment(ownerId, id, opts);
  const studentId = String(body.studentId ?? "");
  const course = await findCourse(ownerId, a.courseId);
  const ok = await listStudents(ownerId, { ids: [studentId], inClass: course!.classroomId });
  if (!ok.length) throw invalid("Öğrenci bu sınıfta değil.");
  if (body.clear) {
    await prisma.assessmentScore.deleteMany({ where: { assessmentId: a.id, studentId } });
    return { ok: true };
  }
  const note = String(body.note ?? "").trim().slice(0, 300);
  const absent = !!body.absent;
  const criteria = parseCriteria(a.criteria);
  let scores: number[] = [];
  let total: number | null = null;
  let percent: number | null = null;
  if (!absent) {
    if (!Array.isArray(body.scores) || body.scores.length !== criteria.length) throw invalid("Her kriter için puan girin.");
    scores = body.scores.map(Number);
    scores.forEach((v, i) => {
      if (!Number.isFinite(v) || v < 0 || v > criteria[i].max) throw invalid(`“${criteria[i].name}” 0–${criteria[i].max} arasında olmalı.`);
    });
    total = scores.reduce((s, x) => s + x, 0);
    percent = Math.round((total * 1000) / a.maxTotal) / 10;
  }
  const data = { scores: JSON.stringify(scores), total, percent, note, absent };
  await prisma.assessmentScore.upsert({
    where: { assessmentId_studentId: { assessmentId: a.id, studentId } },
    update: data,
    create: { assessmentId: a.id, studentId, ...data },
  });
  return { ok: true, total, percent };
}

/** Öğrencinin değerlendirmeleri (yeniden eskiye), ders ve tarihle. Öğrenci profili ve veli görünümü için. */
export async function studentAssessments(ownerId: string, studentId: string, take = 50) {
  const list = await prisma.assessmentScore.findMany({
    where: { studentId, assessment: { ownerId } },
    include: { assessment: { include: { course: { select: { name: true, kind: true } } } } },
    orderBy: { assessment: { date: "desc" } },
    take,
  });
  return list.map((s) => ({
    id: s.assessment.id, date: s.assessment.date, title: s.assessment.title, type: s.assessment.type,
    course: s.assessment.course.name, kind: s.assessment.course.kind, percent: s.percent, absent: s.absent, note: s.note,
  }));
}

/**
 * Sınıfın derslerine göre değerlendirme özeti (son `days` gün): değerlendirme sayısı, ortalama yüzde ve
 * bu sürede hiç puanlanmamış öğrenci sayısı.
 */
export async function classAssessmentSummary(ownerId: string, classroomId: string, days = 30) {
  const from = ymd(new Date(Date.now() - days * 86400000));
  const [assessments, students] = await Promise.all([
    prisma.assessment.findMany({
      where: { ownerId, date: { gte: from }, course: { classroomId } },
      include: { scores: { select: { studentId: true, percent: true, absent: true } } },
    }),
    listStudents(ownerId, { inClass: classroomId }),
  ]);
  const byCourse = new Map<string, { count: number; sum: number; n: number; seen: Set<string> }>();
  for (const a of assessments) {
    const c = byCourse.get(a.courseId) ?? { count: 0, sum: 0, n: 0, seen: new Set<string>() };
    c.count++;
    for (const s of a.scores) {
      if (s.absent || s.percent === null) continue;
      c.sum += s.percent;
      c.n++;
      c.seen.add(s.studentId);
    }
    byCourse.set(a.courseId, c);
  }
  return new Map(
    [...byCourse].map(([courseId, c]) => [
      courseId,
      { count: c.count, avg: c.n ? c.sum / c.n : null, unassessed: students.filter((s) => !c.seen.has(s.id)).length },
    ]),
  );
}
