import { prisma } from "@/shared/db";
import { classroomsOf, studentHomeClassrooms } from "@/modules/enrollment/server";
import { listCourses } from "@/modules/schedule/server";
import type { BankUsage } from "@/modules/question-bank";
import { choicesFor, parseSections } from "../domain";
import { ITEM_FLAGS, ITEM_RULES, itemAnalysis } from "../items";

/** Ölçülen doğru oranından zorluk: %70 ve üstü kolay, %40–69 orta, altı zor. */
const measuredDifficulty = (p: number) => (p >= 70 ? 1 : p >= 40 ? 2 : 3);

/**
 * Havuz sorularının kullanım geçmişi — saklanmaz, her seferinde denemelerden hesaplanır (silinen deneme sayılmaz).
 *
 * - Kullanım: sorunun girdiği sınav ve çalışma kağıtları (`sections[].items`).
 * - Gören sınıf: derse bağlı sınavda dersin sınıfı; ayrıca sonucu olan öğrencilerin ana sınıfları.
 *   Derse bağlı olmayan çalışma kağıdının kime dağıtıldığı bilinmez; sınıf eklemez.
 * - Doğru oranı ve uyarı: sonucu okunmuş sınavlarda madde analizinden (`itemAnalysis`); öğrenci sayısıyla ağırlıklı.
 *   Uyarı sonucu olan en son sınavdan; ayırt edicilik uyarıları ITEM_RULES.minN öğrenciden sonra.
 *   Ölçülen zorluk yalnızca ITEM_RULES.minN öğrenciden sonra verilir.
 * - `except`: bu deneme sayılmaz (düzenlenen denemeden çıkarılan sorular "kullanıldı / sınıf gördü" diye gizlenmesin).
 */
export async function bankUsage(ownerId: string, except?: string) {
  const exams = (
    await prisma.exam.findMany({
      where: { ownerId, ...(except ? { id: { not: except } } : {}) },
      orderBy: { date: "desc" },
      select: { id: true, name: true, date: true, type: true, purpose: true, sections: true, courseId: true },
    })
  )
    .map((e) => ({ ...e, secs: parseSections(e.sections) }))
    .filter((e) => e.secs.some((s) => s.items?.length));

  const empty = { usage: {} as Record<string, BankUsage>, classes: [] as { id: string; name: string }[] };
  if (!exams.length) return { ...empty, classes: (await classroomsOf(ownerId)).map((c) => ({ id: c.id, name: c.name })) };

  const [results, homes, courses, rooms] = await Promise.all([
    prisma.examResult.findMany({ where: { examId: { in: exams.map((e) => e.id) } }, select: { examId: true, studentId: true, answers: true, booklet: true } }),
    studentHomeClassrooms(ownerId),
    listCourses(ownerId),
    classroomsOf(ownerId),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const courseRoom = new Map(courses.map((c) => [c.id, c.classroomId]));
  const byExam = new Map<string, typeof results>();
  for (const r of results) byExam.set(r.examId, [...(byExam.get(r.examId) ?? []), r]);

  type Acc = BankUsage & { correct: number; flagAt: string | null };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { uses: [], exams: 0, worksheets: 0, last: null, n: 0, p: null, measured: null, flag: null, classIds: [], correct: 0, flagAt: null }));
    return a;
  };

  for (const e of exams) {
    const worksheet = e.purpose === "WORKSHEET";
    const rs = byExam.get(e.id) ?? [];
    const classIds = new Set<string>();
    const cr = e.courseId ? courseRoom.get(e.courseId) : undefined;
    if (cr) classIds.add(cr);
    for (const r of rs) {
      const h = homes.get(r.studentId);
      if (h) classIds.add(h);
    }
    const classes = [...classIds].map((id) => roomName.get(id) ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
    // Madde analizi bölüm sırasıyla, her bölümde A kitapçığı sırasıyla döner
    const stats = !worksheet && rs.length ? itemAnalysis(e.secs, rs, choicesFor(e.type)).items : [];
    const date = e.date.toISOString();
    let k = 0;
    for (const s of e.secs) {
      const items = s.items?.length === s.count ? s.items : [];
      for (let i = 0; i < s.count; i++, k++) {
        const id = items[i];
        if (!id) continue;
        const st = stats[k];
        const n = st?.n ?? 0;
        // Anahtar uyarısı az öğrenciyle de anlamlı; ayırt edicilik uyarıları ancak yeterli öğrenciyle
        const flag = st?.flag && (st.flag === "KEY" || n >= ITEM_RULES.minN) ? ITEM_FLAGS[st.flag] : null;
        const a = get(id);
        a.uses.push({ examId: e.id, name: e.name, date, worksheet, classes, n, p: n ? st!.p : null, flag });
        if (worksheet) a.worksheets++;
        else a.exams++;
        if (!a.last || date > a.last) a.last = date;
        if (n) {
          a.n += n;
          a.correct += (st!.p * n) / 100;
        }
        // Uyarı: sonucu olan en son sınavınki (sonra düzgün çalıştıysa eski uyarı kalmaz)
        if (n && (!a.flagAt || date > a.flagAt)) {
          a.flag = flag;
          a.flagAt = date;
        }
        for (const c of classIds) if (!a.classIds.includes(c)) a.classIds.push(c);
      }
    }
  }

  const usage: Record<string, BankUsage> = {};
  for (const [id, a] of acc) {
    const { correct, flagAt, ...u } = a;
    void flagAt;
    const p = u.n ? Math.round((correct * 100) / u.n) : null;
    usage[id] = { ...u, p, measured: p !== null && u.n >= ITEM_RULES.minN ? measuredDifficulty(p) : null };
  }
  return { usage, classes: rooms.map((r) => ({ id: r.id, name: r.name })) };
}
