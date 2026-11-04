/** Öğrenci formu / içe aktarma girdisini doğrular ve temizler. */
export type StudentInput = {
  studentNo: string;
  firstName: string;
  lastName: string;
  classroomId: string | null;
  phone: string;
  parentName: string;
  parentPhone: string;
  external: boolean;
};

export function cleanStudent(b: Record<string, unknown>): { data?: StudentInput; error?: string } {
  const s = (k: string) => String(b[k] ?? "").trim();
  const studentNo = s("studentNo").replace(/\s+/g, "");
  if (!/^\d{1,6}$/.test(studentNo)) return { error: "Öğrenci numarası 1–6 haneli bir sayı olmalı (optik formda 6 hane var)." };
  if (!s("firstName") || !s("lastName")) return { error: "Ad ve soyad gerekli." };
  return {
    data: {
      studentNo,
      firstName: s("firstName"),
      lastName: s("lastName"),
      classroomId: s("classroomId") || null,
      phone: s("phone"),
      parentName: s("parentName"),
      parentPhone: s("parentPhone"),
      external: !!b.external,
    },
  };
}
