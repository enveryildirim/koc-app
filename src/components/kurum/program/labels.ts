/**
 * İstemci bileşenleri için etiketler. `@/lib/kurum` sunucu modülü (next/headers) içe aktardığından
 * "use client" dosyalarında doğrudan kullanılamaz; değerler oradakilerle aynı tutulmalı.
 */
export const DAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export const LESSON_TYPES: Record<string, string> = { GRUP: "Grup dersi", ETUT: "Etüt", OZEL: "Özel ders" };

export const ATTENDANCE: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "Geldi", cls: "bg-emerald-50 text-emerald-700" },
  ABSENT: { label: "Gelmedi", cls: "bg-red-50 text-red-700" },
  LATE: { label: "Geç kaldı", cls: "bg-amber-50 text-amber-700" },
  EXCUSED: { label: "İzinli", cls: "bg-sky-50 text-sky-700" },
};
