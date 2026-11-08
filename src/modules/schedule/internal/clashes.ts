import { prisma } from "@/shared/db";
import { conflict, needsConfirm } from "@/shared/errors";
import { classRosters } from "@/modules/enrollment/server";
import { DAYS } from "../labels";
import type { SlotInput } from "./validate";

/*
 * Ders programı çakışmaları.
 * - Aynı ders aynı saate ikinci kez: kesin hata.
 * - Aynı sınıfta ya da aynı öğretmende saatleri kesişen iki grup dersi: kesin hata.
 *   Etüt / özel ders işin içindeyse uyarı (aynı anda birkaç özel ders ya da etüt olabilir).
 * - Ortak öğrencisi olan iki sınıfın dersleri kesişiyorsa (ör. SEVİYE-2'deki ek üyeler 10-A'da da derste): uyarı.
 * Uyarılar kullanıcı onaylarsa kaydedilir.
 */

type SlotLike = Omit<SlotInput, "courseId"> & { id?: string; classroomName: string; teacherName: string };
type Roster = Map<string, Map<string, string>>;
type Kind = "dup" | "class" | "teacher" | "students";
type Pair = { kind: Kind; hard: boolean; a: SlotLike; b: SlotLike; common?: string[] };

export type Clash = {
  /** Kesin hata mı (true) yoksa onayla geçilebilen uyarı mı */
  hard: boolean;
  message: string;
  /** Çakışan program satırları (sayfada işaretlenir) */
  slotIds: string[];
  dayOfWeek: number;
  /** Çakışmanın görüldüğü sınıf (listede bağlantı) */
  classroomId: string;
};

/** "16:00" < "16:40" metin karşılaştırması saat sırasını verir (SS:DD). */
const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  a.startTime < b.endTime && b.startTime < a.endTime;

const hours = (s: SlotLike) => `${s.startTime}–${s.endTime}`;
const when = (s: SlotLike) => `${DAYS[s.dayOfWeek]} ${hours(s)}`;
const label = (s: SlotLike) => `${s.classroomName} · ${s.subject}`;
const sample = (names: string[]) => names.slice(0, 2).join(", ") + (names.length > 2 ? "…" : "");

/** İki ders arasındaki çakışmalar (aynı günde ve saatleri kesişiyorsa). */
function pairClashes(a: SlotLike, b: SlotLike, rosters: Roster): Pair[] {
  if (a.dayOfWeek !== b.dayOfWeek || !overlaps(a, b)) return [];
  const bothGroup = a.lessonType === "GRUP" && b.lessonType === "GRUP";
  const same = a.classroomId === b.classroomId && a.subject === b.subject && a.teacherId === b.teacherId && a.startTime === b.startTime && a.endTime === b.endTime;
  if (same) return [{ kind: "dup", hard: true, a, b }];
  const out: Pair[] = [];
  if (a.classroomId === b.classroomId) out.push({ kind: "class", hard: bothGroup, a, b });
  if (a.teacherId === b.teacherId && a.classroomId !== b.classroomId) out.push({ kind: "teacher", hard: bothGroup, a, b });
  if (a.classroomId !== b.classroomId) {
    const ra = rosters.get(a.classroomId);
    const rb = rosters.get(b.classroomId);
    const common = ra && rb ? [...ra.keys()].filter((id) => rb.has(id)).map((id) => ra.get(id)!) : [];
    if (common.length) out.push({ kind: "students", hard: false, a, b, common });
  }
  return out;
}

/** Form mesajı: kaydedilecek ders (a) ile programdaki ders (b). */
function formMessage({ kind, b, common }: Pair) {
  switch (kind) {
    case "dup":
      return `${label(b)} (${b.teacherName}) ${when(b)} programda zaten var.`;
    case "class":
      return `${b.classroomName} sınıfında ${when(b)} arası ${b.subject} (${b.teacherName}) var.`;
    case "teacher":
      return `${b.teacherName} ${when(b)} arası ${label(b)} dersinde.`;
    case "students":
      return `${common!.length} öğrenci (${sample(common!)}) aynı saatte ${label(b)} dersinde de var (${when(b)}).`;
  }
}

/** Liste mesajı: iki dersi birlikte anlatır. */
function listMessage({ kind, a, b, common }: Pair) {
  const day = DAYS[a.dayOfWeek];
  switch (kind) {
    case "dup":
      return `${label(a)} (${a.teacherName}) ${when(a)} programda birden fazla kez var.`;
    case "class":
      return `${a.classroomName} sınıfında ${day} aynı saatte iki ders: ${a.subject} (${a.teacherName}) ${hours(a)} ve ${b.subject} (${b.teacherName}) ${hours(b)}.`;
    case "teacher":
      return `${a.teacherName} ${day} aynı saatte iki derste: ${label(a)} ${hours(a)} ve ${label(b)} ${hours(b)}.`;
    case "students":
      return `${common!.length} öğrenci (${sample(common!)}) ${day} aynı saatte iki derste: ${label(a)} ${hours(a)} ve ${label(b)} ${hours(b)}.`;
  }
}

/**
 * Kaydedilecek dersin çakışmalarını denetler. Kesin çakışmada 409; yalnızca uyarı varsa ve `confirmed` değilse
 * 409 + `{ confirm: true }` fırlatır (istemci onay alıp `confirm: true` ile yeniden gönderir).
 */
export async function assertNoClash(ownerId: string, s: SlotInput, opts: { selfId?: string; confirmed?: boolean } = {}) {
  const [others, cls, teacher, rosters] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { ownerId, dayOfWeek: s.dayOfWeek, ...(opts.selfId ? { NOT: { id: opts.selfId } } : {}) },
      include: { classroom: { select: { name: true } }, teacher: { select: { name: true } } },
    }),
    prisma.classroom.findFirst({ where: { id: s.classroomId, ownerId }, select: { name: true } }),
    prisma.teacher.findFirst({ where: { id: s.teacherId, ownerId }, select: { name: true } }),
    classRosters(ownerId),
  ]);
  const me: SlotLike = { ...s, classroomName: cls?.name ?? "", teacherName: teacher?.name ?? "" };
  const pairs = others.flatMap((o) => pairClashes(me, { ...o, classroomName: o.classroom.name, teacherName: o.teacher.name }, rosters));
  const hard = pairs.filter((p) => p.hard);
  if (hard.length) throw conflict(`Çakışma: ${[...new Set(hard.map(formMessage))].join(" ")}`);
  if (pairs.length && !opts.confirmed) throw needsConfirm([...new Set(pairs.map(formMessage))].join(" "));
}

/** Programdaki bütün çakışmalar (önce kesinler, sonra gün ve saate göre). Ders programı sayfasının üstünde listelenir. */
export async function scheduleClashes(ownerId: string): Promise<Clash[]> {
  const [slots, rosters] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { ownerId },
      include: { classroom: { select: { name: true } }, teacher: { select: { name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    classRosters(ownerId),
  ]);
  const rows: SlotLike[] = slots.map((s) => ({ ...s, classroomName: s.classroom.name, teacherName: s.teacher.name }));
  const byMessage = new Map<string, Clash>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      // Gün ve başlangıca göre sıralı: gün değişince ya da sonraki ders bu ders bitince başlıyorsa ötesi kesişmez
      if (rows[j].dayOfWeek !== rows[i].dayOfWeek || rows[j].startTime >= rows[i].endTime) break;
      for (const p of pairClashes(rows[i], rows[j], rosters)) {
        const message = listMessage(p);
        const c = byMessage.get(message) ?? { hard: p.hard, message, slotIds: [], dayOfWeek: p.a.dayOfWeek, classroomId: p.a.classroomId };
        for (const id of [rows[i].id, rows[j].id]) if (id && !c.slotIds.includes(id)) c.slotIds.push(id);
        byMessage.set(message, c);
      }
    }
  }
  return [...byMessage.values()].sort((a, b) => Number(b.hard) - Number(a.hard) || a.dayOfWeek - b.dayOfWeek);
}
