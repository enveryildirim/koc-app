/** Kurum modülü etiketleri — istemci bileşenlerinde de güvenle kullanılabilir (sunucu bağımlılığı yok). */

export const DAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export const LESSON_TYPES: Record<string, string> = { GRUP: "Grup dersi", ETUT: "Etüt", OZEL: "Özel ders" };

export const ATTENDANCE: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "Geldi", cls: "bg-emerald-50 text-emerald-700" },
  ABSENT: { label: "Gelmedi", cls: "bg-red-50 text-red-700" },
  LATE: { label: "Geç kaldı", cls: "bg-amber-50 text-amber-700" },
  EXCUSED: { label: "İzinli", cls: "bg-sky-50 text-sky-700" },
};

export const HOMEWORK: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Bekliyor", cls: "bg-slate-100 text-slate-600" },
  DONE: { label: "Yaptı", cls: "bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Eksik", cls: "bg-amber-50 text-amber-700" },
  NOT_DONE: { label: "Yapmadı", cls: "bg-red-50 text-red-700" },
};

