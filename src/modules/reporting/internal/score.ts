/**
 * Başarı Skoru — veri katmanı (sunucu).
 * `scoreSignals` bir tarih itibarıyla öğrenci başına ham ölçümleri toplar; skor ve açıklamalar
 * `../score.ts` içindeki saf fonksiyonlarla hesaplanır. Trend, aynı hesabın 4 hafta öncesi için
 * tekrarıdır; anlık görüntü tablosu tutulmaz.
 */
import { prisma } from "@/shared/db";
import { addDays, ymd } from "@/shared/date";
import { EXAM_TYPES } from "@/modules/exams";
import {
  DIM_KEYS,
  normalizeScoreSettings,
  SCORE_RULES,
  scoreStudent,
  type ScoreLevel,
  type ScoreSettings,
  type ScoreSignals,
} from "../score";

const SETTING_KEY = "score";

export async function scoreSettings(ownerId: string): Promise<ScoreSettings> {
  const row = await prisma.setting.findUnique({ where: { ownerId_key: { ownerId, key: SETTING_KEY } } });
  let raw: unknown = null;
  try {
    raw = row ? JSON.parse(row.value) : null;
  } catch {
    raw = null;
  }
  return normalizeScoreSettings(raw);
}

/** Ayarları doğrulayıp kaydeder; `null` varsayılana döndürür. */
export async function saveScoreSettings(ownerId: string, raw: unknown): Promise<ScoreSettings> {
  if (raw === null) {
    await prisma.setting.deleteMany({ where: { ownerId, key: SETTING_KEY } });
    return normalizeScoreSettings(null);
  }
  const value = normalizeScoreSettings(raw);
  await prisma.setting.upsert({
    where: { ownerId_key: { ownerId, key: SETTING_KEY } },
    create: { ownerId, key: SETTING_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return value;
}

type Filter = { classroomId?: string; studentId?: string };

const endOf = (d: string) => new Date(d + "T23:59:59");
const startOf = (d: string) => new Date(d + "T00:00:00");

/** Kurum içi, sınıfı olan öğrencilerin `asOf` (YYYY-MM-DD) itibarıyla ham ölçümleri. */
export async function scoreSignals(ownerId: string, asOf: string, filter: Filter = {}) {
  const from = addDays(asOf, -SCORE_RULES.days);
  const examFrom = addDays(asOf, -SCORE_RULES.participationDays);
  const students = await prisma.student.findMany({
    where: {
      ownerId,
      external: false,
      classroomId: filter.classroomId || { not: null },
      ...(filter.studentId ? { id: filter.studentId } : {}),
    },
    include: { classroom: true },
    orderBy: { studentNo: "asc" },
  });
  const ids = students.map((s) => s.id);
  const [results, att, hw] = await Promise.all([
    // Yüzdelik ve sınıf denemeleri için kurumun bütün sonuçları gerekir.
    prisma.examResult.findMany({
      where: { exam: { ownerId, date: { lte: endOf(asOf) } } },
      select: {
        studentId: true,
        totalNet: true,
        score: true,
        student: { select: { classroomId: true } },
        exam: { select: { id: true, name: true, type: true, date: true } },
      },
    }),
    prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: ids }, session: { ownerId, date: { gte: from, lte: asOf } } },
      _count: true,
    }),
    prisma.homeworkStatus.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: ids }, homework: { ownerId, dueDate: { gte: startOf(from), lte: endOf(asOf) } } },
      _count: true,
    }),
  ]);

  // Deneme başına puanlar (yüzdelik için) ve sınıfların pencere içindeki denemeleri
  const scoresByExam = new Map<string, number[]>();
  const classExams = new Map<string, Set<string>>();
  for (const r of results) {
    scoresByExam.set(r.exam.id, [...(scoresByExam.get(r.exam.id) ?? []), r.score]);
    const c = r.student.classroomId;
    if (c && r.exam.date >= startOf(examFrom)) {
      if (!classExams.has(c)) classExams.set(c, new Set());
      classExams.get(c)!.add(r.exam.id);
    }
  }
  const percentile = (examId: string, score: number) => {
    const all = scoresByExam.get(examId) ?? [];
    const below = all.filter((x) => x < score).length;
    const equal = all.filter((x) => x === score).length;
    return all.length ? ((below + 0.5 * equal) / all.length) * 100 : 50;
  };
  const byStudent = new Map<string, typeof results>();
  for (const r of results) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  const count = (arr: { studentId: string; status: string; _count: number }[], id: string, st: string) =>
    arr.find((a) => a.studentId === id && a.status === st)?._count ?? 0;

  return students.map((s) => {
    const mine = (byStudent.get(s.id) ?? []).sort((a, b) => a.exam.date.getTime() - b.exam.date.getTime());
    const last = mine[mine.length - 1];
    // Gelişim türü: en az iki denemesi olan türlerden en son girileni; yoksa son denemenin türü.
    const typeCount = new Map<string, number>();
    for (const r of mine) typeCount.set(r.exam.type, (typeCount.get(r.exam.type) ?? 0) + 1);
    const growthType = [...mine].reverse().find((r) => typeCount.get(r.exam.type)! >= 2)?.exam.type ?? last?.exam.type;
    const sameType = growthType ? mine.filter((r) => r.exam.type === growthType).slice(-SCORE_RULES.growthExams) : [];
    const expected = s.classroomId ? (classExams.get(s.classroomId) ?? new Set<string>()) : new Set<string>();
    const present = count(att, s.id, "PRESENT") + count(att, s.id, "LATE");
    const absent = count(att, s.id, "ABSENT");
    const signals: ScoreSignals = {
      lastExam: last
        ? {
            name: last.exam.name,
            percentile: percentile(last.exam.id, last.score),
            participants: scoresByExam.get(last.exam.id)?.length ?? 0,
          }
        : null,
      nets: sameType.map((r) => ({ name: r.exam.name, net: r.totalNet })),
      netsType: growthType ? (EXAM_TYPES[growthType]?.label ?? growthType) : "",
      exams: { expected: expected.size, taken: mine.filter((r) => expected.has(r.exam.id)).length },
      attendance: { total: present + absent + count(att, s.id, "EXCUSED"), present, absent },
      homework: { done: count(hw, s.id, "DONE"), partial: count(hw, s.id, "PARTIAL"), notDone: count(hw, s.id, "NOT_DONE") },
    };
    return {
      student: {
        id: s.id,
        studentNo: s.studentNo,
        name: `${s.firstName} ${s.lastName}`,
        classroomId: s.classroomId,
        className: s.classroom?.name ?? "—",
        parentName: s.parentName,
        parentPhone: s.parentPhone,
      },
      signals,
    };
  });
}

/**
 * Bugünkü Başarı Skorları, 4 hafta önceki skorla birlikte. Liste en düşük skordan başlar;
 * verisi hiç olmayan öğrenciler sonda kalır.
 */
export async function successScores(ownerId: string, filter: Filter = {}) {
  const today = ymd();
  const before = addDays(today, -SCORE_RULES.trendDays);
  const [settings, now, prev] = await Promise.all([scoreSettings(ownerId), scoreSignals(ownerId, today, filter), scoreSignals(ownerId, before, filter)]);
  const prevById = new Map(prev.map((p) => [p.student.id, scoreStudent(p.signals, settings)]));

  const rows = now
    .map(({ student, signals }) => {
      const s = scoreStudent(signals, settings);
      const p = prevById.get(student.id);
      const prevScore = p?.score ?? null;
      return {
        ...student,
        signals,
        ...s,
        prevScore,
        prevLevel: p?.level ?? null,
        delta: s.score !== null && prevScore !== null ? s.score - prevScore : null,
      };
    })
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101) || a.studentNo.localeCompare(b.studentNo));

  const scored = rows.filter((r) => r.score !== null);
  const levelCounts = { GOOD: 0, WATCH: 0, RISK: 0 } as Record<ScoreLevel, number>;
  for (const r of scored) levelCounts[r.level!]++;
  /** Son 4 haftada risk seviyesine düşenler (önceden skoru olup risk altında olmayanlar). */
  const newlyRisk = rows.filter((r) => r.level === "RISK" && r.prevLevel !== null && r.prevLevel !== "RISK");

  return {
    settings,
    asOf: today,
    before,
    rows,
    levelCounts,
    newlyRisk,
    average: scored.length ? Math.round(scored.reduce((a, r) => a + r.score!, 0) / scored.length) : null,
    dimKeys: DIM_KEYS,
  };
}

export type SuccessScoreRow = Awaited<ReturnType<typeof successScores>>["rows"][number];

/** Tek öğrencinin skoru (öğrenci profili). Kurum dışı ya da sınıfsız öğrencide null. */
export async function studentSuccessScore(ownerId: string, studentId: string) {
  const r = await successScores(ownerId, { studentId });
  return r.rows[0] ? { ...r.rows[0], settings: r.settings } : null;
}
