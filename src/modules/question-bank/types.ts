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

/** Yapay zekâ sorusunun nasıl yapıldığı; onay ekranında rozet olarak görünür. */
export const BASIS = {
  transcribed: { label: "Aktarıldı", hint: "Kullanıcının verdiği kaynaktan olduğu gibi aktarıldı" },
  adapted: { label: "Uyarlandı", hint: "Bir kaynaktan uyarlandı" },
  original: { label: "Yeni yazıldı", hint: "Agent yeni yazdı" },
} as const;
export type Basis = keyof typeof BASIS;
export const isBasis = (v: unknown): v is Basis => typeof v === "string" && v in BASIS;

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
  /** Kaynak notu (kitap / yayın / sayfa) */
  sourceNote?: string;
};

/** Elle yazılan ya da yapıştırılan bir soru (görsel ayrıca gönderilir). */
export type WrittenMeta = {
  type: string;
  stem: string;
  options?: string[];
  /** Türüne göre: MC harf, TF "D"/"Y", FILL boşluk cevapları (dizi ya da " | " ile), OPEN örnek cevap */
  answer?: string | string[];
  subject: string;
  topic?: string;
  grade?: string;
  difficulty?: number;
  level?: string;
  /** Çözüm / açıklama */
  explanation?: string;
  /** Kaynak notu (kitap / yayın / sayfa) */
  sourceNote?: string;
  /** Yalnızca yapay zekâ (MCP) sorusunda: agent'ın emin olmadığı noktalar */
  agentNote?: string;
  /** Yalnızca yapay zekâ (MCP) sorusunda: nasıl yapıldığı (BASIS) */
  basis?: string;
};

/** Havuz listesinde toplu düzenlenebilen alanlar. */
export type QuestionPatch = Partial<Pick<QuestionMeta, "subject" | "topic" | "grade" | "difficulty" | "level" | "answer" | "sourceNote">> & {
  /** Çözüm / açıklama (her soruda; kesilmiş soruda da yazılabilir) */
  explanation?: string;
  /** true arşive kaldırır, false arşivden çıkarır */
  archived?: boolean;
  /** true: onay bekleyen (yapay zekâ ile eklenen) soruyu onaylar; soru havuza ve sınav kurma ekranına geçer */
  approved?: true;
};

/** Sorunun bir sınavda / çalışma kağıdında kullanımı (exams > bankUsage hesaplar; havuz yalnızca gösterir). */
export type BankUse = {
  examId: string;
  name: string;
  /** ISO tarih */
  date: string;
  worksheet: boolean;
  /** Gören sınıfların adları */
  classes: string[];
  /** Sonucu hesaba giren öğrenci sayısı (çalışma kağıdında 0) */
  n: number;
  /** Doğru oranı (%); sonuç yoksa null */
  p: number | null;
  /** Madde analizi uyarısı (düz cümle); yoksa null */
  flag: string | null;
};

/** Sorunun bütün kullanımlarının özeti. Kayıtta saklanmaz; her seferinde denemelerden hesaplanır. */
export type BankUsage = {
  uses: BankUse[];
  exams: number;
  worksheets: number;
  /** Son kullanım (ISO) */
  last: string | null;
  /** Bütün sınavlardaki öğrenci sayısı ve ağırlıklı doğru oranı (%) */
  n: number;
  p: number | null;
  /** Ölçülen zorluk (1 kolay, 2 orta, 3 zor); yeterli öğrenci yoksa null */
  measured: number | null;
  /** Son sınavdaki uyarı */
  flag: string | null;
  /** Gören sınıfların kimlikleri */
  classIds: string[];
};
