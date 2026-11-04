/** Ödev ve devam kayıtlarından sayım / oran (veli karnesi ve öğrenci özeti ortak kuralı). */

/** Ödev: yapma oranı = Yaptı / (Yaptı + Eksik + Yapmadı); bekleyenler orana girmez. */
export function homeworkSummary(list: { status: string }[]) {
  const counts = { DONE: 0, PARTIAL: 0, NOT_DONE: 0, PENDING: 0 } as Record<string, number>;
  list.forEach((h) => (counts[h.status] = (counts[h.status] ?? 0) + 1));
  const graded = counts.DONE + counts.PARTIAL + counts.NOT_DONE;
  return { counts, rate: graded ? Math.round((counts.DONE / graded) * 100) : null };
}

/** Devam: oran = (Geldi + Geç) / tüm yoklama kayıtları. */
export function attendanceSummary(list: { status: string }[]) {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
  list.forEach((a) => (counts[a.status] = (counts[a.status] ?? 0) + 1));
  return {
    counts,
    total: list.length,
    rate: list.length ? Math.round(((counts.PRESENT + counts.LATE) / list.length) * 100) : null,
  };
}
