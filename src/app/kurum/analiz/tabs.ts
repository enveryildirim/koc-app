/** Analiz ve uyarılar sekmeleri. Devam raporları ayrı bir adreste (/kurum/raporlar) ama burada sekme olarak görünür. */
export const ANALYSIS_TABS = [
  { key: "gelisim", label: "Sınıf gelişimi", href: "/kurum/analiz?tab=gelisim" },
  { key: "skor", label: "Başarı Skoru", href: "/kurum/analiz?tab=skor" },
  { key: "ogretmen", label: "Öğretmen & ders performansı", href: "/kurum/analiz?tab=ogretmen" },
  { key: "plan", label: "Yıllık plan", href: "/kurum/analiz?tab=plan" },
  { key: "devam", label: "Devam raporları", href: "/kurum/raporlar" },
];
