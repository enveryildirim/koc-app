/**
 * Başarı Skoru — saf hesap (istemci + sunucu güvenli).
 * Ham ölçümler (`ScoreSignals`) sunucuda `internal/score.ts` ile toplanır; buradaki fonksiyonlar
 * bunları 0–100 boyut puanlarına, ağırlıklı toplama, seviyeye ve açıklama cümlelerine çevirir.
 * Ayar ekranı aynı fonksiyonlarla canlı önizleme yapar.
 */

export const SCORE_DIMS = {
  ACADEMIC: { label: "Akademik düzey", short: "Düzey", hint: "Son denemedeki tahmini puanın kurum içi yüzdeliği" },
  GROWTH: { label: "Gelişim", short: "Gelişim", hint: "Aynı türdeki son denemelerde netin gidişi" },
  PARTICIPATION: { label: "Deneme katılımı", short: "Katılım", hint: "Sınıfının girdiği denemelerden kaçına girdiği (60 gün)" },
  ATTENDANCE: { label: "Devam", short: "Devam", hint: "Derse gelme oranı (30 gün)" },
  HOMEWORK: { label: "Ödev", short: "Ödev", hint: "Ödev yapma oranı, eksik yapılan yarım sayılır (30 gün)" },
} as const;
export type ScoreDim = keyof typeof SCORE_DIMS;
export const DIM_KEYS = Object.keys(SCORE_DIMS) as ScoreDim[];

export type ScoreSettings = {
  /** Boyut ağırlıkları (toplamı 100 olmak zorunda değil; oranları kullanılır). */
  weights: Record<ScoreDim, number>;
  /** Bu puan ve üstü "İyi". */
  good: number;
  /** Bu puan ve üstü "İzlenmeli"; altı "Risk altında". */
  watch: number;
};

export const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  weights: { ACADEMIC: 30, GROWTH: 25, PARTICIPATION: 10, ATTENDANCE: 20, HOMEWORK: 15 },
  good: 70,
  watch: 50,
};

/** Sabit ölçek kuralları (ayar ekranında değil, burada belgelenir). */
export const SCORE_RULES = {
  /** Gelişim: deneme başına net eğimi −range → 0, +range → 100. */
  growthRange: 5,
  /** Gelişimde bakılan en fazla deneme sayısı. */
  growthExams: 4,
  /** Devam: bu oran ve altı 0, %100 → 100. */
  attendanceFloor: 70,
  /** Devam ve ödev penceresi (gün). */
  days: 30,
  /** Deneme katılımı penceresi (gün). */
  participationDays: 60,
  /** Trend karşılaştırması: kaç gün önceki skor. */
  trendDays: 28,
};

export const LEVELS = {
  GOOD: { label: "İyi", cls: "bg-emerald-50 text-emerald-800" },
  WATCH: { label: "İzlenmeli", cls: "bg-amber-50 text-amber-800" },
  RISK: { label: "Risk altında", cls: "bg-red-50 text-red-700" },
} as const;
export type ScoreLevel = keyof typeof LEVELS;

/** Bir öğrencinin belirli bir tarihteki ham ölçümleri. Veri yoksa ilgili alan null. */
export type ScoreSignals = {
  /** Son deneme ve o denemedeki kurum içi yüzdelik (0–100, yüksek iyi). */
  lastExam: { name: string; percentile: number; participants: number } | null;
  /**
   * Gelişim için son denemelerin netleri (eskiden yeniye). Tür, en az iki denemesi olan türler
   * içinde en yakın tarihte girilmiş olandır (12. sınıfta tek AYT varsa TYT kullanılır).
   */
  nets: { name: string; net: number }[];
  /** `nets` dizisinin tür etiketi. */
  netsType: string;
  /** Sınıfının pencere içindeki denemeleri ve öğrencinin girdikleri. */
  exams: { expected: number; taken: number };
  /** Devam: oran = (Geldi + Geç) / tüm kayıtlar. */
  attendance: { total: number; present: number; absent: number };
  /** Teslim tarihi pencere içinde geçmiş ödevler. */
  homework: { done: number; partial: number; notDone: number };
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Doğrusal regresyon eğimi (x = 0..n−1). */
export function slope(values: number[]) {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, v) => a + v, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    num += (i - mx) * (v - my);
    den += (i - mx) ** 2;
  });
  return num / den;
}

/** Ölçümlerden 0–100 boyut puanları; verisi olmayan boyut null. */
export function dimScores(s: ScoreSignals): Record<ScoreDim, number | null> {
  const hwGraded = s.homework.done + s.homework.partial + s.homework.notDone;
  const attRate = s.attendance.total ? (s.attendance.present / s.attendance.total) * 100 : null;
  return {
    ACADEMIC: s.lastExam ? Math.round(s.lastExam.percentile) : null,
    GROWTH:
      s.nets.length >= 2
        ? Math.round(clamp(((slope(s.nets.map((n) => n.net)) + SCORE_RULES.growthRange) / (2 * SCORE_RULES.growthRange)) * 100))
        : null,
    PARTICIPATION: s.exams.expected ? Math.round(clamp((s.exams.taken / s.exams.expected) * 100)) : null,
    ATTENDANCE:
      attRate === null ? null : Math.round(clamp(((attRate - SCORE_RULES.attendanceFloor) / (100 - SCORE_RULES.attendanceFloor)) * 100)),
    HOMEWORK: hwGraded ? Math.round(((s.homework.done + 0.5 * s.homework.partial) / hwGraded) * 100) : null,
  };
}

/** Ağırlıklı ortalama. Verisi olmayan boyut dışarıda kalır, kalan ağırlıklar yeniden dağılır. */
export function totalScore(dims: Record<ScoreDim, number | null>, settings: ScoreSettings) {
  let sum = 0;
  let w = 0;
  for (const k of DIM_KEYS) {
    const v = dims[k];
    const wk = settings.weights[k] ?? 0;
    if (v === null || wk <= 0) continue;
    sum += v * wk;
    w += wk;
  }
  return w ? Math.round(sum / w) : null;
}

export function levelOf(score: number | null, settings: ScoreSettings): ScoreLevel | null {
  if (score === null) return null;
  return score >= settings.good ? "GOOD" : score >= settings.watch ? "WATCH" : "RISK";
}

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/** Bir boyutun ham verisini anlatan kısa metin (profil kartı ve tablo ipucu). */
export function dimDetail(dim: ScoreDim, s: ScoreSignals): string {
  switch (dim) {
    case "ACADEMIC":
      return s.lastExam ? `${s.lastExam.name}: ${s.lastExam.participants} öğrenci içinde %${Math.round(s.lastExam.percentile)} dilim` : "Deneme sonucu yok";
    case "GROWTH": {
      if (s.nets.length < 2) return "Karşılaştırılacak ikinci deneme yok";
      const first = s.nets[0].net;
      const last = s.nets[s.nets.length - 1].net;
      return `Son ${s.nets.length} ${s.netsType} denemesinde net ${fmt(first)} → ${fmt(last)}`;
    }
    case "PARTICIPATION":
      return s.exams.expected ? `${s.exams.expected} denemeden ${s.exams.taken} tanesine girdi` : "Sınıfın bu dönemde denemesi yok";
    case "ATTENDANCE":
      return s.attendance.total
        ? `%${Math.round((s.attendance.present / s.attendance.total) * 100)} devam, ${s.attendance.absent} ders gelmedi`
        : "Yoklama kaydı yok";
    case "HOMEWORK": {
      const g = s.homework.done + s.homework.partial + s.homework.notDone;
      return g ? `${g} ödevden ${s.homework.done} yaptı, ${s.homework.partial} eksik, ${s.homework.notDone} yapmadı` : "Teslimi geçmiş ödev yok";
    }
  }
}

/** Puan kaybettiren boyut için açıklama cümlesi; sorun yoksa null. */
function reasonFor(dim: ScoreDim, value: number, s: ScoreSignals): string | null {
  switch (dim) {
    case "ACADEMIC":
      return s.lastExam && value < 50 ? `Son denemede (${s.lastExam.name}) kurumun alt %${Math.max(1, Math.round(s.lastExam.percentile))} diliminde` : null;
    case "GROWTH": {
      const first = s.nets[0]?.net ?? 0;
      const last = s.nets[s.nets.length - 1]?.net ?? 0;
      const d = last - first;
      return value < 50 && d < 0 ? `Son ${s.nets.length} ${s.netsType} denemesinde net ${fmt(Math.abs(d))} düştü` : null;
    }
    case "PARTICIPATION": {
      const missed = s.exams.expected - s.exams.taken;
      return missed > 0 ? `Son ${SCORE_RULES.participationDays} günde ${missed} denemeye girmedi` : null;
    }
    case "ATTENDANCE":
      return s.attendance.absent > 0 && value < 70
        ? `Son ${SCORE_RULES.days} günde ${s.attendance.absent} ders devamsızlık (%${Math.round((s.attendance.present / s.attendance.total) * 100)} devam)`
        : null;
    case "HOMEWORK":
      return s.homework.notDone + s.homework.partial > 0 && value < 70
        ? `Son ${SCORE_RULES.days} günde ${s.homework.notDone} ödev yapılmadı${s.homework.partial ? `, ${s.homework.partial} eksik` : ""}`
        : null;
  }
}

export type StudentScore = {
  score: number | null;
  level: ScoreLevel | null;
  dims: Record<ScoreDim, number | null>;
  /** En çok puan kaybettiren boyutlardan (en fazla iki) açıklama cümleleri. */
  reasons: string[];
};

export function scoreStudent(s: ScoreSignals, settings: ScoreSettings): StudentScore {
  const dims = dimScores(s);
  const score = totalScore(dims, settings);
  const losses = DIM_KEYS.flatMap((k) => {
    const v = dims[k];
    return v === null ? [] : [{ k, v, loss: (100 - v) * (settings.weights[k] ?? 0) }];
  }).sort((a, b) => b.loss - a.loss);
  const reasons: string[] = [];
  for (const l of losses) {
    if (reasons.length >= 2 || l.loss <= 0) break;
    const r = reasonFor(l.k, l.v, s);
    if (r) reasons.push(r);
  }
  return { score, level: levelOf(score, settings), dims, reasons };
}

/** Kaydedilmiş JSON'u doğrular; eksik ya da hatalı alanlar varsayılana döner. */
export function normalizeScoreSettings(raw: unknown): ScoreSettings {
  const d = DEFAULT_SCORE_SETTINGS;
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<ScoreSettings>;
  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : def;
  const weights = Object.fromEntries(DIM_KEYS.map((k) => [k, num(o.weights?.[k], d.weights[k], 0, 100)])) as Record<ScoreDim, number>;
  if (DIM_KEYS.every((k) => weights[k] === 0)) Object.assign(weights, d.weights);
  const good = num(o.good, d.good, 1, 100);
  const watch = Math.min(num(o.watch, d.watch, 0, 99), good - 1);
  return { weights, good, watch };
}
