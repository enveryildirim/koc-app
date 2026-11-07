import { prisma } from "@/shared/db";
import { invalid } from "@/shared/errors";
import { classroomsOf } from "@/modules/enrollment/server";
import { schoolYearOf, YMD } from "../calendar";
import { isHolidayWeek } from "../plan";
import { createPlan, holidayRanges, updatePlan } from "./lessonPlans";

type PlanIn = { subject: string; startDate: string; source: string };
type Izin = { start: string; end: string; label?: string };

/**
 * Haftalık planı (tablodan dönüştürülmüş ders planları) seçilen sınıflara kaydeder.
 * Gövde: { classroomIds, plans: [{ subject, startDate, source }], izin: [{ start, end, label }], addHolidays, replace, teachWeeks }
 *  - addHolidays: izin haftaları sınıfa özel tatil olarak takvime eklenir (aynı aralıkta tatil varsa eklenmez).
 *  - replace: sınıfın o ders için o yıla ait planı varsa yeniden yazılır ("işlendi" bilgisi aynı adlı konularda korunur);
 *    değilse atlanır.
 *  - teachWeeks: tablodaki ders haftaları (Pazartesi). Takvimde tatil olan bir ders haftası varsa uyarı döner,
 *    çünkü dağıtım o haftayı atlar ve tarihler tablodan kayar.
 */
export async function importWeeklyPlans(ownerId: string, body: Record<string, unknown>) {
  const ids = Array.isArray(body.classroomIds) ? [...new Set(body.classroomIds.map(String))] : [];
  const plans = Array.isArray(body.plans) ? (body.plans as PlanIn[]) : [];
  const izin = Array.isArray(body.izin) ? (body.izin as Izin[]) : [];
  const teachWeeks = Array.isArray(body.teachWeeks) ? (body.teachWeeks as unknown[]).map(String).filter((d) => YMD.test(d)) : [];
  if (!ids.length) throw invalid("En az bir sınıf seçin.");
  if (!plans.length) throw invalid("İçe aktarılacak ders yok.");
  if (plans.length > 30) throw invalid("Tek seferde en fazla 30 ders içe aktarılabilir.");
  for (const p of plans) {
    if (!String(p.subject ?? "").trim()) throw invalid("Ders adı boş olamaz.");
    if (!YMD.test(String(p.startDate ?? ""))) throw invalid(`${p.subject}: başlangıç tarihi geçersiz.`);
  }
  for (const z of izin) if (!YMD.test(String(z.start)) || !YMD.test(String(z.end)) || z.end < z.start) throw invalid("İzin haftası tarihi geçersiz.");
  const classes = new Map((await classroomsOf(ownerId)).map((c) => [c.id, c.name]));
  for (const id of ids) if (!classes.has(id)) throw invalid("Sınıf bulunamadı.");

  let holidaysAdded = 0;
  if (body.addHolidays) {
    for (const id of ids) {
      for (const z of izin) {
        const exists = await prisma.calendarEvent.findFirst({
          where: { ownerId, kind: "HOLIDAY", startDate: { lte: z.start }, endDate: { gte: z.end }, OR: [{ classroomId: null }, { classroomId: id }] },
        });
        if (exists) continue;
        await prisma.calendarEvent.create({
          data: { ownerId, kind: "HOLIDAY", title: (z.label || "İzin haftası").slice(0, 80), startDate: z.start, endDate: z.end, classroomId: id, parentVisible: true },
        });
        holidaysAdded++;
      }
    }
  }

  const created: string[] = [];
  const replaced: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  for (const id of ids) {
    const cname = classes.get(id)!;
    for (const p of plans) {
      const subject = p.subject.trim().slice(0, 60);
      const year = schoolYearOf(p.startDate);
      const existing = await prisma.lessonPlan.findUnique({ where: { ownerId_classroomId_subject_year: { ownerId, classroomId: id, subject, year } } });
      if (existing && !body.replace) {
        skipped.push(`${cname} · ${subject}`);
        continue;
      }
      if (existing) {
        await updatePlan(ownerId, existing.id, { source: p.source, startDate: p.startDate });
        replaced.push(`${cname} · ${subject}`);
      } else {
        await createPlan(ownerId, { classroomId: id, subject, year, startDate: p.startDate, source: p.source });
        created.push(`${cname} · ${subject}`);
      }
    }
    // Takvimde tatil görünen ders haftaları: dağıtım bunları atlar, tarihler tablodan kayar
    const years = [...new Set(plans.map((p) => schoolYearOf(p.startDate)))];
    const hol = (await Promise.all(years.map((y) => holidayRanges(ownerId, id, y)))).flat();
    const clash = teachWeeks.filter((w) => isHolidayWeek(w, hol));
    if (clash.length) warnings.push(`${cname}: tablodaki ${clash.length} ders haftası takvimde tatil (${clash.slice(0, 3).join(", ")}${clash.length > 3 ? "…" : ""}); bu derslerin tarihleri tablodan kayabilir.`);
  }
  return { created, replaced, skipped, holidaysAdded, warnings };
}
