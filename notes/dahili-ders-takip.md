# Ders Takip Sistemi: Plan (PoC)

Dal: `dahili-ders-takip` · 7 Kasım 2026
Kaynaklar: istek listesi `notes/z.md`, örnek müfredat `notes/Seviye-2 Dahili Ders Müfredatı.pdf`, örnek bir birimin haftalık ders programı (görsel), kullanıcıyla yapılan görüşmeler.

Bu belge, SınavKur'a eklenecek **genel ders takip** özelliğinin planıdır. İlk sürümü yalnızca dini ders müfredatına göre yazılmıştı. Kurum yapısı netleşince genelleştirildi: okul, mesleki, dini, hazırlık ve etüt derslerinin hepsi aynı yapıyla takip edilir.

**Proje geneldir:** Kod, demo veri ve ekranlarda gerçek kurum, birim ya da kişi adı kullanılmaz.

---

## 1. Kurum modeli

Sistem şu yapıdaki kurumlara göre tasarlanır:

- **Sınıflar:** 9, 10, 11, 12. 12. sınıflar üniversiteye hazırlanır; onların sınav hazırlığı farklıdır (TYT/AYT denemeleri, net, sıralama). Sınıf adları kurumun kendi adlarıdır (ör. "9-A 1", "12-Hazırlık").
- **Dersler geniş bir yelpazede:**
  - Okul dersleri (Matematik, Türkçe, Fizik, Coğrafya…)
  - Mesleki dersler (ör. bilişim alanı: Bilişim Teknolojileri, Programlama, Web, Grafik)
  - Dini dersler (Kur'an, Tecvid, İlmihal, İslam Tarihi…; seviye müfredatları)
  - Hazırlık (12. sınıf, TYT/AYT)
  - **Etüt:** programda ders kadar yer kaplar
- **Ders sınıfa aittir.** Aynı öğrenci **birden fazla sınıfa** üye olabilir.
- **Dersi veren hoca** kurumun kendi hocası da olabilir, dışarıdan gelen bir hoca da.
- **Başka kurumda ders alan öğrenciler** var. Bu derslerin takibini etüt mesulü yapar: bilgileri öğretmen gibi girer. Bunun için ayrı bir özellik yoktur.
- **Etüt mesulü:** her sınıfın bir sorumlusu. Yönetici yetkisindedir ve öğretmenin yaptığı her şeyi yapabilir.
- **Program:** sınıf başına haftalık program. Zil saatleri sınıfa göre değişebilir (ör. hazırlık sınıfı daha erken başlar).
- **Büyüklük:** değişken. Tasarım bir birimde **50–1000 öğrenci, 5–40 sınıf, 5–80 hoca** aralığında rahat çalışmalı. Telefondaki uzun listelerde arama ve filtre olmalı.

## 2. Sistemin iki yüzü

| | **Bilgi girişi** | **Takibat** |
|---|---|---|
| Kim | Öğretmen, etüt mesulü | Etüt mesulü (yönetici), veli |
| Ne | Yoklama, "bu derste işlendi", sözlü/yazılı/uygulama puanı, ödev, sınav okutma | Mevcut durum, uyarılar, gidiş, karşılaştırma |
| Nerede | Çoğunlukla telefon, derste ya da ders bitince | Telefon ve bilgisayar |
| Başarı ölçütü | Birkaç dokunuşta biter, eğitim gerektirmez | İlk bakışta anlaşılır, "kime ne yapmalıyım"ı söyler, sorun büyümeden haber verir |

**Tasarım ilkeleri:**
1. **Telefon öncelikli.** Giriş ekranları tek elle kullanılabilmeli; büyük dokunma alanı, az yazı, varsayılan değerler.
2. **Bugünden başlar.** Öğretmen uygulamayı açınca "Bugünkü derslerim"i görür; menüde aramaz.
3. **Bir derste her şey tek ekranda:** yoklama, işlenen konu, puan, ödev.
4. **Ders bitince toplu giriş de kolay olmalı.** Derste girilemeyen bilgi sonradan aynı ekrandan girilir.
5. **Takibat önce "dikkat isteyenler"i gösterir.** Rakamlar, tablolar ve grafikler bunun altında kalır.
6. **Bir rapor ekranı yalnızca rakam göstermez,** bir sonraki adımı da söyler.

## 3. Roller (PoC)

| Rol | Giriş | Görür | Yapar |
|---|---|---|---|
| **Etüt mesulü** (yönetici) | Kişisel link (şifresiz) | Bütün kurumu; ana ekranı varsayılan olarak kendi sınıfına süzülü | Yönetici işleri (sınıf, ders, öğretmen, puan cetveli, müfredat) + öğretmenin yaptığı her şey + dışarıda alınan derslerin girişi |
| **Öğretmen** | Kişisel link (şifresiz) | Kendi dersleri ve o derslerin öğrencileri | Yoklama, işlendi, değerlendirme, ödev, kendi sınavları |
| **Veli** | Mevcut veli linki | Kendi çocuğu: devam, notlar, ödevler, yaklaşanlar | — |

- Bugünkü kurum hesabı (e-posta + şifre) **kurucu yönetici** olarak kalır.
- Müdür, rehber, öğrenci gibi diğer roller ihtiyaç olunca eklenir.
- **Uygulama:** Öğretmen ve etüt mesulü aynı `Teacher` tablosunda tutulur, `role` alanıyla ayrılır (`TEACHER` / `MENTOR`). Link açılınca oturum başlar (çerez). Etüt mesulünün oturumu yönetici yetkisi taşır.
- **Bu bilerek basit tutuldu:** link, sahibinin anahtarı gibi çalışır. Şifre veya PIN sonra eklenebilir.

## 4. Temel kavramlar ve veri modeli

### 4.1 Sınıf ve üyelik
- **Ana sınıf:** öğrencinin etüt mesulüne bağlı sınıfı. Bugünkü `Student.classroomId` alanı. Mevcut özellikler (denemeler, karneler, Başarı Skoru) buna göre çalışmaya devam eder.
- **Ek sınıflar:** yeni `ClassMember` tablosu (studentId, classroomId). Örneğin bir 11. sınıf öğrencisi ayrıca "Seviye-2" sınıfına üye.
- **Bir sınıfın öğrencileri** = ana sınıfı orası olanlar + ek üyeleri. Yeni ekranlar (yoklama, değerlendirme, ödev) bu listeyi `enrollment > classStudents()` ile alır.
- `Classroom.mentorId`: sınıfın etüt mesulü.
- **Modül:** `enrollment`.

### 4.2 Ders
Bugün ders adı programda, ödevde ve planda ayrı ayrı serbest metin olarak yazılıyor; hocası yalnızca programda var. Dışarıda alınan derslerin ise programda hiç satırı olmayabilir. Bu yüzden ders ayrı bir kayıt olur.

- **Yeni tablo `Course`:**
  - classroomId, name, kind, teacherId (öğretmen ya da etüt mesulü), external (dışarıda alınan ders), rubric varsayılanı
  - Tek satır kuralı: (classroomId, name)
- **Tür (`kind`):** `SCHOOL` (okul), `VOCATIONAL` (mesleki), `RELIGIOUS` (dini), `PREP` (hazırlık), `STUDY` (etüt). Tür yalnızca varsayılanları belirler:

  | Tür | Varsayılan ölçme | Not |
  |---|---|---|
  | Okul | Yazılı, deneme | Dışarıda alınıyorsa notları etüt mesulü girer |
  | Mesleki | Uygulama/proje (puan cetveli) | Ör. Web projesi: tasarım, kod, sunum |
  | Dini | Sözlü, yazılı (puan cetveli) | Ezber de sözlü/yazılı ile ölçülür; hangisi kullanılacağı hocanın takdiri |
  | Hazırlık | Deneme (TYT/AYT, optik/FMT) | Mevcut deneme, karne ve analiz özellikleri olduğu gibi kullanılır |
  | Etüt | Yoklama, kısa not | Sorumlusu etüt mesulü |

- **Bağlantılar:** Program satırları (`ScheduleSlot`) ve yeni değerlendirmeler derse `courseId` ile bağlanır. Ödev ve yıllık plan bugün (sınıf, ders adı) taşıyor; (classroomId, name) tek olduğu için derse ad üzerinden eşlenir. Böylece mevcut veri bozulmaz.
- **Modül:** `schedule` (öğretmen ve program zaten orada).

### 4.3 Ölçme araçları (bütün dersler için aynı)

| Araç | Bugün | Ne eklenecek |
|---|---|---|
| **Yoklama** | Var (program satırına göre) | Ek sınıf üyeleri de listeye girer |
| **İşlenen konu** | Var (yıllık plan, yoklama ekranında "bu derste işlendi") | Ders kaydına bağlanır |
| **Değerlendirme** (sözlü / yazılı / uygulama) | **Yok** | Yeni `assessment` modülü (bölüm 6.3) |
| **Sınav** (çoktan seçmeli) | Var (deneme, optik, TXT, havuzdan sınav) | Derse bağlanabilir; okuyucu biçimi sınava özel (6.5) |
| **Ödev** | Var | Ders kaydı ve öğretmen süzgeci |

## 5. Ekranlar

### 5.1 Bilgi girişi (telefon)
**Öğretmen ana ekranı "Bugün":**
- Günün dersleri sırayla, saatleriyle. Her kartta durum: yoklama alındı mı, konu işaretlendi mi.
- Karta dokununca **ders ekranı** açılır:
  1. **Yoklama:** herkes "geldi" varsayılır; yalnızca gelmeyenlere dokunulur.
  2. **İşlenen konu:** plana göre bu haftanın konusu hazır gelir; tek dokunuşla onaylanır.
  3. **Değerlendirme:** "Sözlü al" → öğrenci listesi → öğrenciye dokun → kriter puanları → "Kaydet ve sonraki".
  4. **Ödev:** ver veya kontrol et (Yaptı / Eksik / Yapmadı).
- **Geçmiş:** girilmemiş geçmiş dersler "Eksik girişler" olarak üstte durur.

**Etüt mesulü** aynı ekranları görür. Ek olarak:
- Kendi sınıfının etüt ve dışarıda alınan dersleri listesi
- Yönetim: sınıf, ders, öğretmen, puan cetveli, müfredat, linkler

### 5.2 Takibat
**Etüt mesulü ana ekranı "Dikkat isteyenler":** varsayılan olarak kendi sınıfına, istenirse bütün kuruma.
- Devamsızlığı artan öğrenciler
- Notu düşen öğrenciler
- Uzun süredir değerlendirilmemiş öğrenciler
- Plana göre geride kalan dersler
- Girişi eksik dersler (yoklama ya da konu işaretlenmemiş)
- Teslimi geçmiş ödevler

Her satır ilgili öğrenci ya da ders sayfasına götürür. Rakamlar ve grafikler bu listenin altında yer alır.

## 6. İstek listesindeki özellikler

### 6.1 Müfredat yükleme ve takip
> *"Müfredat yüklerim, oradan takip ederim."*

- **Bugün var:** müfredat kütüphanesi (Excel), yıllık plan, tatilleri atlayan dağıtım, "işlendi", "N hafta geride" uyarısı.
- **Eklenecek:**
  - Müfredattaki düzey alanı serbest olur ("Seviye-2", "9-Mesleki" gibi).
  - **Haftalık plan içe aktarma:** satırlar haftalar, sütunlar dersler (Seviye-2 PDF'inin düzeni). İçe aktarınca seçilen sınıfın her dersi için bir yıllık plan oluşur.
  - İzin haftaları takvime tatil olarak, devreler tarih aralığı olan etkinlik olarak girilir. Yeni tablo gerekmez.
  - Plan her ders türünde isteğe bağlı. Etütte genellikle plan olmaz.
- **Modüller:** `curriculum`, `planning`.

### 6.2 Deneme, sınav, soru havuzu, sınav hazırlama
- **Kurum denemesi** (TYT/AYT, LGS, serbest): değişiklik yok. 12. sınıfların hazırlığı bununla yürür.
- **Hocanın kendi sınavı:** `Exam` tablosuna isteğe bağlı `courseId`. Biçimi hoca seçer: çoktan seçmeliyse deneme altyapısı (optik/FMT), yazılıysa değerlendirme (6.3).
- **Soru havuzu ve sınav hazırlama:** var. Ders seçimi ders listesinden yapılır.
- **Modül:** `exams`.

### 6.3 Sözlü / yazılı / uygulama değerlendirmesi · yeni modül
> *"Öğretmen derste yüz yüze sözlü yapabilir; bir puan cetveli üzerinden yapılabilir (formu olabilir)."*

- **Puan cetveli:** kriterler ve en yüksek puanları. **Yönetici tanımlar.** Ölçek sabit değil; karşılaştırmalarda yüzdeye çevrilir. Örnekler:
  - Kur'an okuma: Mahreç 30, Tecvid 30, Akıcılık 20, Adab 20
  - Web projesi: Tasarım 30, Kod 40, Sunum 30
  - Okul yazılısı: tek kriter, 100
- **Değerlendirme:** bir derste, bir tarihte yapılan sözlü, yazılı veya uygulama. İsteğe bağlı olarak plandaki bir satıra bağlanır (ör. "Yâsîn 3. sahife ilk yarısı"). Ezber durumu bu bağlantıdan kendiliğinden çıkar.
- **Kâğıt form:** boş cetvel, sınıf listesiyle yazdırılır.
- **Dışarıda alınan dersler:** etüt mesulü okul yazılı notlarını aynı ekrandan "yazılı, tek kriter" olarak girer.
- **Veri:**

  | Tablo | Alanlar |
  |---|---|
  | `Rubric` | ownerId, name, kind?, criteria (JSON `[{ name, max }]`) · yalnızca yönetici yazar |
  | `Assessment` | ownerId, courseId, teacherId, date, title, type (`ORAL` / `WRITTEN` / `PRACTICE`), criteria (cetvelden kopya), planItemId? |
  | `AssessmentScore` | assessmentId, studentId, scores (JSON), total, percent, note, absent · tek satır: (assessmentId, studentId) |

  Kriterler değerlendirmeye kopyalanır. Böylece cetvel sonradan değişse de eski puanlar bozulmaz.
- **Modül:** yeni `assessment`. Bağımlılığı: `identity ← enrollment ← schedule ← assessment ← reporting`.

### 6.4 Çalışma kağıdı
- Sınav hazırlamanın puansız modu (`Exam.purpose = WORKSHEET`). Sonuç, optik ve analiz sekmeleri gizlenir; kitapçık ve istenirse cevap anahtarı yazdırılır.
- Osmanlıca (sağdan sola) metin yazma PoC'ta yok. Görsel olarak kesilen sorular sorunsuz çalışır.

### 6.5 Optik okuma (telefon ve FMT)
- **Bugün var:** telefonla okuma (yön işareti, kişisel form, QR), TXT içe aktarma.
- **Eklenecek, sınava özel okuyucu biçimi:**
  - Biçim sınav oluşturulurken tanımlanır ve sınavda saklanır (`Exam.readerFormat`).
  - Alanlar: no, ad, sınıf, kitapçık. **Her bölümün cevapları ayrı başlangıç sütunundan** okunabilir.
  - "Başka bir sınavın biçimini kopyala" seçeneği.
- **Örnek dosya:** [ornek-fmt.txt](ornek-fmt.txt).

  | Sütun | Alan |
  |---|---|
  | 1–6 | Öğrenci no (002001–002020) |
  | 7–26 | Ad soyad |
  | 27–30 | Sınıf |
  | 31 | Kitapçık (A/B) |
  | 32–51 | Bölüm 1: 20 sütun ayrılmış, 15 soru |
  | 52–71 | Bölüm 2: 20 sütun ayrılmış, 10 soru |
  | 72–91 | Bölüm 3: 20 sütun ayrılmış, 10 soru |

  - 4 şık (A–D). Boş cevap boşluk, çift işaret `*`. CRLF, UTF-8.
  - Kenar durumları: 5. satırda kitapçık boş; son satırda olmayan numara.
  - Cevap anahtarı (A): `DDABCBBACABBDAC` / `BCBBCBDAAB` / `BADADBBBAD`. B kitapçığında her bölümün soru sırası ters.

### 6.6 Ödev takibi
- **Var.** Eklenecekler:
  - Ödev derse bağlanır; öğretmen yalnızca kendi derslerinin ödevlerini görür.
  - Ek sınıf üyeleri de ödev listesine girer.
  - Sınıf ve ders bazında ödev raporu.

### 6.7 Analizler
**İlke:** Her analiz bir sonraki adımı söylemeli. Ölçekler farklı olduğu için karşılaştırmalar yüzdeyle yapılır.

| Sıra | Düzey | Kimin için | İçerik | Ne yaptırır |
|---|---|---|---|---|
| 1 | **Öğrenci** | Etüt mesulü, öğretmen, veli | Bütün dersleri tek sayfada: devam, değerlendirme notları ve gidişi, ödev, varsa deneme netleri | Veliyle görüşmeye dayanak; zayıf dersi gösterir |
| 2 | **Sınıf** | Etüt mesulü, öğretmen | Öğrenci × ders tablosu, kriter ortalamaları, plan durumu, değerlendirilmemiş öğrenciler | Kime, hangi derste destek gerektiğini gösterir |
| 3 | **Ders** | Etüt mesulü | Aynı dersin sınıflar arası durumu; kriter ve plan konusu bazında zayıflık; deneme varsa konu ve madde analizi | Zor gelen konuyu ya da kriteri bulur |
| 4 | **Öğretmen** | Etüt mesulü | Giriş düzeni (yoklama, konu, değerlendirme), derslerinin gidişi. **Sıralama değil, etkinlik takibi** | Eksik girişi ve geride kalan dersi gösterir |
| 5 | **Kurum** | Etüt mesulü | "Dikkat isteyenler"in kurum geneli; sınıfların karşılaştırması | Haftalık toplantı gündemi |

- **Veri katmanı:** `reporting` (okuma modeli) yeni tabloları okur.
- **Sonra:** dönem/devre sonu karnesi; Başarı Skoru'nun genel versiyonu (boyutlar: not, gelişim, devam, ödev).

## 7. Değişiklik özeti

| Değişiklik | Tablo / alan | Modül | Büyüklük |
|---|---|---|---|
| Ek sınıf üyeliği | `ClassMember`, `classStudents()` | enrollment | Orta |
| Sınıfın etüt mesulü | `Classroom.mentorId` | enrollment | Küçük |
| Ders kaydı ve türü | `Course` | schedule | Orta |
| Program → ders bağlantısı | `ScheduleSlot.courseId` | schedule | Küçük |
| Öğretmen / etüt mesulü linki ve oturum | `Teacher.role`, `Teacher.token`, oturumda rol | schedule, identity | Orta |
| Telefon ekranları ("Bugün", ders ekranı) | — | app, ilgili modüller | Büyük |
| Değerlendirme ve puan cetveli | `Rubric`, `Assessment`, `AssessmentScore` | **assessment (yeni)** | Büyük |
| "Dikkat isteyenler" ve analizler | — | reporting | Büyük |
| Haftalık plan içe aktarma | — | curriculum, planning | Orta |
| Hocanın sınavı, çalışma kağıdı | `Exam.courseId`, `Exam.purpose` | exams | Küçük |
| Sınava özel FMT biçimi | `Exam.readerFormat` | exams | Orta |
| Ödev → ders, ödev raporu | `Homework.courseId?` | homework, reporting | Küçük |

## 8. PoC sırası

1. ✅ **Temel** (7 Kasım): ders kaydı, ek sınıf üyeliği, etüt mesulü, sınıf sayfası. Demo veri: 9–12 sınıflar, okul/mesleki/dini/hazırlık/etüt dersleri, SEVİYE-2 grubu (kurgusal adlarla). Ayrıntı: PROJECT_MEMORY.md 4j.
2. ✅ **Roller ve telefon girişi** (7 Kasım): öğretmen ve etüt mesulü linki, "Bugün" ekranı, ders ekranı (yoklama + işlenen konu). Ayrıntı: PROJECT_MEMORY.md 4k.
3. ✅ **Değerlendirme** (7 Kasım): puan cetveli, sözlü/yazılı/uygulama girişi, kâğıt form; öğrenci ve sınıf özetleri. Ayrıntı: PROJECT_MEMORY.md 4l.
4. ✅ **Takibat** (7 Kasım): "Dikkat isteyenler", sınıf/ders/öğretmen analizleri, veli karnesi ve haftalık mesaja sözlü/yazılı. Ayrıntı: PROJECT_MEMORY.md 4m.
5. **Sınav tarafı:** hocanın sınavı, çalışma kağıdı, FMT biçimi, ödev → ders.
6. **Müfredat:** haftalık plan içe aktarma.

**PoC dışında:** müdür/rehber/öğrenci rolleri, şifreli giriş, çoklu birim, Osmanlıca metin yazma, otomatik SMS, dönem sonu karnesi, genel Başarı Skoru, gerçek kâğıtla optik test (kullanıcı yapacak).

## 9. Kararlar kaydı

| Tarih | Konu | Karar |
|---|---|---|
| 7 Kasım | LGS/TYT | Kalıyor; 12. sınıf hazırlığı bununla yürür |
| 7 Kasım | FMT | Optik okuyucu TXT'si; biçim sınava özel, sınav oluşturulurken tanımlanır. Örnek dosya üretildi |
| 7 Kasım | Puan cetveli | Kriterleri yönetici tanımlar |
| 7 Kasım | Ezber | Ayrı takip yok; hoca sözlü/yazılı ile ölçer, takdir hocanın |
| 7 Kasım | Sınav biçimi | Hoca seçer (çoktan seçmeli / yazılı) |
| 7 Kasım | Devre sonu karnesi | Şimdi değil |
| 7 Kasım | Giriş | Basit (kişisel link) |
| 7 Kasım | Analizler | Hepsi gerekli; sıra planda |
| 7 Kasım | Ders yelpazesi | Okul, mesleki, dini, hazırlık, etüt; sistem genel tasarlanır |
| 7 Kasım | Hocalar | Kurum içi ya da dışarıdan olabilir |
| 7 Kasım | Dışarıda alınan dersler | Etüt mesulü öğretmen gibi girer; ayrı özellik yok |
| 7 Kasım | Etüt mesulü | Yönetici rolünde; öğretmenin yaptığı her şeyi yapabilir |
| 7 Kasım | Sınıf ve ders | Ders sınıfa ait; öğrenci birden fazla sınıfa üye olabilir |
| 7 Kasım | Kurum adı | Projede kullanılmaz; proje genel |
| 7 Kasım | PoC rolleri | Etüt mesulü (yönetici), öğretmen, veli; diğerleri ihtiyaç olunca |
| 7 Kasım | Ölçek | Bir birimde 50–1000 öğrenci, 5–40 sınıf, 5–80 hoca |
| 7 Kasım | Etüt mesulünün görünümü | Bütün kurumu görür; ana ekranı varsayılan olarak kendi sınıfına süzülü |
| 7 Kasım | Etüt | Yoklama ve kısa not izlenir |
