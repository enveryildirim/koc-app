/**
 * Örnek (sahte) müfredat verisi: demo ve ilk kurulum için. Konu adları MEB programlarına benzer,
 * kazanım kodları ve açıklamaları temsilidir; resmî program yerine kullanılmamalıdır.
 */
import type { CurriculumRow } from "./index";

type Unit = [unit: string, topics: [topic: string, code: string, outcome: string, weeks: number][]];

function build(subject: string, grade: string, units: Unit[]): CurriculumRow[] {
  return units.flatMap(([unit, topics]) => topics.map(([topic, code, outcome, weeks]) => ({ subject, grade, unit, topic, code, outcome, weeks })));
}

export const SAMPLE_CURRICULUM: CurriculumRow[] = [
  ...build("Matematik", "8", [
    ["1. Ünite: Sayılar ve İşlemler", [
      ["Çarpanlar ve Katlar", "M.8.1.1", "Pozitif tam sayıların çarpanlarını bulur; EBOB ve EKOK ile ilgili problemleri çözer.", 3],
      ["Üslü İfadeler", "M.8.1.2", "Tam sayıların tam sayı kuvvetlerini hesaplar; çok büyük ve çok küçük sayıları bilimsel gösterimle ifade eder.", 3],
    ]],
    ["2. Ünite: Kareköklü İfadeler", [
      ["Kareköklü İfadeler", "M.8.1.3", "Tam kare sayılarla karekökleri ilişkilendirir; kareköklü ifadelerle dört işlem yapar.", 4],
    ]],
    ["3. Ünite: Veri İşleme ve Olasılık", [
      ["Veri Analizi", "M.8.4.1", "Veriyi uygun grafikle gösterir; grafikler arasında dönüşüm yapar ve yorumlar.", 2],
      ["Basit Olayların Olma Olasılığı", "M.8.5.1", "Bir olayın olası durumlarını belirler; eşit şanslı olayların olasılığını hesaplar.", 2],
    ]],
    ["4. Ünite: Cebir", [
      ["Cebirsel İfadeler ve Özdeşlikler", "M.8.2.1", "Cebirsel ifadelerle çarpma yapar; özdeşlikleri modellerle açıklar ve çarpanlara ayırır.", 3],
      ["Doğrusal Denklemler", "M.8.2.2", "Birinci dereceden bir bilinmeyenli denklemleri çözer; doğrusal ilişkileri grafikle gösterir.", 3],
      ["Eşitsizlikler", "M.8.2.3", "Birinci dereceden bir bilinmeyenli eşitsizlikleri çözer ve sayı doğrusunda gösterir.", 2],
    ]],
    ["5. Ünite: Geometri ve Ölçme", [
      ["Üçgenler", "M.8.3.1", "Üçgende kenarortay, açıortay ve yüksekliği inşa eder; Pisagor bağıntısını kullanır.", 3],
      ["Eşlik ve Benzerlik", "M.8.3.2", "Eş ve benzer şekillerin kenar ve açı ilişkilerini belirler.", 2],
      ["Dönüşüm Geometrisi", "M.8.3.3", "Öteleme ve yansıma dönüşümlerini uygular.", 2],
      ["Geometrik Cisimler", "M.8.3.4", "Dik prizma, silindir, piramit ve koninin yüzey alanı ve hacmini hesaplar.", 3],
    ]],
  ]),
  ...build("Türkçe", "8", [
    ["Anlam Bilgisi", [
      ["Sözcükte Anlam", "T.8.3.1", "Sözcüklerin gerçek, mecaz ve terim anlamlarını ayırt eder.", 2],
      ["Cümlede Anlam", "T.8.3.2", "Cümleler arası anlam ilişkilerini belirler; neden-sonuç ve amaç-sonuç ilişkilerini ayırt eder.", 2],
      ["Paragrafta Anlam", "T.8.3.3", "Paragrafın ana fikrini ve yardımcı fikirlerini belirler.", 3],
    ]],
    ["Dil Bilgisi", [
      ["Fiilimsiler", "T.8.3.4", "Fiilimsilerin cümledeki işlevlerini kavrar.", 2],
      ["Cümlenin Ögeleri", "T.8.3.5", "Cümlenin temel ve yardımcı ögelerini belirler.", 2],
      ["Fiillerde Çatı", "T.8.3.6", "Fiillerde çatı özelliklerinin anlama katkısını açıklar.", 2],
      ["Cümle Türleri", "T.8.3.7", "Cümleleri yapı ve anlamlarına göre sınıflandırır.", 2],
    ]],
    ["Yazım ve Noktalama", [
      ["Yazım Kuralları", "T.8.4.1", "Yazım kurallarını uygular.", 2],
      ["Noktalama İşaretleri", "T.8.4.2", "Noktalama işaretlerini işlevlerine uygun kullanır.", 2],
    ]],
    ["Metin Bilgisi", [
      ["Söz Sanatları", "T.8.3.8", "Metinde kullanılan söz sanatlarını belirler.", 1],
      ["Metin Türleri", "T.8.3.9", "Metin türlerini ayırt eder.", 2],
      ["Anlatım Bozuklukları", "T.8.4.3", "Anlatım bozukluğu olan cümleleri düzenler.", 2],
      ["Sözel Mantık ve Görsel Okuma", "T.8.3.10", "Grafik, tablo ve görsellerdeki bilgileri yorumlar; sözel mantık sorularını çözer.", 3],
    ]],
  ]),
  ...build("Fen Bilimleri", "8", [
    ["1. Ünite: Mevsimler ve İklim", [["Mevsimler ve İklim", "F.8.1.1", "Mevsimlerin oluşumunu Dünya'nın eksen eğikliği ile açıklar; iklim ve hava olaylarını ayırt eder.", 3]]],
    ["2. Ünite: DNA ve Genetik Kod", [["DNA ve Genetik Kod", "F.8.2.1", "DNA'nın yapısını ve kalıtımla ilişkisini açıklar; mutasyon ve modifikasyonu ayırt eder.", 4]]],
    ["3. Ünite: Basınç", [["Basınç", "F.8.3.1", "Katı, sıvı ve gaz basıncını etkileyen değişkenleri deneyerek keşfeder.", 3]]],
    ["4. Ünite: Madde ve Endüstri", [["Madde ve Endüstri", "F.8.4.1", "Periyodik sistemi, kimyasal tepkimeleri ve asit-bazları açıklar.", 5]]],
    ["5. Ünite: Basit Makineler", [["Basit Makineler", "F.8.5.1", "Basit makinelerin iş kolaylığını nasıl sağladığını açıklar.", 3]]],
    ["6. Ünite: Enerji Dönüşümleri ve Çevre Bilimi", [["Enerji Dönüşümleri ve Çevre Bilimi", "F.8.6.1", "Besin zinciri, fotosentez ve solunumdaki enerji dönüşümlerini açıklar.", 4]]],
    ["7. Ünite: Elektrik Yükleri ve Elektrik Enerjisi", [["Elektrik Yükleri ve Elektrik Enerjisi", "F.8.7.1", "Elektriklenme çeşitlerini ve elektrik enerjisinin dönüşümünü açıklar.", 3]]],
  ]),
  ...build("T.C. İnkılap Tarihi", "8", [
    ["1. Ünite", [["Bir Kahraman Doğuyor", "İTA.8.1.1", "Avrupa'daki gelişmeleri ve Mustafa Kemal'in çocukluk ve öğrenim hayatını açıklar.", 3]]],
    ["2. Ünite", [["Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar", "İTA.8.2.1", "Birinci Dünya Savaşı ve işgallere karşı millî uyanışı açıklar.", 4]]],
    ["3. Ünite", [["Millî Bir Destan: Ya İstiklal Ya Ölüm!", "İTA.8.3.1", "Kurtuluş Savaşı'ndaki cepheleri ve sonuçlarını açıklar.", 4]]],
    ["4. Ünite", [["Atatürkçülük ve Çağdaşlaşan Türkiye", "İTA.8.4.1", "Atatürk ilkelerini ve inkılapları açıklar.", 5]]],
    ["5. Ünite", [["Demokratikleşme Çabaları", "İTA.8.5.1", "Çok partili hayata geçiş denemelerini açıklar.", 2]]],
    ["6. Ünite", [["Atatürk Dönemi Türk Dış Politikası", "İTA.8.6.1", "Atatürk dönemi dış politikasının temel ilkelerini açıklar.", 2]]],
    ["7. Ünite", [["Atatürk'ün Ölümü ve Sonrası", "İTA.8.7.1", "Atatürk'ün ölümü sonrası gelişmeleri değerlendirir.", 2]]],
  ]),
  ...build("Fizik", "12", [
    ["Kuvvet ve Hareket", [
      ["Çembersel Hareket", "FİZ.12.1.1", "Düzgün çembersel hareketi ve merkezcil kuvveti açıklar.", 3],
      ["Basit Harmonik Hareket", "FİZ.12.1.2", "Basit harmonik hareketi yay ve sarkaç örnekleriyle açıklar.", 2],
    ]],
    ["Dalga Mekaniği", [["Dalga Mekaniği", "FİZ.12.2.1", "Dalgalarda kırınım, girişim ve Doppler olayını açıklar.", 3]]],
    ["Atom Fiziği ve Modern Fizik", [
      ["Atom Fiziğine Giriş ve Radyoaktivite", "FİZ.12.3.1", "Atom modellerini ve radyoaktif bozunmayı açıklar.", 3],
      ["Modern Fizik", "FİZ.12.4.1", "Özel görelilik, fotoelektrik ve Compton olaylarını açıklar.", 3],
      ["Modern Fiziğin Teknolojideki Uygulamaları", "FİZ.12.5.1", "Görüntüleme teknolojileri, yarı iletkenler ve süper iletkenleri açıklar.", 2],
    ]],
  ]),
  ...build("Matematik", "TYT", [
    ["Sayılar", [
      ["Temel Kavramlar", "TYT.M.1", "Sayı kümelerini ve temel işlem özelliklerini kullanır.", 2],
      ["Sayı Basamakları", "TYT.M.2", "Basamak değeri ve çözümleme problemlerini çözer.", 1],
      ["Bölme ve Bölünebilme", "TYT.M.3", "Bölünebilme kurallarını kullanır.", 1],
      ["EBOB - EKOK", "TYT.M.4", "EBOB ve EKOK problemlerini çözer.", 1],
      ["Rasyonel Sayılar", "TYT.M.5", "Rasyonel ve ondalık sayılarla işlem yapar.", 1],
      ["Basit Eşitsizlikler", "TYT.M.6", "Eşitsizlik özelliklerini kullanır.", 1],
      ["Mutlak Değer", "TYT.M.7", "Mutlak değerli ifadeleri çözer.", 1],
      ["Üslü Sayılar", "TYT.M.8", "Üslü sayılarla işlem yapar.", 1],
      ["Köklü Sayılar", "TYT.M.9", "Köklü sayılarla işlem yapar.", 1],
    ]],
    ["Cebir", [
      ["Çarpanlara Ayırma", "TYT.M.10", "Özdeşlikleri kullanarak çarpanlara ayırır.", 1],
      ["Oran - Orantı", "TYT.M.11", "Doğru ve ters orantı problemlerini çözer.", 1],
      ["Denklem Çözme", "TYT.M.12", "Birinci dereceden denklemleri çözer.", 1],
      ["Problemler", "TYT.M.13", "Sayı, kesir, yaş, işçi, hareket ve yüzde problemlerini çözer.", 4],
      ["Kümeler", "TYT.M.14", "Küme işlemlerini yapar.", 1],
      ["Fonksiyonlar", "TYT.M.15", "Fonksiyon kavramını ve grafiklerini yorumlar.", 2],
    ]],
    ["Veri ve Olasılık", [
      ["Permütasyon, Kombinasyon ve Olasılık", "TYT.M.16", "Sayma yöntemlerini ve olasılık hesabını kullanır.", 2],
      ["Veri ve İstatistik", "TYT.M.17", "Merkezî eğilim ve yayılım ölçülerini yorumlar.", 1],
    ]],
  ]),
  ...build("Türkçe", "TYT", [
    ["Anlam Bilgisi", [
      ["Sözcükte Anlam", "TYT.T.1", "Sözcüğün anlam özelliklerini ve anlam ilişkilerini belirler.", 2],
      ["Cümlede Anlam", "TYT.T.2", "Cümlenin anlamını ve cümleler arası ilişkileri yorumlar.", 2],
      ["Paragraf", "TYT.T.3", "Paragrafta ana düşünce, yardımcı düşünce ve yapıyı belirler.", 4],
    ]],
    ["Dil Bilgisi", [
      ["Ses Bilgisi", "TYT.T.4", "Ses olaylarını belirler.", 1],
      ["Sözcük Türleri", "TYT.T.5", "Sözcük türlerini ayırt eder.", 2],
      ["Cümlenin Ögeleri", "TYT.T.6", "Cümlenin ögelerini belirler.", 1],
      ["Cümle Türleri", "TYT.T.7", "Cümle türlerini ayırt eder.", 1],
      ["Anlatım Bozuklukları", "TYT.T.8", "Anlatım bozukluklarını belirler.", 1],
    ]],
    ["Yazım ve Noktalama", [
      ["Yazım Kuralları", "TYT.T.9", "Yazım kurallarını uygular.", 1],
      ["Noktalama İşaretleri", "TYT.T.10", "Noktalama işaretlerini doğru kullanır.", 1],
    ]],
  ]),
];
