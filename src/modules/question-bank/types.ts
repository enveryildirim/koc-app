/** Görüntü verisi (ImageData ile uyumlu). */
export type ImageLike = { data: Uint8ClampedArray; width: number; height: number };

/** Sayfaya göre 0–1 oranlı kutu. */
export type Crop = { x: number; y: number; w: number; h: number };

/**
 * Bir dedektörün (sezgisel ya da yapay zekâ) önerdiği soru kutusu.
 * Yapay zekâ ileride konu, cevap ve metni de doldurabilir; sezgisel dedektör yalnızca kutuyu verir.
 */
export type DetectedBox = Crop & { topic?: string; answer?: string; text?: string; confidence?: number };

export type QuestionOrigin = "MANUAL" | "AUTO" | "AI";

/** Kesme ekranından kaydedilen bir sorunun etiketleri (görsel ayrıca gönderilir). */
export type QuestionMeta = {
  page?: number;
  crop?: Crop;
  subject: string;
  topic?: string;
  grade?: string;
  difficulty?: number;
  /** Bilişsel düzey (shared/cognitive.ts) */
  level?: string;
  answer?: string;
  origin?: QuestionOrigin;
};

/** Havuz listesinde toplu düzenlenebilen alanlar. */
export type QuestionPatch = Partial<Pick<QuestionMeta, "subject" | "topic" | "grade" | "difficulty" | "level" | "answer">>;
