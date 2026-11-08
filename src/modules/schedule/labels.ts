/** Ders programı ve yoklama etiketleri (istemci + sunucu güvenli). */

export const DAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const DAYS_SHORT = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const LESSON_TYPES: Record<string, string> = { GRUP: "Grup dersi", ETUT: "Etüt", OZEL: "Özel ders" };
export const LESSON_TYPE_KEYS = Object.keys(LESSON_TYPES);

export const ATTENDANCE: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "Geldi", cls: "bg-emerald-50 text-emerald-700" },
  ABSENT: { label: "Gelmedi", cls: "bg-red-50 text-red-700" },
  LATE: { label: "Geç kaldı", cls: "bg-amber-50 text-amber-700" },
  EXCUSED: { label: "İzinli", cls: "bg-sky-50 text-sky-700" },
};

/** Öğretmen rolleri. Etüt mesulü yönetici yetkisindedir ve öğretmenin yaptığı her şeyi yapabilir. */
export const TEACHER_ROLES: Record<string, string> = { TEACHER: "Öğretmen", MENTOR: "Etüt mesulü" };
export const TEACHER_ROLE_KEYS = Object.keys(TEACHER_ROLES);

/** Öğretmenin kısa tanımı (listelerde adın yanında): branşı; etüt mesulünün branşı yoktur, "Etüt mesulü" yazılır. */
export const teacherSub = (t: { branch: string; role: string }) => (t.role === "MENTOR" ? "Etüt mesulü" : t.branch);

/** Ders sorumlusu gibi kişi adlarının yanında rol: etüt mesulüyse "Ad (Etüt mesulü)", öğretmense yalnızca ad. */
export const staffLabel = (name: string, role: string | null | undefined) => (role === "MENTOR" ? `${name} (Etüt mesulü)` : name);

/**
 * Ders türleri. Tür yalnızca varsayılanları belirler (ör. ölçme yöntemi); bütün türler aynı araçlarla
 * (yoklama, işlenen konu, değerlendirme, sınav, ödev) takip edilir.
 */
export const COURSE_KINDS: Record<string, { label: string; cls: string }> = {
  SCHOOL: { label: "Okul", cls: "bg-sky-50 text-sky-700" },
  VOCATIONAL: { label: "Mesleki", cls: "bg-violet-50 text-violet-700" },
  RELIGIOUS: { label: "Dini", cls: "bg-emerald-50 text-emerald-700" },
  PREP: { label: "Hazırlık", cls: "bg-orange-50 text-orange-700" },
  STUDY: { label: "Etüt", cls: "bg-amber-50 text-amber-800" },
};
export const COURSE_KIND_KEYS = Object.keys(COURSE_KINDS);

const RELIGIOUS = /kur.?[aâ]n|tecvi[dt]|ilmihal|siyer|had[iî]s|f[ıi]k[ıi]h|kit[aâ]bet|islam tarihi|peygamber|ezber|akaid|tefsir|şahsiyet|kıraat|talim|adab/i;
const VOCATIONAL = /bilişim|programlama|yazılım|web|grafik|\bntp\b|\bbtt\b|ağ sistem|veri ?taban|robotik|kodlama|elektrik|elektronik|muhasebe|tasarım/i;

/** Ders adından türü tahmin eder (programdan kendiliğinden oluşan dersler için). Kullanıcı sonra değiştirebilir. */
export function guessCourseKind(name: string, lessonType = "GRUP") {
  const n = name.toLocaleLowerCase("tr-TR");
  if (lessonType === "ETUT" && /etüt/.test(n)) return "STUDY";
  if (/^etüt\b|^etut\b/.test(n)) return "STUDY";
  if (RELIGIOUS.test(n)) return "RELIGIOUS";
  if (VOCATIONAL.test(n)) return "VOCATIONAL";
  return "SCHOOL";
}
