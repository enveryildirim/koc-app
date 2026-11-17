# PROJECT_MEMORY — SınavKur

Bu dosya projede ne yapıldığını, neden öyle yapıldığını ve kalan işleri kaydeder. Projeye yeni başlayan bir geliştirici veya yapay zekâ asistanı önce bunu okumalı.

Son güncelleme: 7 Kasım 2026 · Dal: `dahili-ders-takip`

---

## 1. Proje nedir?

**SınavKur**, dershane ve kurslar için bir eğitim destek sistemidir. Proje iki aşamada gelişti:

| Aşama | Dal | İlham alınan ürün | İçerik |
|---|---|---|---|
| 1 | `feature/sinavkur` | onlinetestmaker.net | Online sınav hazırlama, link ile paylaşma, otomatik puanlama, optik form okuma |
| 2 | `deneme-sinavza` | edesis.com (Edesis / Sınavza) | Kurum paneli: kayıt, deneme sınavı okuma ve karneler, ödev takibi, ders programı ve yoklama |

**Önemli kural:** Ürünler **işlevsel olarak** örnek alındı; ad, logo, metin ve görseller kopyalanmadı. Marka adı "SınavKur". İleride yapılacak değişikliklerde de başka ürünlerin markası, metni veya görseli kullanılmamalı.

### Referans sitelerin analizi (REA ile)
- **onlinetestmaker.net:** otomatik istekleri engelliyor (HTTP 403), içerik alınamadı. Özellikler genel bilgiye göre tasarlandı.
- **edesis.com:** REA `capture_browser_scenario` ile gerçek Chrome'da açıldı; erişilebilirlik ağacı ve ekran görüntüleri incelendi. Bulgular:
  - **Modüller:** Kayıt (Excel ile yükleme, tek tek ekleme, STS = kurum dışı sınav), Sınav Okuma Sistemi (optik tanımlama, 18 rapor türü), Ödev Takip, Ders Planlama ve Yoklama (5 rapor türü), Muhasebe ve mobil uygulama.
  - **Karne sütunları:** Ders, Soru, Doğru, Yanlış, Boş, Net, Ortalama; ayrıca A/B kitapçık.
  - **Satış modeli:** Yıllık lisans; Analiz ve Premium paketleri, öğrenci sayısına göre fiyat.
  - **Görülemeyenler:** Modül sayfalarının ana görselleri geç yüklendiği için boş kaldı. Videolar (YouTube) ve giriş sonrası panel incelenmedi.

---

## 2. Teknoloji ve çalıştırma

- **Teknolojiler:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4.
- **Veritabanı:** Prisma 6 + SQLite (`prisma/dev.db`, git'e girmez).
- **Kimlik doğrulama:** `jose` ile HttpOnly çerezde JWT; şifreler `bcryptjs` ile saklanır.
- **Excel okuma:** tarayıcıda `read-excel-file`.
- **Optik okuma:** saf TypeScript, ek kütüphane yok.

```bash
npm install
cp .env.example .env
npm run db:setup   # prisma db push + seed
npm run dev        # http://localhost:3000
```

- **Demo hesap:** `demo@sinavkur.com` / `demo1234`. Giriş sayfasında "Demo hesabıyla gir" düğmesi var; `/giris?demo=1` adresi de otomatik giriş yapar. Girişten sonra `/kurum` açılır.
- **Veriyi sıfırlama:** `npm run db:seed`. Seed, demo kullanıcıyı ve tüm kurum tablolarını silip yeniden oluşturur.
- **npm 11 notu:** install script'leri onay gerektiriyor. Prisma ve esbuild `package.json > allowScripts` içinde onaylı. `fsevents` uyarısı önemsiz.
- **`prisma db push --force-reset` kullanmayın.** Prisma bu komutu yapay zekâ asistanları için açık kullanıcı onayına bağlıyor. Seed zaten veriyi temizliyor.

---

## 3. Mimari

**Modüler monolit.** Ayrıntılı kurallar için **[ARCHITECTURE.md](ARCHITECTURE.md)** dosyasını okuyun. Kod `src/modules/<modül>/` altında, iş alanına göre bölünmüştür: identity, enrollment, exams, homework, schedule, question-bank, curriculum, planning, assessment, reporting. `src/app/` ince bir katmandır ve veritabanına doğrudan erişemez. Modül sınırlarını `npm run lint` denetler.

### Çok kiracılık (multi-tenant)
- **Kurum = kullanıcı.** Kurum tablolarında `ownerId` alanı var (User'a ilişki tanımlı değil).
- `ownerId` filtresini **modül fonksiyonları kendisi uygular**; sayfalar ve route'lar filtre yazmaz.
  - Sayfalar `requireOwner()` ile kimliği alır ve modülün `find*` fonksiyonunu çağırır. Kayıt yoksa `null` döner ve sayfa `notFound()` çağırır.
  - Route'lar `api()` + `ownerOrThrow()` kullanır: giriş yoksa 401, başka kurumun kaydıysa 404 (`identity/server`, `shared/http`).
- `seed-kurum.ts`, kurum tablolarını ilişki olmadığı için elle temizler.

### Klasör yapısı (önemli dosyalar)
```
prisma/                  # schema.prisma, seed.ts, seed-kurum.ts
src/shared/
  db.ts                  # prisma — yalnızca modüller import eder
  errors.ts, http.ts     # AppError (invalid/notFound/conflict/unauthorized) → api() ile HTTP yanıtı
  date.ts                # ymd, dayOfWeek, toInputDate
  omr/                   # layout.ts, scan.ts, draw.ts, OmrScanner.tsx, FormSvg.tsx (optik form kütüphanesi)
  ui/                    # kurum.tsx (PageHeader, Kpi, Empty, Tabs, th, td), KurumNav, SiteHeader, Export/PrintButton
src/modules/
  identity/              # oturum, requireOwner/ownerOrThrow, login/register, institutionName
  enrollment/            # sınıf + öğrenci: listStudents, getClassroom, studentNoMatcher, importStudents…
  exams/                 # domain.ts (EXAM_TYPES, gradeExam, net/puan), omr.ts, topics.ts; server: findExam, updateExam (+regrade), importResults, examReport…
  homework/              # ödevler + durumlar; labels.ts (STATUS, doneRate)
  schedule/              # öğretmen, program, yoklama: listSlots, takeAttendance, attendanceSheet…
  planning/              # yıllık takvim: CalendarEvent, calendarFeed (etkinlik + deneme + ödev), holidaysOn, addNationalHolidays
  reporting/             # institutionDashboard, analiz (riskList…), devam raporları, veli karnesi, studentOverview
src/app/                 # sayfa + route dosyaları (ince katman)
```

**İstemci/sunucu ayrımı:** `"use client"` bileşenleri yalnızca `@/modules/<m>` (index) ve `ui/` import eder. `@/modules/<m>/server` dosyaları `server-only` içerir; istemciye girerse derleme kırılır. Bu ayrım, eski `lib/kurum.ts` / `kurumLabels.ts` geçici çözümünün ve kopya etiket dosyalarının yerini aldı.

### Veri modeli (kurum)
| Model | Amaç / önemli alanlar |
|---|---|
| `Classroom` | Sınıf/şube; `@@unique([ownerId, name])` |
| `Student` | `studentNo` (1–6 hane, optik formla uyumlu), `external` = STS/kurum dışı; `@@unique([ownerId, studentNo])` |
| `Exam` | `type` LGS/TYT/AYT/SERBEST; `sections` JSON `[{name,count,keyA,keyB}]`; `bookletB`; `wrongPer` |
| `ExamResult` | `answers` (soru başına harf, `" "` boş, `"*"` çift işaret), `stats` JSON `[{d,y,b,net}]`, `totalNet`, `source` OMR/TXT/MANUAL; `@@unique([examId, studentId])` |
| `Homework` / `HomeworkStatus` | Durum: PENDING/DONE/PARTIAL/NOT_DONE |
| `Teacher`, `ScheduleSlot` | Haftalık program (`dayOfWeek` 1=Pzt … 7=Paz, `lessonType` GRUP/ETUT/OZEL) |
| `LessonSession` / `Attendance` | Belirli tarihteki ders (`date` "YYYY-MM-DD"), `@@unique([slotId, date])`; yoklama PRESENT/ABSENT/LATE/EXCUSED |
| `Course` | Sınıfın dersi (`kind` SCHOOL/VOCATIONAL/RELIGIOUS/PREP/STUDY, `teacherId`, `external`); `@@unique([classroomId, name])`; program satırı `courseId` ile bağlanır |
| `ClassMember` | Ek sınıf üyeliği (öğrencinin ana sınıfı `Student.classroomId`); `@@unique([classroomId, studentId])` |

### Net hesabı (`modules/exams/domain.ts > gradeExam`)
- Net = D − Y / `wrongPer`. Varsayılan `wrongPer`: LGS = 3, TYT/AYT = 4. Deneme bazında değiştirilebilir.
- Çift işaret (`*`) yanlış sayılır, boşluk boş sayılır.
- B kitapçığı kendi anahtarıyla (`keyB`) puanlanır.
- Cevap anahtarı kaydedilince `regrade()` tüm sonuçları yeniden hesaplar.

---

## 4. Optik okuyucu (OMR)

### Form düzeni (`shared/omr/layout.ts`)
- A4, birim mm.
- Dört köşede 8 mm siyah kare işaret var: merkezleri (14,14), (196,14), (196,283), (14,283).
- 6 haneli öğrenci numarası alanı; isteğe bağlı A/B kitapçık alanı.
- Bölüm başlıkları ve 2–5 şık desteklenir; en fazla 180 soru.
- Sütun sayısı ve satır yüksekliği soru sayısına göre otomatik hesaplanır. Baloncuk yarıçapı yaklaşık 1,9–2,2 mm.
- Bölüm numaraları her bölümde 1'den başlar.
- **Formu basan, örnek üreten ve okuyan kodun hepsi aynı `computeLayout` çıktısını kullanır.** Bu yüzden düzende yapılan bir değişiklik üçünü birlikte etkiler.

### Okuma algoritması (`shared/omr/scan.ts`)
1. Görüntü gri tonlamaya çevrilir. Integral görüntüyle uyarlamalı eşikleme yapılır (pencere ≈ W/8, piksel < yerel ortalama × 0,72 ve < 150).
2. Bağlı bileşenler aranır. En büyük, kareye yakın ve yoğun bloblar köşe işareti adayıdır; her görüntü köşesine en yakın aday seçilir.
3. 4 noktadan homografi hesaplanır (8×8 Gauss eliminasyonu).
4. Her baloncukta yarıçapın %62'si içinde 9×9 örnekleme yapılır. Doluluk ≥ 0,45 ise işaretli kabul edilir; 0,25–0,45 arası "belirsiz" olarak işaretlenir.

İşlem tamamen tarayıcıda yapılır; görüntü en uzun kenarı 1800 px olacak şekilde küçültülür.

### Doğrulama
- Sentetik testlerde (döndürme ±4°, perspektif, gölge, gürültü) online test, LGS (90), TYT (120) ve AYT (80) formlarında tüm cevaplar, öğrenci numaraları ve kitapçık türü doğru okundu.
- Test script'leri depoda yok (geçici klasörde yazıldı). İhtiyaç olursa `computeLayout` + `buildForm` ile görüntü rasterize edip `scanForm` çağırarak yeniden yazılabilir.

### Yön işareti ve kişisel form (5 Kasım 2026)
- **Yön işareti:** sol üst köşe karesinin altında 4 mm kare (`ORIENT_MARK` = (14, 25)). Okuyucu köşe karelerini görüntü köşelerine göre sıralar, dört döngüsel eşlemenin her biri için homografi kurar ve yön işaretinin dolu (≥ %60) göründüğünü seçer. 90°, 180° ve 270° dönük fotoğraflar okunur. İşareti olmayan eski formlarda düz yön varsayılır (eski davranış). `ScanResult.rotation`, `oriented`.
- **Kişisel form:** `FormSpec.personal` (ad, sınıf, numara, QR matrisi). Numara kodlama alanı basılmaz; yerinde QR (öğrencinin kurum sayfası adresi, `shared/omr/qr.ts`) durur. Alt kenarda, köşe kareleri arasında 32 hücrelik **kimlik şeridi** (`shared/omr/idcode.ts`): 20 bit numara + 4 bit sürüm + 8 bit CRC-8 (XOR 0xA5; boş şerit geçersiz). Hücreler 2,8 mm, aralık 4,4 mm; birleşip köşe karesi sanılmazlar.
- **Okuma:** düzen her zaman hem numara alanını hem şeridi içerir; genel ve kişisel form aynı deneme için karışık taranabilir. Şeritte dolu hücre varsa numara yalnızca şeritten alınır (`studentSource: "id"`); sağlama tutmazsa numara boş bırakılır (`"invalid"`), QR'ın bulunduğu numara alanı okunmaz. Tarayıcı kartında kaynak ve dönüklük yazılır.
- **Basım:** `/kurum/denemeler/[id]/form?kisisel=1&sinif=` (sınıfın her öğrencisi için bir sayfa); optik sekmesinde "Kişisel formları yazdır".
- **Örnek üretici:** "kişisel form" ve "rastgele yön" seçenekleri (`renderSampleScan(..., { rotation })`).
- **Doğrulama:** kimlik kodu: 3002 numara gidiş-dönüş, tek bit hatalarının 96064/96064'ü, denenen çift bit hatalarının 15010/15010'u yakalandı; boş ve dolu şerit geçersiz. Uçtan uca (geçici test sayfası, sonra silindi): LGS / TYT / AYT × genel / kişisel × 0° / 90° / 180° / 270° × 2 = 48 sentetik formun hepsinde numara, kitapçık ve bütün cevaplar doğru, yön doğru tespit edildi.

### Bilinen sınırlamalar
- **Gerçek kâğıt testi yapılmadı:** Gerçek kâğıt ve telefon fotoğrafıyla test edilmedi (kullanıcı yapacak). Sentetik örnekler yalnızca ±2,5° eğim, hafif ölçek, gölge ve gürültü içeriyor; güçlü perspektif, kırışık kâğıt, bulanıklık ve yan ışık denenmedi.
- **İşaretsiz eski form ters çekilirse** hâlâ yanlış okunur; bu formlar yeniden basılmalı.
- **QR ile yedek okuma yok:** şerit okunamazsa numara elle girilir.

### Optik okuyucu TXT içe aktarma (`modules/exams/ui/TxtImport.tsx`)
- Sabit sütunlu dosyadaki alanların başlangıç sütunları kullanıcı tarafından tanımlanır: ad, numara, kitapçık, cevaplar.
- Varsayılan tanım: ad 1–25, no 26–31, kitapçık 32, cevaplar 33'ten başlar.
- Tanım tarayıcının `localStorage`'ında saklanır.
- Dosya kodlaması UTF-8 değilse `windows-1254` ile okunur.

---

## 4b. Veli karnesi

- **İçerik:** Seçilen dönemin özeti. Denemeler (ders bazında D/Y/B/net, sınıf ortalaması ve sınıf sırası, önceki denemeye göre değişim), ödevler, devamsızlıklar ve öğretmen görüşü. Telefon ekranına uygun ve yazdırılabilir.
- **Dosyalar:**
  - Veri: `modules/reporting/internal/parentReport.ts` (`parentReports`, `parentReportByToken`)
  - Görünüm: `modules/reporting/ui/veli/VeliKarne.tsx`
- **Paylaşım:**
  - `Student.parentToken` alanında 18 rastgele bayt (base64url) tutulur. Link biçimi: `/veli/<token>?bas=YYYY-MM-DD&bit=YYYY-MM-DD`.
  - Giriş gerekmez, sayfa `noindex`; yalnızca o öğrencinin verisi gösterilir.
  - `POST /api/kurum/veli` ile `share` (varsa aynı token korunur), `renew` (eski link geçersiz olur) ve `revoke` (iptal) yapılır.
- **Takip:**
  - `parentSharedAt`: linkin oluşturulduğu zaman.
  - `parentViewedAt`: velinin linki son açtığı zaman. Kurum hesabıyla açılan önizleme sayılmaz.
- **Öğretmen görüşü:** `Student.parentNote`, `POST /api/kurum/veli/not` ile kaydedilir.
- **Gönderim:**
  - WhatsApp düğmesi `wa.me/<905…>?text=` adresini mesaj hazır olarak açar; numara `shared/phone.ts > waPhone` ile dönüştürülür. Gönderimi kullanıcı onaylar.
  - Toplu "bağlantı listesini kopyala" seçeneği var.
  - Yazdırma: `/kurum/veli-karnesi/yazdir?sinif=` (sınıf) veya `?ogrenci=` (tek öğrenci).
- **Layout:** `src/middleware.ts`, `x-pathname` header'ını ekler. Root layout bu header'a bakarak `/veli/*` sayfalarında site menüsünü ve footer'ı gizler.
- **Kurum adı:** Kurum adı olarak kullanıcının `name` alanı kullanılır; kayıt formundaki etiket "Kurum adı". Demo hesap: "Örnek Eğitim Kurumu".
- **Kapsam dışı:** SMS ve e-posta ile otomatik gönderim yok; veli için giriş yapılan bir veli portalı da yok.

## 4c. Raporlar ve analiz (4 Kasım 2026'da eklendi)

Rapor ihtiyacı, referans sistemin rapor listesi ve kurumların günlük kullanımı karşılaştırılarak belirlendi. Bu adımda "1. öncelik" ve "2. öncelik" raporlarının hepsi yapıldı.

**Tahmini puan** (`modules/exams/domain.ts`: `resolveScoring`, `computeScore`, `maxScore`)
- Formül: puan = taban + Σ(max(0, net) × katsayı). Sonuç `ExamResult.score`'da saklanır.
- Ayar `Exam.scoring` alanında JSON olarak tutulur; boşsa sınav türünün varsayılanı kullanılır:
  - LGS: taban 194,752; katsayılar 4,348 / 4,256 / 4,124 / 1,666 / 1,899 / 1,5075 (tam puan ≈ 500)
  - TYT: taban 100; katsayılar 3,3 / 3,4 / 3,3 / 3,4 (tam puan 500)
  - AYT: taban 100; her ders 5 (yalnızca AYT netleriyle)
  - Serbest: 100 üzerinden eşit ağırlık
- Katsayılar yaklaşık değerlerdir; arayüzde her yerde "tahmini" yazar. Kurum katsayıları cevap anahtarı ekranından değiştirebilir.
- Sıralama tahmini puana göre yapılır (eşitlikte net). Kurum içi yüzdelik = sıra / katılımcı sayısı.

**Konu (kazanım) analizi**
- `sections[].topics`: A kitapçığı soru sırasıyla her sorunun konusu. Cevap anahtarı ekranında "1-5: Konu" biçiminde girilir (`parseTopicSpec` / `formatTopicSpec`).
- `sections[].bOrder`: B kitapçığı eşlemesi; `bOrder[j]` = B'deki j. sorunun A'daki indeksi.
  - "A'dan karıştır" düğmesi `makeBooklet()` ile B anahtarını ve eşlemeyi birlikte üretir.
  - Eşleme yoksa B kitapçıklı öğrenciler o bölümün konu hesabına katılmaz ve arayüz bunu uyarır.
- `topicStats()` konu analizi sekmesini, karnedeki konu başarısını, profildeki konu eksiklerini ve birleştirilmiş karneyi besler (`modules/exams/topics.ts > combinedTopics`).

**Yeni ekranlar ve sekmeler**
- **Deneme sekmeleri:** Konu analizi; Girmeyenler (sınava giren sınıfların kurum içi öğrencilerinden sonucu olmayanlar). Sıralı listeye Puan ve % sütunları, sınıf ortalamalarına ortalama puan eklendi.
- **`/kurum/denemeler/birlesik`:**
  - Seçili sınavlar ortalaması: tür, deneme seçimi ve sınıf filtresiyle; ortalama öğrencinin girdiği denemeler üzerinden alınır.
  - Sınıf birleştirilmiş karne: deneme bazında sınıf ve kurum ortalamaları; öğrenci × deneme net matrisi.
- **`/kurum/ogrenciler/[id]/birlesik?tur=`:** yazdırılabilir öğrenci birleştirilmiş karnesi (denemeler, ortalama, sınıf sırası, net gelişim grafiği, eksik/güçlü konular).
- **Karne:** tahmini puan, yüzdelik dilim ve konu başarısı (öğrenci ile kurum karşılaştırması, öncelikli konular).
- **Veli karnesi:** denemelerde tahmini puan.
- **`/kurum/analiz`** (yardımcı agent yazdı; veri katmanı `modules/reporting/internal/analysis.ts`, grafik `modules/reporting/ui/LineChart.tsx`):
  - **Sınıf gelişimi:** tür ve ders seçimi, sınıf × deneme ortalamaları, çizgi grafik.
  - **Başarı Skoru:** 4 kurallı risk listesinin yerini aldı (5 Kasım 2026). Ayrıntı: bölüm 4f.
  - **Öğretmen ve ders performansı:** ders programı ile deneme bölüm adı eşleştirmesi (takma ad tablosu, "içerir" kuralı); ilk ve son deneme, kurum farkı.
- **Excel'e aktarma:** `shared/ui/ExportButton.tsx` (`write-excel-file` ile gerçek .xlsx). Şu raporlarda var: sıralı liste, sınıf ortalamaları, soru analizi, konu analizi, girmeyenler, birleştirilmiş raporlar, analiz merkezi, devam raporları ve ödev raporu.

**Seed değişiklikleri**
- Denemelere konular ve B eşlemesi eklendi.
- Konu bazında zorluk farkı var; bazı konular kurum genelinde zayıf çıkar.
- Puanlar hesaplanmış durumda.
- Ödev yapma oranı gerçekçi hale getirildi; önceki oranlarla risk listesinin %75'i "ödev yapmıyor" uyarısı alıyordu.

**Doğrulama**
- Tüm yeni sayfalar 200 döndü.
- Puan formülü 39/39 sonuçta bağımsız hesapla aynı çıktı.
- Konu analizi (B kitapçıklılar dahil) 28/28 konuda bağımsız hesapla aynı çıktı.
- Girmeyen sayısı ve seçili sınav ortalaması veritabanıyla aynı.
- Hatalı B eşlemesi 400 döndü; özel katsayı sonrası yeniden puanlama beklenen değeri verdi, varsayılana dönüş eski değerleri geri getirdi.

## 4d. Yıllık takvim ve yıllık ders planı (4 Kasım 2026, aşama 1–2)

- **Sayfa:** `/kurum/takvim`. Ay, yıl ve liste görünümü var; liste yazdırılabilir. Sınıf filtresi seçilen sınıfın kayıtlarını ve kurum geneli kayıtları birlikte gösterir.
- **Veri:** `CalendarEvent` (planning modülü). Türler: HOLIDAY, EXAM (deneme planı), MEETING, EVENT, OTHER. `classroomId` boşsa etkinlik tüm kuruma aittir. Tarihler `YYYY-MM-DD` biçiminde tutulur, iki uç dahildir.
- **Otomatik kayıtlar:** denemeler ve ödev teslimleri takvimde düzenlenemez, tıklanınca kendi sayfasına gider. Bunları `exams/internal/for-planning.ts` ve `homework/internal/for-planning.ts` sağlar.
- **Eğitim yılı:** Eylül–Ağustos arası. `schoolYearOf("2026-11-04") = 2026`.
- **Resmî tatiller:** "Resmî tatilleri ekle" düğmesi yalnızca tarihi sabit olanları ekler (29 Ekim, 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos). **Dinî bayramlar ve MEB ara tatilleri her yıl değiştiği için elle eklenir.** Arife yarım günleri yok.
- **Yoklama ile bağlantı:** `/kurum/yoklama`, o günü kapsayan tatili kırmızı bir uyarıyla gösterir. Etkilenen sınıfların henüz yoklaması alınmamış dersleri "Tatil" olarak işaretlenir ve "yoklaması alınan" sayısına girmez. Bu birleştirme app katmanında yapılır, schedule modülü planning'e bağımlı değildir.
- **Yıllık ders planı** (`/kurum/takvim/plan`, aşama 2). Planı **yönetici** girer; öğretmen girişi yok.
  - **Veri:** `LessonPlan` (sınıf + ders + eğitim yılı başına tek plan; girilen metin `source` alanında saklanır) ve `PlanItem` (konu, `week`/`endWeek` Pazartesi tarihleri, `doneDate`, `sessionId`).
  - **Metin biçimi** (`planning/plan.ts > parsePlan`): her satır bir konu; `Konu | 3` → 3 hafta; `+ Konu` → önceki konuyla aynı hafta. Sekme de ayırıcı sayılır (Excel'den yapıştırma).
  - **Dağıtım** (`layoutPlan`): ilk haftanın Pazartesi'sinden başlar. Pzt–Cum'un tamamı tatil olan haftalar atlanır; sınıfa özel tatiller de hesaba katılır. Editör bu hesabı tarayıcıda canlı önizler.
  - **Düzenleme:** konular yeniden dağıtılır; aynı adı taşıyan konuların "işlendi" bilgisi korunur. Tatil sonradan eklenirse mevcut planlar kendiliğinden yeniden dağıtılmaz; planı açıp kaydetmek gerekir.
  - **İşlendi işareti:** plan sayfasından veya yoklama alma ekranındaki "Bu derste işlenen konu" kartından (`topicsForLesson`) konulur. Eşleşme sınıf + ders adının **tam aynı** olmasına dayanır.
  - **İlerleme** (`planProgress`): bitiş haftası geçmiş ama işlenmemiş konu varsa, en eskisinin bitiş haftasından bu yana geçen hafta sayısı "N hafta geride" olarak gösterilir.
  - **Kopyalama:** plan başka sınıflara kopyalanabilir; dağıtım her sınıfın kendi tatillerine göre yapılır. Planı zaten olan sınıf atlanır.
- **Plan ↔ deneme uyumu** (aşama 3, `planning/internal/coverage.ts`):
  - **Deneme detayı, "Plan uyumu" sekmesi:** denemeye giren her sınıf için, konusu girilmiş bölümlerin her konusu dört durumdan birine ayrılır:
    - `done`: deneme tarihine kadar işlenmiş.
    - `late`: planlanan son haftanın Cuma'sı denemeden önce geçmiş ama konu işlenmemiş (gecikme).
    - `notYet`: planda deneme tarihinden sonraya yerleştirilmiş.
    - `unplanned`: planda karşılığı yok.
  - **Bağlantı:** sınıflar, sonucu olan öğrencilerin sınıfından bulunur. Bölüm ile plan dersi `shared/subjects.ts > subjectMatches` ile eşlenir (TYT "Temel Matematik" ↔ "Matematik").
  - **Konu eşleştirme** (`planning/topics.ts > matchPlanTopics`), sözcüklerin ilk 5 harfine (kök) göre çalışır:
    - Kısa adın bütün kökleri uzun adda geçiyorsa eşleşir ("Olasılık" ↔ "Basit Olayların Olma Olasılığı").
    - Böyle bir eşleşme yoksa, deneme konusunun her kökü plandaki konulardan birinde geçiyorsa o konuların hepsiyle eşleşir ("Yazım ve noktalama" → "Yazım Kuralları" + "Noktalama İşaretleri").
    - Eşleşen plan konusu arayüzde "plandaki karşılığı" diye gösterilir; böylece yanlış eşleşme fark edilebilir.
  - **Analiz merkezi, "Yıllık plan" sekmesi** (`planAlerts`):
    - Plana göre geride kalan dersler.
    - Son 45 gündeki denemelerde yalnızca **gecikme** (`late`) yüzünden işlenmeden sorulan konular. "Sırası gelmemiş" konular gürültü olduğu için listelenmez; LGS/YKS denemeleri bütün müfredattan soru sorar.
- **Öğretmen sayfası** (aşama 4): `/kurum/ders-programi/ogretmen/[id]`. Öğretmen listesindeki ada tıklanarak açılır. Yazdırılabilir; içinde şunlar var:
  - haftalık program,
  - her (sınıf, ders) için bu hafta plana göre işlenecek konular, sıradaki işlenmemiş konu ve geride/uygun durumu (`plansForPairs`),
  - sınıflarının yaklaşan 14 günü. Ödevler yalnızca öğretmenin kendi derslerinden gelir. Sayfa kurum içi olduğu için iç toplantılar da görünür.
- **Veli karnesi, "Yaklaşanlar (30 gün)" bölümü** (aşama 4, `upcomingForStudent`):
  - Kaynaklar: velilere açık etkinlikler, sınıfın ödev teslimleri ve öğrencinin **daha önce girdiği türdeki** denemeler. Denemenin sınıfı olmadığı için tür üzerinden süzülür; 12. sınıf velisi LGS denemesi görmez.
  - **Gizlilik:** `CalendarEvent.parentVisible` alanı. Varsayılan türe göre belirlenir (`EVENT_KINDS[k].parentDefault`): tatil, deneme planı ve etkinlik açık; toplantı ve diğer kapalı. Etkinlik formunda "Velilere göster" kutusuyla değiştirilir; takvimin liste görünümünde 👪 ile işaretlenir. Velilere açık etkinliğin **notu da velilere görünür**.
- **Yapılmayanlar:** öğretmen ve öğrenci girişi (rol/yetki sistemi). Bunun yerine öğretmen için yazdırılabilir sayfa, veli için mevcut paylaşım linki kullanılıyor.

## 4f. Başarı Skoru (5 Kasım 2026)

Rakip analizinden sonra "erken uyarı" iş önceliği olarak seçildi. Öğrenci başına 0–100 skor, nedenini söyleyen cümleler ve 4 haftalık gidiş.

- **Dosyalar:**
  - Saf hesap (istemci + sunucu): `modules/reporting/score.ts` (`SCORE_DIMS`, `SCORE_RULES`, `dimScores`, `totalScore`, `scoreStudent`, `normalizeScoreSettings`).
  - Veri: `modules/reporting/internal/score.ts` (`scoreSignals(ownerId, asOf)`, `successScores`, `studentSuccessScore`, `scoreSettings`, `saveScoreSettings`).
  - Arayüz: `modules/reporting/ui/score/` (`ScoreParts`, `ScoreCard`, `ScoreSettingsForm`).
- **Boyutlar** (her biri 0–100; varsayılan ağırlık):

  | Boyut | Ölçüm | Ağırlık |
  |---|---|---|
  | Akademik düzey | Son denemedeki tahmini puanın kurum içi yüzdeliği (eşitlikte yarım) | 30 |
  | Gelişim | Son en fazla 4 denemede net eğimi; −5 net/deneme → 0, +5 → 100. Tür: en az iki denemesi olan türlerden en son girileni (12. sınıfta tek AYT varsa TYT) | 25 |
  | Deneme katılımı | Son 60 günde sınıfının girdiği denemelerden girdiği oran | 10 |
  | Devam | Son 30 gün (Geldi + Geç) / tüm kayıtlar; %70 ve altı 0, %100 → 100 | 20 |
  | Ödev | Son 30 günde teslimi geçen ödevler; eksik yarım sayılır | 15 |

  - Verisi olmayan boyut hesaba girmez, kalan ağırlıklar oranlanır.
  - Seviyeler: 70+ İyi, 50–69 İzlenmeli, 50 altı Risk altında.
  - **Açıklamalar:** en çok puan kaybettiren iki boyut cümleye çevrilir (`reasonFor`).
  - **Trend:** aynı hesap 28 gün önceki tarih için tekrarlanır (`asOf`). Anlık görüntü tablosu yok. "Risk seviyesine düşen" = şimdi risk altında, 28 gün önce skoru olan ve risk altında olmayan.
- **Ayarlar:** yeni `Setting` tablosu (`ownerId + key`, JSON `value`); `score` anahtarı ağırlık ve eşikleri tutar. Şimdilik yalnız reporting yazar. `POST /api/kurum/ayarlar/skor` (`{ settings }`, `null` = varsayılan). Hatalı değerler `normalizeScoreSettings` ile kırpılır.
- **Ekranlar:** `/kurum/analiz?tab=skor` (eski `?tab=risk` buraya yönlenir; sınıf ve seviye filtresi, boyut çubukları, açıklamalar, Excel, altta ayarlar ve canlı dağılım önizlemesi), öğrenci profilinde skor kartı (kurum dışı ve sınıfsız öğrencide yok), kokpitte "Risk seviyesine düşenler".
- **Gizlilik kararı:** skor veliye gösterilmez; kurum içi araçtır.
- **Seed:** her sınıftan iki öğrenci son 18 günde düşüşe geçer (net, devam, ödev). Yoklamalar 7 haftaya, ödev teslimleri 31 gün öncesine kadar yayıldı; böylece 28 gün önceki skor da aynı boyutlarla hesaplanır.
- **Doğrulama:** bağımsız Python hesabı (SQLite'tan) 79/79 öğrencide skor ve beş boyutta sayfayla aynı; "risk seviyesine düşen" sayısı aynı. API: girişsiz 401, hatalı ayar normalize, varsayılana dönüş çalıştı. Eski `riskList` ve `risk.ts` kaldırıldı.

## 4g. Haftalık veli raporu (5 Kasım 2026)

Kurumun her hafta tek ekrandan bütün velilere kısa bir özet göndermesi için. POC'ta gönderim WhatsApp ve kopyalama ile kullanıcı tarafından yapılır; sistem kaydı tutar.

- **Sayfa:** `/kurum/veli-bulteni` (menüde "Haftalık veli raporu"). Hafta seçici (varsayılan: geçen, tamamlanmış hafta; ileri gidilemez), sınıf seçimi, "Karneleri yazdır" (mevcut yazdırma sayfası, hafta aralığıyla).
- **Dosyalar:** saf mesaj üretici `modules/reporting/weekly.ts` (`weeklyLines`, `weeklyMessage`, `weekLabel`, `lastWeekStart`, şablon); veri `reporting/internal/weekly.ts` (`weeklyReports`, `updateWeekly`, `weeklyTemplate`); arayüz `reporting/ui/veli/WeeklyPanel.tsx`; route `POST /api/kurum/veli/haftalik`.
- **Özet:** mevcut veli karnesi hesabından (`parentReports`, hafta aralığıyla) türetilir: denemeler (net, sınıf ortalaması, tahmini puan), ödevler, devam (gelmediği dersler), önümüzdeki 7 gündeki velilere açık kayıtlar. Boş satırlar mesaja girmez.
- **Mesaj:** şablon girişi + özet + haftanın öğretmen notu + karne bağlantısı (`/veli/<token>?bas&bit` = hafta) + kapanış. Şablon `Setting` > `weekly` (`{veli}`, `{ogrenci}`, `{hafta}`, `{kurum}`). Mesaj tarayıcıda üretilir; not yazılırken önizleme canlıdır. Bağlantının alan adı yüklemeden sonra eklenir (hydration uyumu).
- **Kayıt:** `ParentDispatch` (öğrenci + hafta başına tek satır): `note`, `channel` (WHATSAPP / COPY / PRINT), `message` (gönderilen metin), `sentAt` (null = bekliyor). "Geri al" notu korur. "Veli açtı" = `parentViewedAt ≥ sentAt`.
- **Gönderim:** satır başına WhatsApp (mesaj hazır açılır ve gönderildi işaretlenir) ve kopyala; toplu "bekleyen mesajları kopyala"; tarayıcı çoklu pencereyi engellediği için toplu WhatsApp yerine "Sıradaki: <öğrenci>" düğmesi. Bağlantısı olmayanlar için toplu bağlantı oluşturma.
- **Başarı Skoru ile bağ:** risk altındaki ve notu olmayan öğrenci sayısı uyarı olarak çıkar; not alanında skorun açıklama cümleleri tıklanabilir öneri olarak durur. Skorun kendisi mesaja girmez.
- **SMS'e geçiş:** `channel` için yeni değer ve `updateWeekly` içinde sağlayıcıyı çağıran bir dal eklenecek; ekranda "SMS ile gönder" düğmesi.
- **Seed:** 8-A'da geçen haftanın raporu ilk altı veliye bu Pazartesi WhatsApp ile gönderilmiş; dördü açmış.
- **Doğrulama:** sayfa 200, konsol hatası yok; not (kırpma), gönderildi (başka kurumun / olmayan öğrenci atlanır), geri al, şablon ve varsayılana dönüş çalıştı; Pazartesi olmayan hafta, geçersiz kanal ve işlem 400, girişsiz 401.

## 4h. Madde analizi (5 Kasım 2026)

Deneme detayındaki "Soru frekans analizi" sekmesi "Madde analizi" oldu (`?tab=analiz`).

- **Hesap:** `modules/exams/items.ts > itemAnalysis(sections, results, choiceCount)` (saf). Bütün kitapçıklar `orderFor()` ile A sırasına çevrilir; kitapçıklarda yalnızca soru sırası karıştığı için şıklar aynıdır ve dağılımlar birleştirilir. Soru numaraları A kitapçığına göredir. Eşlemesi olmayan kitapçığın cevapları o bölümde analize girmez ve ekranda uyarılır (`skipped`).
- **Güçlük:** doğru oranı. Çok zor < %30, çok kolay > %85 (`ITEM_RULES`).
- **Ayırt edicilik (D):** bölüm doğru sayısına göre üst %27 ile alt %27'nin doğru oranı farkı. Ölçüt bölümdür (Türkçe sorusu Türkçe başarısıyla). Ebel sınıfları: ≥ 0,40 çok iyi, 0,30 iyi, 0,20 düzeltilebilir, altı zayıf. **Eşitlik bozma:** bölüm doğru sayısı → bütün sınavdaki doğru sayısı → cevap dizisi. Bu olmadan D değeri sonuçların listelenme sırasına bağlıydı (doğrulamada yakalandı).
- **Uyarılar:** `KEY` "Anahtar hatası olabilir" (üst grupta bir yanlış şık doğru şıktan çok ve ≥ %30 seçilmiş), `NEGATIVE_D` (D < 0), `LOW_D` (D < 0,20 ve en az 20 katılımcı).
- **Seed:** LGS Deneme 3, Matematik 5. sorunun anahtarı kasıtlı olarak yanlış kaydedilir (öğrenciler doğru anahtarla cevaplar); uyarı bu soruda görünür.
- **Doğrulama:** bağımsız Python hesabı LGS 3 (90), TYT 1 ve 2 (120'şer), AYT (80) denemelerinde bütün sorularda şık oranları, güçlük ve D için sayfanın Excel verisiyle aynı. Yüzde hesabı `(x × 100) / n` sırasıyla yapılır; `(x / n) × 100` kayan noktada 57,5'i 57'ye yuvarlıyordu.

## 4i. Bilişsel düzey (5 Kasım 2026)

- **Düzeyler:** Bilgi, Kavrama, Uygulama, Analiz (Bloom'un sadeleştirilmiş dört basamağı). Liste `shared/cognitive.ts` içinde, çünkü soru havuzu (`question-bank`) `exams`'e bağımlı olamaz. `normalizeLevel` kısaltmaları tanır ("uyg", "ANALİZ").
- **Ad çakışması:** arayüzde "Düzey" zaten sınıf / sınav düzeyi (5–12, LGS…) anlamında; bu alan her yerde **"Bilişsel düzey"** diye yazılır.
- **Nerede tutulur:** düzey sorunun özelliğidir, konunun değil. Denemede `sections[].levels` (A sırasıyla, `topics` gibi); soru havuzunda `QuestionItem.level`. Havuzdan kurulan denemeye kopyalanır (`from-bank.ts`).
- **Giriş:** cevap anahtarı ekranında konuların altında, aynı "1-5: Uygulama" biçimi (`parseLevelSpec`; tanınmayan ad hata verir, API tarafı tanınmayanı boş bırakır). Soru havuzunda kesme ekranı varsayılanı ve toplu düzenleme; kartta rozet.
- **Analiz:** `levelStats(sections, results)` (eşlemesiz kitapçık hariç). Konu analizi sekmesinin üstünde dört düzeyin doğru oranı (sınıf seçiliyse kurum oranı da); karnede "Bilişsel düzeye göre başarı" satırı (kurum çizgisiyle); madde analizinde "Bilişsel" sütunu ve Excel'de.
- **Seed:** sorulara sabit desenle düzey atanır; düzey zorluğu etkiler (bilgi +0,12 … analiz −0,16).
- **Doğrulama:** LGS 3 ve TYT 2'de düzey oranları bağımsız hesapla aynı; madde analizi 90/90; karne 200; API kısaltmayı düzeltti, tanınmayanı boş bıraktı; soru havuzu toplu düzey atama çalıştı.

## 4e. Tasarım dili (4 Kasım 2026)

Arayüz, ürünün en karakteristik nesnesi olan **optik form** üzerine kurulu. Yeni ekran yazarken şu kurallara uyun:

- **Renkler** (`src/app/globals.css > @theme`):
  - `paper` #f4f5f1: zemin.
  - `graphite` #2a2d31: metin, birincil düğme ve dolu işaretler.
  - `lead` #6b7078: ikincil metin.
  - `rule` #dcdfd8: çizgiler.
  - `mist` #ebede7: nötr etiket zemini.
  - `ink` #b8325a: form mürekkebi. **Yalnızca yapı için** kullanılır: aktif menü halkası, odak, bağlantı, "bu hafta" gibi konum vurguları.
  - Eski `brand-*` sınıfları mürekkebe bağlı; **geniş yüzeylerde (dolgu, tablo satırı, kutu) kullanmayın**.
  - Durum renkleri emerald/amber/red ve sönük kalır.
- **Yazı:**
  - Başlıklar (h1–h3) Instrument Sans dar kesim (`font-stretch: 82%`); metin Lexend. Lexend okuma akıcılığı için tasarlandı. Atkinson Hyperlegible denendi, çizgili sıfırı tarih ve netlerde rahatsız ettiği için bırakıldı.
  - Tablolar ve `.num` sınıfı tablo hizalı rakam kullanır. Monospace yalnızca harf hizasının anlam taşıdığı yerlerde var: cevap anahtarı, TXT içeriği, plan editörü.
- **İmza öğesi, işaretleme baloncuğu:**
  - logo: cevap satırı `○○●○○` (`shared/ui/Logo.tsx`),
  - aktif menü maddesi: dolu baloncuk,
  - `.badge`: önünde küçük bir durum noktası (nokta istenmiyorsa `badge-plain`),
  - gün çizelgesi (`schedule/ui/LessonDay.tsx`): yoklama alındı ● / bekliyor (mürekkep halka) / tatil (soluk).
- **Yerleşim:**
  - Kurum panelinde tek çerçeve kenar çubuğudur; üst bar ve alt bilgi yalnızca herkese açık sayfalarda görünür.
  - Menü işe göre gruplanır: Bugün, Öğrenciler, Sınavlar, Planlama, Raporlar.
  - Özet sayıları (`Kpi`) kart değil, üstü grafit çizgili hücredir. Kart (`.card`) yalnızca tablo ve form gibi bağımsız bloklar içindir; gölge yoktur.
- **Metin:**
  - Başlıklar ve etiketler cümle düzeninde yazılır.
  - BÜYÜK HARFLİ etiket, bağlantı sonunda "→" ve düğmelerde emoji kullanılmaz.
  - Aynı eylem her yerde aynı adla anılır ("Kurum hesabı açın", "Ek ders ekle").
- **Hareket:** tek bir an var: açılış sayfasındaki optik formun dolması. `prefers-reduced-motion` açıksa bütün animasyonlar kapanır.

## 4j. Ders takip temeli (7 Kasım 2026, dal `dahili-ders-takip`)

Hedef ve kararlar: `notes/dahili-ders-takip.md`. Kurum modeli: 9–12. sınıflar; okul, mesleki, dini, hazırlık ve etüt dersleri; her sınıfın bir etüt mesulü; öğrenci birden fazla sınıfa üye olabilir; bazı dersler başka kurumda alınır. **Proje geneldir: gerçek kurum ve kişi adları kullanılmaz.**

PoC 1. adımı (temel) yapıldı:
- **Veri:** `Course`, `ClassMember`, `Classroom.mentorId`, `Teacher.role` (TEACHER / MENTOR), `ScheduleSlot.courseId`. Ayrıntı: ARCHITECTURE.md > "Ders, sınıf üyeliği ve etüt mesulü".
- **Sınıf sayfası** `/kurum/siniflar/[id]` (Sınıflar sekmesindeki kartlardan): etüt mesulü seçimi, dersler (ekle / düzenle / sil; tür, sorumlu, "başka kurumda alınıyor"), öğrenciler (ana sınıf + başka sınıftan katılanlar; ad veya numarayla arayıp ekleme, çıkarma).
- **Öğretmenler:** rol sütunu ve seçimi. Rol gönderilmeden düzenlenirse mevcut rol korunur.
- **Yoklama:** sınıfın ek üyeleri listeye girer ve kaydedilebilir; gün listesindeki toplam ek üyeleri içerir.
- **Öğrenci profili:** başlıkta ana sınıf ve "Ayrıca:" ek sınıflar (bağlantılı).
- **Sıralama:** dersler ve sınıf sayfasındaki öğrenciler Türkçe sıralanır (SQLite "İ, Ö, Ş"yi sona atıyordu).
- **API:** `POST /api/kurum/dersler`, `PATCH|DELETE /api/kurum/dersler/[id]`, `PATCH /api/kurum/siniflar/[id]` (`name`, `level`, `mentorId`), `POST /api/kurum/siniflar/[id]/uyeler`, `DELETE /api/kurum/siniflar/[id]/uyeler/[studentId]`.
- **Seed:** mevcut 8/12 sınıflarına dersler (12'ler hazırlık) ve etüt mesulleri; yeni 9-A, 9-B, 10-A, 11-A (öğrenci no 2001–2066) okul/mesleki/dini/etüt dersleri ve başka kurumda alınan Matematik/Türkçe (Edebiyat) ile; SEVİYE-2 dini ders grubu (10-A ve 11-A'dan 16 ek üye, hafta sonu programı). Yeni program sınıf ve öğretmen çakışmasız yerleştirilir. Bütün adlar kurgusal.
- **Doğrulama (7 Kasım):** sayfalar 200, olmayan sınıf 404; ders ekleme/aynı ad 409/geçersiz tür 400/boş ad 400; yeniden adlandırma program satırlarını güncelledi, var olan ada 409; programda saati olan ders silinemedi (409); etüt mesulü olmayan atama 400; ek üye: ana sınıfı aynı 409, tekrar 409, çıkarma 200 → tekrar 404; ek üyesi olan sınıf silinemedi; programa yeni ad eklenince ders kendiliğinden oluştu (tür tahmini doğru); SEVİYE-2 yoklamasında 2 üye kaydedildi, sınıf dışı öğrenci yok sayıldı; yoklama sayfası 16/16 ek üyeyi gösterdi; başka kurum her işlemde 404/400; girişsiz 401. `tsc`, `lint`, `build` temiz.
- **Bilinen:** eski seed'deki öğretmen programında birkaç saat çakışması var (bu adımdan önce de vardı; yeni eklenenlerde yok). Ödev ve yıllık plan henüz derse `courseId` ile değil, (sınıf, ders adı) ile bağlı.

## 4k. Roller ve telefondan giriş (7 Kasım 2026, PoC 2. adım)

- **Kişisel link:** Ders programı → Öğretmenler'de "Giriş linki" sütunu: oluştur, kopyala, WhatsApp, yenile, kaldır, son giriş. Link `/o/<anahtar>`; açılınca oturum başlar. Yenilenen/kaldırılan linkin oturumu kapanır. Geçersiz linkte giriş sayfası uyarı verir.
- **Roller:** etüt mesulü yönetim panelini açar (kenar çubuğunda adı ve "Derslerim"); öğretmen yalnızca `/ogretmen`. Kurum hesabı `/ogretmen`'e girmez (panele yönlenir).
- **"Bugün" ekranı:** son 14 günün yoklaması alınmamış (tatil olmayan) dersleri "Eksik girişler" olarak üstte; günün dersleri yoklama ve "konu işlendi" durumuyla; gün gezinme.
- **Ders ekranı:** plandan işlenen konu (plan bağlantısı yok) ve telefona uygun yoklama: herkes "geldi" varsayılır, satıra dokunmak "gelmedi" yapar, Geç/İzinli küçük düğmeler; Kaydet altta sabit. Ek üyelerin ana sınıfı yazılır.
- **Yetki denetimi:** öğretmen başkasının dersine yoklama, başka plana işaret, başkasının oturumunu silme ve ders ekranını açma denemelerinde 404 aldı; etüt mesulü hepsini yapabildi; rol değişikliği linke yansıdı.
- **Seed:** etüt mesulleri ve yeni öğretmenlere link; Selin Akar, Mahmut Kara ve Ercan Sevim'in son 5 günde bazı yoklamaları bilerek boş (eksik giriş örneği); SEVİYE-2 Tecvid, 9-A Bilişim Teknolojileri, 10-A Programlama yıllık planları.
- **Bilinen:** link şifresiz (bilinçli PoC kararı); anahtar veritabanında düz durur (veli linki gibi). Değerlendirme (sözlü/yazılı) ders ekranına 3. adımda eklenecek.

## 4l. Sözlü / yazılı / uygulama değerlendirmesi (7 Kasım 2026, PoC 3. adım)

- **Yönetici** (`/kurum/degerlendirme`, menü "Sözlü ve yazılı"): değerlendirme listesi (sınıf süzgeci), yeni değerlendirme, puan cetvelleri (düzenle / sil / 5 hazır örnek: Kur'an okuma, Ezber, Bilgi sözlüsü, Proje / uygulama, Yazılı 100). Sonuç sayfası: öğrenci × kriter tablosu, kriter ortalamaları, "Puan gir" (aynı telefon bileşeni), **kâğıt form** (sınıf listesi × kriterler, boş kutular).
- **Öğretmen** (telefon): üstte "Bugün / Sözlü ve yazılı"; derslerim (etüt mesulüne sınıfının bütün dersleri, dışarıda alınanlar dahil) → "Başlat": tür (ders türüne göre varsayılan), cetvel (ders türüne uygun önce), plan konusu (bu haftaki seçili), tarih, başlık. Puan girişi: ilk puansız öğrenci açık gelir; kriter başına hızlı düğmeler (≤10 ise bütün değerler, büyükse 0/%25/%50/%75/%100) + sayı; not; Gelmedi; "Kaydet ve sonraki". Ders ekranında da "Sözlü / yazılı + Başlat" ve günün değerlendirmeleri.
- **Analiz (öğrenci, sınıf):** öğrenci profilinde "Sözlü ve yazılı" (derse göre ortalama, en düşük üstte, son iki notta 10 puan düşüşse "düşüşte", son 3 not). Sınıf sayfasında her dersin altında son 30 gün özeti; hiç değerlendirme yoksa ya da değerlendirilmemiş öğrenci varsa sarı.
- **Seed:** 5 cetvel; SEVİYE-2 Kur'an (4 sözlü), Tecvid (2 sözlü, plan konusuna bağlı), 9-A Bilişim (2 proje), 9-A Matematik dışarıda ("Okul 1. yazılı", etüt mesulü), 10-A Fizik yazılı, 11-A Web projesi, 9-B İslam Tarihi sözlü. Sözlülerde sınıfın bir kısmı puanlanır; her sınıftan bir öğrencinin son notu düşer.
- **Doğrulama:** cetvel hatalı puan/boş kriter 400, öğretmen cetvel ekleyemez 401; öğretmen kendi dersine plan konusuyla açtı, başkasının dersine 404, başka dersin konusu 400; puan sınır aşımı/eksik kriter/sınıf dışı öğrenci 400, gelmedi ve silme çalıştı, yüzde doğru (77/100 → %77); başkasının değerlendirmesine puan/silme/ekran 404; etüt mesulü dışarıdaki derse yazılı açtı. Sayfalar 200; `tsc`, `lint`, `build` temiz.

## 4m. Takibat (7 Kasım 2026, PoC 4. adım)

- **Sayfa:** `/kurum/takip` (menü Bugün → "Takip"; etüt mesulünün öğretmen ekranındaki "Takip" düğmesi). Veri `reporting/internal/followup.ts`, eşikler `FOLLOW_RULES`.
- **Kapsam:** etüt mesulünde varsayılan kendi sınıfları ("Sınıfım" / "Tüm kurum"), her iki rolde sınıf süzgeci.
- **Dikkat isteyenler:** öğrenciler gerekçeleriyle (Devam: son 14 günde derslerinin %15'i ve en az 3 devamsızlık, önceki 14 günle; Not: aynı derste son iki notta 15+ puan düşüş ya da son 30 gün ortalaması %50 altı; Ödev: 30 günde 2+ yapılmayan), girişi eksik dersler (7 gün, öğretmene göre), plana göre geride kalanlar, 30 gündür sözlü/yazılı olmayan dersler (etüt ve hazırlık hariç; hazırlık denemeyle ölçülür).
- **Eşik ayarı:** ilk sürümde "3 devamsızlık" ve "10 puan düşüş" demo veride 148 öğrenciden 46'sını işaretliyordu (kalabalık programda gürültü); orana ve 15 puana çekilince 33.
- **Sınıflar:** son 30 gün devam (%90 altı kırmızı), ödev (%70 altı), sözlü/yazılı ortalaması ve sayısı, geride plan sayısı, etüt mesulü.
- **Dersler:** aynı adlı dersin sınıflar arası durumu (60 gün): değerlendirme sayısı, ortalama, en zayıf kriter, plan ilerlemesi; dersin bütün sınıflarındaki kriter ortalamaları başlıkta.
- **Öğretmenler:** son 14 gün ders, yoklaması alınan (eksik vurgulu), işaretlenen konu (planlı derslerde), açılan değerlendirme, son giriş. Ada göre sıralı; sıralama değil, etkinlik takibi.
- **Veli:** karnede "Sözlü ve yazılı" bölümü (dönemdeki notlar, gelmedi, not); haftalık veli mesajında her değerlendirme bir satır.
- **Seed:** 8. sınıf dersleri de hazırlık (PREP).
- **Doğrulama:** sayfalar kurum hesabı ve etüt mesulüyle 200, öğretmen `/ogretmen`'e yönlenir; etüt mesulü kapsamı kendi sınıfları (10-A, SEVİYE-2); devamsızlık eşiğine uyan öğrenci sayısı SQL ile aynı; veli karnesinde bölüm geçici paylaşım anahtarıyla görüldü (anahtar sonra kaldırıldı). `tsc`, `lint`, `build` temiz.

## 4n. Sınav tarafı ve ödev (7 Kasım 2026, PoC 5. adım)

- **Sınava özel okuyucu (FMT) biçimi:** `Exam.readerFormat` (JSON); saf yardımcılar `exams/reader.ts` (`parseReaderFormat`, `readerFormatError`, `readLine`, `writeLine`, `contiguous`). Her bölümün cevapları ayrı başlangıç sütunundan okunur; bloklar çakışamaz. TXT sekmesinde "Biçimi bu sınava kaydet", "Başka sınavdan kopyala", "Bölümleri arka arkaya diz", "Varsayılana dön"; önizlemede her bölüm ayrı renk. Yeni deneme formunda "Okuyucu (FMT) biçimi: X ile aynı" (`readerFrom`). Eski tarayıcı (`localStorage`) tanımı kaldırıldı. API `PUT /api/kurum/denemeler/[id]/okuyucu`.
- **Hocanın sınavı:** `Exam.courseId` (isteğe bağlı). Yeni deneme ve havuzdan sınav formunda ders seçimi; deneme başlığında değiştirilebilir (`PUT …/ders`); listede ders adı.
- **Çalışma kağıdı:** `Exam.purpose = WORKSHEET`. Havuzdan kurarken "Çalışma kağıdı (puanlanmaz)"; cevap zorunlu değil (anahtarda boşluk), varsayılan tek kitapçık. Sayfada yalnızca cevap anahtarı sekmesi; kitapçıkta optik form yok, tek kitapçıkta kitapçık kutusu yok. Kitapçığa "Cevap anahtarı sayfası" seçeneği (bütün sınavlarda).
- **Ödev:** atama ve liste ek sınıf üyelerini de kapsar (`inClass`). Ödev formunda ders önerileri seçili sınıfın derslerinden. Öğretmen yalnızca girdiği sınıf + derse ödev verir ve işaretler (`homework` → `schedule` bağımlılığı). Telefon: ders ekranında "Ödev" bölümü (son 14 / önümüzdeki 21 gün, "işaretlenmedi" uyarısı), `/ogretmen/odev/yeni`, `/ogretmen/odev/[id]`. Yeni rapor `/kurum/odevler/ders-raporu` (sınıf × ders, 60 gün, yapma oranı düşükten, Excel).
- **Seed:** "Ara kontrol sınavı (FMT örneği)" — `notes/ornek-fmt.txt` ile birebir bölümler, anahtar, B eşlemesi ve kayıtlı biçim (9-A İslam Tarihi'ne bağlı, sonuçsuz); yeni sınıflara 3 ödev (biri teslimi geçmiş, kısmen işaretlenmemiş).
- **Doğrulama:** örnek dosya kayıtlı biçimle okunup kaydedildi: 19 sonuç, 009999 atlandı, kitapçığı boş satır ayrıca bildirildi; A ve B kitapçıklı iki öğrencinin doğru sayısı bağımsız hesapla aynı (28, 27). Çakışan/eksik biçim 400, öğretmen biçim değiştiremez 401; biçim ve ders yeni sınava kopyalandı; olmayan ders 400. Cevapsız soruyla sınav 400, çalışma kağıdı 200 (anahtar " BC"); çalışma kağıdında tek sekme, kitapçıkta anahtar sayfası. Öğretmen kendi dersine ödev 200, başka derse 400, başkasının ödevi 404; SEVİYE-2 ödevi 16 ek üyeye atandı. `tsc`, `lint`, `build` temiz.
- **Test kazası:** çalışma kağıdı testinde havuzdaki bir sorunun cevabı silindi (Matematik · Üslü, ilk soru `cmw3novzk0008huhmhoflao44`). Soru havuzu seed ile sıfırlanmadığı için geri gelmedi; asıl değer bilinmiyor (sonraki soruların sırasına göre muhtemelen "A"). Kullanıcının kontrol edip girmesi gerekiyor.

## 4o. Haftalık plan içe aktarma (7 Kasım 2026, PoC 6. adım)

- **Sayfa:** `/kurum/takvim/plan/haftalik` (Yıllık planlar → "Haftalık planı içe aktar"). Excel (.xlsx), CSV ya da yapıştırma; "Örnek şablonu indir" ve "Örnekle dene". Örnek dosya `notes/ornek-haftalik-plan.csv` (Seviye-2 PDF'inin Eylül–Kasım haftalarından elle aktarıldı, tarihler 2026–27'ye kaydırıldı).
- **Tablo:** ilk sütun hafta tarihi ("7 Eylül 2026", 07.09.2026, 2026-09-07 ya da Excel tarihi), diğer sütunlar dersler. Saf dönüştürme `planning/weekly.ts` (`parseWeeklyTable`, `buildSubjectPlans`, `izinRanges`, `parseDelimitedTable`).
- **Kurallar:** her ders sütunu bir yıllık plan; art arda aynı konu birleşir ("Konu | 2"); boş hücre önceki konuyu bir hafta uzatır (sondaki boşluklar hariç); dersin ilk dolu haftasından başlar. Bütün hücreleri boş ya da "izin / izni / tatil" yazan satır izin haftası: etiket hücredeki açıklama.
- **Kaydetme** (`planning > importWeeklyPlans`, `POST /api/kurum/plan/haftalik`): seçilen sınıflar × dersler; izin haftaları sınıfa özel tatil olarak takvime (aynı aralıkta tatil varsa eklenmez; velilere açık). Var olan plan atlanır ya da "yeniden yaz" ile güncellenir (aynı adlı konuların "işlendi" bilgisi korunur). Tablodaki bir ders haftası takvimde zaten tatilse uyarı döner (dağıtım o haftayı atlar, tarihler kayar).
- **Önizleme:** ders adları düzeltilebilir; seçili sınıfta o adla ders kaydı yoksa uyarı (yoklama ve "işlendi" adla eşleşir).
- **Sınırlar:** bir konu en fazla 20 hafta sürebilir (plan metni sınırı); plan yılı başlangıç tarihinden (`schoolYearOf`, Eylül–Ağustos) belirlenir. Ağustos'ta başlayan bir tablo (ör. 9. sınıflar) önceki eğitim yılına düşer.
- **Doğrulama:** örnek CSV: 13 hafta, 2 izin, 5 ders; SEVİYE-2'ye ilk kayıtta Tecvid planı var olduğu için atlandı, 4 plan + 2 tatil oluştu; "yeniden yaz" ile 5 plan güncellendi; Tecvid "Medd-i lâzım" 23 Kasım'a düştü (9 Kasım izni atlandı), tablodakiyle aynı; boş sınıf / olmayan sınıf 400, girişsiz 401. `tsc`, `lint`, `build` temiz. Demo veri sonra yeniden yüklendi.

## 4p. Uç değerleri ayır (8 Kasım 2026)

- **Karar:** uç değerler silinmez, yalnızca ortalamadan ayrılır ve "Uç değerler" kutusunda ayrıca listelenir (ekstrem durumlar takip edilsin). Düğme varsayılan kapalı; adreste `uc=1`, sekmeler arasında korunur.
- **Yöntem:** `shared/stats.ts`: kutu grafiği kuralı (Tukey, 1,5 × IQR, Excel ÇEYREK.DAHİL ile aynı çeyrek). 8 kişiden az grupta ya da IQR = 0 ise tespit yok. Standart sapma kuralı küçük sınıflarda uç değeri gizlediği için seçilmedi.
- **Nerede:** deneme → Sınıf ortalamaları (her sınıf kendi içinde, kurum geneli kurum içinde), Sıralı liste (seçili grup; sıra ve yüzdelik dilim değişmez, satırda "uç ↓/↑"), Analiz → Sınıf gelişimi (her sınıf × deneme hücresi kendi içinde). Uygulanmayan yerler: öğrenci karnesi, veli karnesi, sıra, yüzdelik, yoklama.
- **Arayüz:** `shared/ui/Outliers.tsx` (`OutlierToggle`, `OutlierBox`, `withOutliers`). `examReport` her gruba `trimmed`, `low`, `high`, `fences` ekler; `classProgress(…, trim)` hücreye `removed` ekler.
- **Demo:** seed'de TYT Deneme 2'ye giren ilk öğrenci A kitapçığını çözüp B işaretlemiş (−7 net). Uç değer olarak yakalanır; Sınıf gelişiminde 12-A düğme kapalıyken ▼ 3,42, açıkken ▲ 1,73.
- **Takip (2. adım):** dikkat listesine `uc` gerekçesi (mavi "Uç değer"), düğmeden bağımsız: son 30 günde bir sözlü/yazılıda (değerlendirmenin kendi içinde) ya da denemede (deneme × sınıf içinde) çok düşük sonuç. Aynı derste zaten "Not" gerekçesi varsa ayrı satır açılmaz, o satıra "… ile grubun çok altında" eklenir. Sınıflar ve Dersler sekmelerinde düğme: `classComparison(…, trim)` / `courseAnalysis(…, trim)`; ayırma her değerlendirmenin kendi içinde, Derslerde kriter ortalamalarından da çıkarılır. Yardımcılar `outlierMarks`, `groupBy` (`followup.ts`).
- **Demo (2):** 10-A "Fizik ara sınavı"nda son öğrenci kâğıdı neredeyse boş (p = 0,06). Seed rastgele: rakamlar her `db:seed`'de değişir, test senaryosunda kesin rakam yazılmaz.
- **Sözlü ve yazılı (3. adım):** `listAssessments` her değerlendirmeye `trimmedAvg`, `removed` ekler; `AssessmentList`'in `trim` özelliği (yalnızca yönetici listesi, öğretmen ekranı değişmez). Detay sayfası: düğme, "uç ↓/↑" işareti, ortalama ve kriter ortalamaları ayrılmış; "Puan gir" modunda düğme yok.
- **Madde analizi (3. adım):** düğme açıkken seçili grubun (sınıf ya da kurum) uç değerleri `itemAnalysis`'e verilmez. Demo: 12-A'da "gözden geçirilecek soru" 10 → 2 (yanlış kitapçıklı tek kâğıt 8 soruyu şüpheli gösteriyordu).
- **Kapsam dışı kalanlar:** konu analizi, öğrenci karnesi, veli karnesi, sıra / yüzdelik, yoklama.
- **Not:** `npm run build`, çalışan `next dev`'in `.next` klasörünü bozar; derlemeden sonra dev sunucusu `.next` silinip yeniden başlatılmalı.

## 4q. Menü ve arama (8 Kasım 2026)

- **Menü** (`shared/ui/KurumNav.tsx`): Özet · Giriş (Yoklama, Sözlü ve yazılı, Ödevler, Denemeler ve optik) · Takibat (Takip, Analiz, Veli karnesi, Haftalık veli raporu) · Araçlar (Soru havuzu) · Yönetim (Öğrenciler, Sınıflar, Dersler, Öğretmenler, Ders programı, Takvim ve planlar, Müfredat, Puan cetvelleri). Kullanıcının iki ana hususu (bilgi girişi, takibat) üstte; yılda birkaç kez yapılan tanımlar en altta "Yönetim"de. `ALIASES`: /kurum/raporlar → Analiz, öğretmen ayrıntısı → Öğretmenler.
- **Yeni sayfalar:** `/kurum/siniflar`, `/kurum/ogretmenler`, `/kurum/puan-cetvelleri` (eskiden sekmeydi). Eski adresler `redirect` ile yönlenir. Devam raporları (`/kurum/raporlar`) Analiz'in sekmesi (`app/kurum/analiz/tabs.ts`), rapor türü küçük düğmelerle.
- **Dersler sayfası** (`/kurum/dersler?sinif=`): Yönetim'de; sınıf düğmeleri (ders sayısıyla) + o sınıfın `CourseManager`'ı. Kullanıcı ders eklemeyi sınıf sayfasının içinde bulamadı; "+ Ders ekle" artık birincil düğme. Aramada ders sonucu buraya gider.
- **+ Ekle kaldırıldı** (kullanıcı kararı, 8 Kasım): sınıf / öğretmen / ders nadiren eklenir, en üstte düğmeyi hak etmiyor. "Kurum" grubu "Yönetim" adıyla menünün en altına taşındı. Kod geri gerekirse commit `2dc619c` (`app/kurum/_ui/QuickAdd.tsx`, `GET /api/kurum/secenekler`). Kalan kısayollar: `/kurum/odevler?yeni=1` (ödev formu açık), `/kurum/denemeler#yeni-deneme`.
- **Test notu:** başsız Chrome'da panoya yazma yok; kod `prompt` ile linki gösterir ve CDP betiği orada takılır (gerçek tarayıcıda sorun değil; telefonda http://IP ile girişte de prompt çıkar, mevcut "Kopyala" düğmesiyle aynı).
- **Arama** (`app/kurum/_ui/Search.tsx`; ⌘K / Ctrl+K, kenar çubuğunda "Ara…", telefonda büyüteç): öğrenci, sınıf, ders, öğretmen ve menü sayfaları. `GET /api/kurum/ara` dizini pencere ilk açıldığında bir kez çeker (152 öğrenci ≈ 15 KB; 1000 öğrenci ≈ 100 KB); arama istemcide: `fold` Türkçe harfleri eşler (SQLite `contains` Türkçe büyük/küçük harfi ayırmaz), her kelime ayrı aranır. Kısayolu yalnızca masaüstü örneği dinler. `ShellTools.tsx`: `SidebarTools` / `BarTools` (üç düzen kullanır).

## 4r. Yönetim düzenlemesi (8 Kasım 2026, aşama 0–1)

Kaynak: kullanıcının sıfırdan kurulum testi (`npm run dev:test`, boş `prisma/test.db`; senaryo `notes/test-senaryosu-sifirdan.md`). Plan, UX değerlendirmesi (U1–U14) ve kararlar: `notes/yonetim-duzenleme-plani.md`. Ürün haritası: **`KROKI.md`** (kayıt nerede oluşur / kullanılır, sayfa haritası, rol tablosu; ekran değişince aynı commit'te güncellenir).

- **Program çakışması** (`schedule/internal/clashes.ts`): `assertNoClash` create/update'te. Aynı ders iki kez ve aynı sınıf / aynı öğretmende kesişen iki GRUP dersi 409; ETÜT/ÖZEL işin içindeyse ya da iki sınıfın ortak öğrencisi varsa (`enrollment > classRosters`: ana sınıf + ek üye) uyarı → 409 + `{ confirm: true }`, istemci "Yine de kaydet" ile `confirm: true` gönderir. Saatler "SS:DD" metin karşılaştırması; bitişik saat çakışmaz. `scheduleClashes` sayfa üstünde liste + derslerde kırmızı/sarı çerçeve.
- **`shared/errors`:** `AppError` isteğe bağlı `data` taşır, `api()` yanıta ekler; `needsConfirm(m)` kısayolu.
- **Etüt mesulünün branşı yok:** `parseTeacher` MENTOR'da branşı boş kaydeder, öğretmende zorunlu. Gösterim `teacherSub(t)` (schedule index): branş ya da "Etüt mesulü". Eski kayıtlarda branş dolu kalabilir; gösterilmez.
- **Öğrenci no:** `nextStudentNo` (en büyük sayısal + 1, ≤ 999999) formda hazır gelir; arka arkaya girişte sınıf korunur, numara ilerler. Excel'de Numara isteğe bağlı: boş satırlara kurumdaki **ve dosyadaki** en büyük numaradan sonrası verilir (`numbered`).
- **Sınıflar:** tablo (telefonda liste), ders sayısı sütunu; "+ Yeni sınıf" → `?yeni=1` → yan panel (`shared/ui/Drawer.tsx`; masaüstünde sağdan 420 px, telefonda tam ekran, Esc kapatır, ilk alana odak). "Kaydet ve yenisini ekle"; eklenen satır yeşil. Bu, aşama 4'teki ortak ekleme kalıbının ilk örneği.
- **Öğretmenler telefonda:** iki satırlık liste, link ve işlemler satırda (tablo `sm:` üstünde).
- **Ekran görüntüsü notu:** REA tarayıcı senaryosu girdilere `caret-color` stili ekliyor; Next geliştirici göstergesindeki "1 Issue" (hydration) ondan, uygulamadan değil.
- **Doğrulama:** kopya / öğretmen çakışması 409, ortak öğrenci uyarısı 409+confirm → onaylı 200, bitişik saat 200, düzenlemede kendisi hariç; etüt mesulü branşsız 200, öğretmen branşsız 400; sıradaki no formda; Excel numarasız 3 satır → 2 otomatik numara. `tsc`, `eslint src` temiz. Denemeler test.db'nin kopyasında yapıldı.

**Aşama 2 (ders tek yerde):**
- **Ders yalnızca Dersler'de açılır** (`schedule/ui/CourseAdmin.tsx`, `app/kurum/dersler`): bütün dersler tek tablo, `?sinif=` süzgeç, `?yeni=1` ekleme paneli (çoklu sınıf → sınıf başına bir POST; ad önerisi kurumdaki adlar; tür `guessCourseKind` ile, elle değişince durur), `?ders=<id>` düzenleme paneli (silme dahil). Bileşen `key={sinif|ders}` ile yeniden kurulur (panel durumu adresten). `CourseManager.tsx` silindi.
- **Sınıf sayfası:** dersler salt okunur (`CourseList`, sayfa içinde); 30 günden yeni ders (`CourseRow.createdAt`) değerlendirmesizse gri not.
- **Program / ek ders:** `parseSlot` artık dersi çözer: `courseId` (ya da eski istemci için var olan ad) → `SlotInput.courseId` + `subject` = ders adı; ders yoksa 400. `createSlot`/`updateSlot` `courseIdFor` çağırmaz. Ek ders (`attendance.ts`) aynı kontrolden geçer, oturuma yalnızca ad yazılır. `ScheduleBoard` ders listesi (`courses` prop), öğretmen ve tür dersten (STUDY → ETUT); öğretmen görünümünde öğretmen sabit kalır. Gün düğmesi "+ Saat ekle".
- **Ödev / yıllık plan:** `HomeworkForm` ve `PlanEditor` serbest metin yerine sınıfın derslerinden `select` (eski kaydın adı listede yoksa seçenek olarak eklenir). `planEditorData.subjectsByClass` program satırlarından değil derslerden. Ödev düzenleme sayfası seçenekleri ödevin sınıfının derslerinden alır (`homeworkSubjects` kaldırıldı). Eskiden düzenleme formunda "Değişiklikleri kaydet" `!classrooms.length` yüzünden pasifti; düzeldi.
- **Arama:** ders sonucu `/kurum/dersler?sinif=…&ders=…` (düzenleme paneli).
- **Doğrulama:** olmayan ad 400 ve ders açılmadı; `courseId` ile 200 (satır derse bağlı); başka sınıfın dersi 400; ek ders olmayan ad 400 / `courseId` 200; sayfalar 200; panel ve formlar ekran görüntüsüyle kontrol edildi. `tsc`, `eslint src` temiz.

**Aşama 3 (müfredat):**
- Müfredat ders açmaz: yeni sette ders `select` (kurumdaki ders adları, `listCourses`), düzey `select` (`curriculum > curriculumGradeOptions`: sınıf düzeyleri `normGrade`'li + 8 → LGS, 11/12 → TYT/AYT + var olan setlerin düzeyleri; düzey yoksa `CURRICULUM_GRADES`). Sıralama `gradeSortKey` (sayı < sınav < kuruma özgü), `curriculumSets` de bunu kullanır. Düğme "+ Müfredat ekle".
- Set görünümünde "Kullanan sınıflar" = `gradeScope(grade).levels` içinde düzeyi olan ve `subjectMatches` ile adı tutan dersi olan sınıflar; yoksa sarı uyarı (ad mı düzey mi). Plan bağlantısı `sinif` ile ilk kullanan sınıfı seçer.
- Excel önizlemesi kurumda olmayan ders adı / düzeyi uyarır (engellemez). Sunucu (`saveCurriculumSet`, `importCurriculum`) serbest kaldı: haftalık plan içe aktarmadaki gibi uyarı istemcide.
- **Doğrulama:** Seviye-2 seçeneği geldi; "Tecvid · Seviye-2" seti "Kullanan sınıflar: S-2" gösterdi, plan ekranı şablonu S-2'ye önerdi; örnek 8. sınıf seti uyarı verdi. `tsc`, `eslint src` temiz.

**Aşama 4 (ortak ekleme kalıbı, kurulum rehberi):**
- **Kalıp:** başlıkta "+ … ekle" bağlantısı `?yeni=1` → istemci bileşeni `Drawer` açar; kapatınca `router.replace` ile parametre kalkar. Panellerde gizli submit yok: `Drawer > enterSubmits(fn)` form `onKeyDown`'da Enter'ı yakalar (textarea / select / button hariç). Sınıflar, Dersler, Öğrenciler (`enrollment/ui/StudentAdd.tsx`), Öğretmenler (`TeacherManager` `open` prop) bu kalıpta.
- **Öğrenciler:** sekmeler kalktı (`?tab=yeni|ice-aktar` yönlenir). `StudentForm.tsx` → `StudentFields` (ortak alanlar) + `StudentForm` (yalnızca profil düzenleme) + `EMPTY_STUDENT`. Panel kapanınca eklenenler `?eklendi=id,…` (en çok 50) ile sunucu listesinde yeşil. Excel `?yukle=1` ile listenin üstünde (önizleme tablosu geniş). `ImportStudents` `classNames` alır; sunucudaki `normClassName` gibi büyük harfe çevirip olmayan sınıfları "Yeni sınıf açılacak" diye listeler.
- **Kurulum rehberi:** `reporting > setupSteps` (6 sayım) → Özet'te `SetupGuide`; hepsi > 0 ise görünmez; "Sıradaki" ilk boş adım.
- **Kenar çubuğu:** `KurumShell` py-3 / gap-3, alt bilgi tek satır ("… · Çıkış"), `KurumNav` grup aralığı 2, madde `py-[2px]`. 1280×800'de bütün maddeler görünüyor (ekran görüntüsüyle).
- **Doğrulama:** panelde Enter → kaydedip açık kaldı (no 4 → 5), Kaydet → `?eklendi=` iki satır yeşil; Excel "9a" ve "11-A" için uyarı; öğretmen panelinde etüt mesulü seçince branş gizlendi; eski `?tab=yeni` 307. `tsc`, `eslint src` temiz.

**Aşama 5 (Personel):**
- **`/kurum/personel`** (eski `/kurum/ogretmenler` → yönlendirme; menüde "Personel", Öğrenciler'in hemen altında). Sekmeler `?rol=` boş (Öğretmenler) / `mesul` / `yonetici`. Bileşen `schedule/ui/PersonnelManager.tsx` (`TeacherManager` silindi): sekmenin rolüne göre liste ve form; ekleme `?yeni=1`, düzenleme yerel durumla yan panelde (rol, branş / sınıflar, silme).
- **Etüt mesulünün sınıfları:** `enrollment > setMentorClasses(ownerId, mentorId, ids)` (verilenleri atar, kalanları bırakır; tek işlem) + `PUT /api/kurum/ogretmenler/[id]/siniflar` (kişi MENTOR değilse 400). `PUT /api/kurum/ogretmenler/[id]` rol öğretmene dönünce `setMentorClasses(..., [])`. Yeni mesul: önce POST, sonra sınıflar PUT (istemci).
- **Yönetici sekmesi** `getUser()` ile kurum hesabını gösterir; çoklu yönetici ve personel telefonu sonraya (veri modeli değişikliği).
- Bağlantılar güncellendi: kurulum rehberi adımı "Personel", ders programı boş durumu, öğretmen ayrıntısının geri bağlantısı (rolüne göre sekme), aramadaki grup adı, sınıf sayfasındaki "etüt mesulü yok" notu (→ `?rol=mesul&yeni=1`).
- **Doğrulama:** mesul + 2 sınıf → ikisi ona geçti; tek sınıfa indirince öbürü boşaldı; öğretmene çevirince sınıfları boşaldı; öğretmene sınıf 400; olmayan sınıf 400; sayfalar 200, eski adres 307. `tsc`, `eslint src` temiz.
- **Çok günlü program:** "+ Saat ekle" penceresinde günler çoklu (`DAYS_SHORT` çipleri, `Draft.days`); düzenlemede tek gün. `createSlots` (eski `createSlot`) `dayOfWeeks[]` alır, her gün `parseSlot` + birlikte `assertNoClash(list)`; kesin çakışma herhangi bir günde varsa hiçbiri yazılmaz, kayıt tek işlemde. `POST /api/kurum/program` `{ id, ids }` döner; `dayOfWeek` tek değer de kabul edilir.
- **Seri düzenleme:** düzenleme penceresinde de gün çipleri; açılan satırın serisi (aynı sınıf, ders, öğretmen, tür, saat; `slotSeries` / istemcide `sameSeries`) seçili gelir. `updateSlot` `dayOfWeeks[]` ile seriyi tek işlemde yeniden yazar: seçili günde satır varsa günceller, yoksa çıkarılan günlerin satırını yeniden kullanır (yoklama bağı korunur) ya da açar; artanları siler. Çakışma denetimi serinin bütün satırlarını hariç tutar (`assertNoClash` `excludeIds`). "Sil" yalnızca açılan günü siler. `dayOfWeeks` gönderilmezse eski tek satır güncellemesi.
- **Sorumlunun rolü:** `CourseRow.teacherRole`; `staffLabel(name, role)` (schedule index) etüt mesulüne "(Etüt mesulü)" ekler. Dersler tablosu / telefon listesi, sorumlu seçimi, sınıf sayfasındaki ders listesi ve aramadaki ders sonucu bunu kullanır (aynı adlı öğretmen ve mesul ayırt edilir). Ders programı penceresindeki öğretmen listesi `teacherSub` ile zaten "(Etüt mesulü)" / "(branş)" gösteriyor.

## 4s. Müfredat ↔ yıllık plan bağı ve konu takibi (8 Kasım 2026)

- **Sorun:** Plan konuları müfredattan metin olarak kopyalanıyor, takip ad benzerliğiyle yapılıyordu (`topicMatches`, 3 harften kısa sözcükleri ve sayıları atıyordu: Seviye-2 Kuranı Kerim'de 93 konudan 81'i birbirine karışıyordu). Plan düzenlenince bütün satırlar silinip yeniden açıldığından konuya bağlı değerlendirmelerin `planItemId` bağı kopuyordu. Seviye-2 Kuranı Kerim müfredatı üç ünitesi (Kur'ân · Tecvid · Ezber) aynı haftalarda işlendiği için tek plana sığmıyor (135 hafta art arda).
- **Veri:** `PlanItem.unit`, `PlanItem.curriculumTopicId` (→ `CurriculumTopic`, SetNull). Bağımlılık: `planning → curriculum` eklendi (`eslint.config.mjs > MODULES`).
- **Plan metni:** `# Ünite` başlığı (`parsePlan`); `planSourceOf` ünite başlıklarını yazar. Üniteler art arda işlenir. Paralel ünite seçeneği (`LessonPlan.parallel`) denendi, kullanıcı isteğiyle kaldırıldı ("şimdilik basit olsun"); paralel işlenen içerik için ya ayrı ders ya da haftalık birleşik konu.
- **Bağ:** `linkSlots` (lessonPlans) sınıfın düzeyine uyan müfredat setinde ünite + konu adı (`curriculum > topicKey`: küçük harf, şapkasız), olmazsa yalnızca konu adı; her müfredat konusu bir satıra. `updatePlan` satırları yerinde günceller (önce müfredat kimliği, sonra ünite + ad, sonra ad); `relinkPlans` müfredat kaydı / içe aktarma / örnek yükleme sonrası (API route'larından) çağrılır. `writeSets` kimlikleri korur (ünite + konu anahtarıyla update / create / delete).
- **Eşleştirme:** `topicMatches` sayıları ayırt edici sayar (deneme ve soru havuzu ad eşleşmesi için).
- **Takip:** `reporting > planTopicTracking(planId)` (durum, yoklama oturumu, `Assessment.planItemId` değerlendirmeleri, `examPlanCoverage` ile deneme başarısı) → plan sayfası "Konu takibi" (`reporting/ui/TopicTracking.tsx`, `PlanItems.tsx` silindi). `curriculumTracking`: bağlı planlarda kimlikle, bağsız (eski) planlarda adla; `plan.late`, `assess`, `classPlans`. Müfredat → Takip: sınıf tablosu, geciken konu, değerlendirme sütunu; deneme türü olmayan düzeyde deneme sütunu gizli.
- **Yoklama:** `topicsForLesson` hafta sırasıyla, satırda ünite adı.
- **Doğrulama (test.db kopyası):** S-2 Kuranı Kerim planı → 105/105 bağlı; müfredat aynı dosyayla yeniden yüklenince 186 konudan yalnızca adı değişen 1'inin kimliği değişti; plan düzenlenince işaretler korundu; bağlı sözlü değerlendirme iki takip ekranında göründü. `tsc`, `eslint src` temiz.
- **Tuzak:** ikinci `next dev` aynı `.next` klasörünü kullanırsa çalışan sunucunun derlemesi bozulur (ENOENT `.next/server/...page.js`, ChunkLoadError). `next.config.ts` `distDir: NEXT_DIST_DIR`; test sunucusu `NEXT_DIST_DIR=.next-test` ile başlatılır.

## 5. Özellik durumu

### Aşama 1 — Online test (`/panel`, `/sinav/[id]`, `/s/[code]`) — **kaldırıldı (2026-11-10)**
Tek sınav yapısı `Exam` olsun diye `online-test` modülü ve Test/Question/Option/Attempt/Answer tabloları silindi. Optik form kütüphanesi (`shared/omr`) denemelerde kullanılmaya devam ediyor.
- [x] Soru tipleri: tek/çok cevap, doğru/yanlış, kısa cevap.
- [x] Süre sınırı, karıştırma, geçme notu, taslak/yayın.
- [x] Kod/link ile paylaşım, sonuç sayfası, cevap anahtarı ve açıklama.
- [x] Sonuç raporları: KPI, dağılım, soru bazlı başarı, CSV indirme.
- [x] Optik form yazdırma, tarama, düzeltme ve kaydetme.

### Aşama 2 — Kurum paneli (`/kurum`)
- [x] **Özet:** bugünün dersleri ve yoklama durumu, son denemeler, devamsızlığı yüksek öğrenciler, yaklaşan ödevler.
- [x] **Kayıt:** öğrenci ekleme ve düzenleme, sınıflar, STS, Excel/CSV/yapıştır ile toplu yükleme (önizleme ve doğrulama), öğrenci profili (tüm sınavlar, birleştirilmiş ortalama, net trendi, ödev ve devam özeti).
- [x] **Denemeler:** LGS/TYT/AYT/serbest, A/B anahtar editörü (rastgele doldur, "A'dan karıştır"), sınava özel optik form, görüntüden tarama (numara ile eşleştirme), TXT içe aktarma.
- [x] **Raporlar:** sıralı liste (genel ve sınıf sırası), öğrenci karnesi ve hata karnesi, toplu karne yazdırma, soru frekans analizi (kitapçık bazında), sınıf ortalamaları.
- [x] **Ödev takip:** liste, KPI, filtre; durum işaretleme (anında kaydedilir); öğrenci bazında rapor. (Yardımcı agent yazdı.)
- [x] **Ders programı ve yoklama:** haftalık program (sınıf ve öğretmen görünümü), öğretmenler, günlük yoklama, ek ders/etüt; dört devam raporu. (Yardımcı agent yazdı.)
- [x] **Veli karnesi** (`/kurum/veli-karnesi`, öğrenci profilinde kart, herkese açık `/veli/[token]`) — bkz. bölüm 4b.

### Yapılmayanlar / sonraki adımlar
- [ ] **Resmi puan yok:** Tahmini puan var (bkz. 4c); resmi LGS/YKS puanı ve Türkiye geneli yüzdelik dilim yok (yalnızca kurum içi).
- [ ] **Kurum karşılaştırma:** Kurumlar arası karşılaştırma ve çoklu şube yok.
- [ ] **Ödev raporu:** Sınıf ve ders bazında ödev raporu yok (öğrenci bazında var).
- [ ] **Diğer modüller:** Muhasebe, mobil uygulama, veliye otomatik SMS/e-posta (şu an WhatsApp linki ve kopyalama var; haftalık rapor kaydı SMS için hazır), ödeme/paket satışı yok.
- [ ] **Excel biçimi:** Eski `.xls` desteklenmiyor; `.xlsx` veya CSV gerekiyor.
- [ ] **OMR iyileştirmeleri:** Form yön işareti eklenmeli, gerçek taramalarla test edilmeli.
- [ ] **Otomatik test yok:** Projede birim/e2e testi yok. Doğrulamalar elle, curl ile ve REA tarayıcı senaryolarıyla yapıldı.
- [ ] **Yetki modeli yok:** Rol ayrımı (öğretmen/yönetici) bulunmuyor; tek hesap = tüm kurum.

---

## 6. Doğrulama kaydı (4 Kasım 2026)

- `tsc --noEmit`, `eslint` ve `next build` hatasız geçti.
- Tüm `/kurum/*` sayfaları 200 döndü; girişsiz istek `/giris`'e yönlendirildi.
- **API testleri:**
  - Öğrenci: aynı numara 409; 6 haneden uzun numara 400.
  - Toplu yükleme: güncelleme, sınıf oluşturma ve hatalı satır raporu çalıştı.
  - Cevap anahtarı: geçersiz şık (LGS'de E) 400 döndü.
  - TXT/OMR kaydı: eşleşmeyen numara atlandı.
  - Net değerleri elle kontrol edildi (ör. 12D 7Y 1B → 9,67); anahtar değişikliği sonrası yeniden puanlama doğru çıktı.
- **İzolasyon:** İkinci bir kurum hesabı, demo kurumun deneme, öğrenci ve ödevlerine erişemedi ve değiştiremedi (404).
- **Tarayıcı:** Chrome'da (REA senaryosu) demo girişi → LGS denemesi → 5 örnek form üret → oku → kaydet akışı sayfa hatası olmadan tamamlandı. Özet ve karne ekranları görsel olarak kontrol edildi.

---

## 7. Çalışma notları ve tuzaklar

- **Next 15:** `params` ve `searchParams` Promise; `await` edilmeleri gerekir.
- **Tailwind v4:** Özel sınıflar `globals.css`'te (`btn`, `btn-primary`, `card`, `input`, `badge`…). `btn` bir `@utility`; diğerleri onu `@apply` ile kullanıyor.
- **Yazdırma:** `no-print` sınıfı yazdırmada gizlenir. Kurum düzeni yazdırırken `print:block` olur; karneler `break-after-page` ile ayrı sayfalara düşer.
- **Takılı süreçler:** `next start` kapatılırken alt süreç `next-server` açık kalabiliyor ve portu tutuyor. Gerekirse `pkill -f next-server` kullanın.
- **Seed ID'leri:** Seed her çalıştığında kurum kayıtlarının ID'leri değişir. ID'leri sabit kodlamayın, veritabanından sorgulayın.
- **Demo hesabı ve soru havuzu:** Seed demo hesabını silmez, e-postayla bulup günceller (upsert); hesap kimliği sabit kalır. Soru havuzu (QuestionSource / QuestionItem ve `storage/<ownerId>/`) seed'e dahil değildir ve korunur. Eskiden seed bütün kullanıcıları silip demo hesabını yeniden oluşturuyordu; elle yüklenen havuz soruları eski kimliğe bağlı kalıp görünmez oluyordu (5 Kasım 2026'da düzeltildi, kopan 10 soru geri bağlandı). Seed kurum tablolarını (öğrenci, deneme, ödev…) hâlâ tamamen sıfırlar.
- **Tarih işleme:** Yerel tarih için `shared/date.ts > ymd()` kullanılmalı. Ders oturumu tarihleri string olarak tutulur.

### Soru havuzu — soru türleri ve soru yazma (2026-11-10)
- **Türler** (`QuestionItem.type`, tanımlar `question-bank/written.ts`): MC çoktan seçmeli, TF doğru/yanlış, FILL boşluk doldurma, OPEN açık uçlu. Kesilmiş sorular MC'dir; içerikleri görseldedir (`content` boş).
- **Yazılan soru:** `content` = JSON `{ stem, options? }`, `text` = arama için düz metin, `imageKey` isteğe bağlı şekil (boş olabilir). Cevap biçimi türe göre: MC harf, TF "D"/"Y", FILL boşluk cevapları " | " ile, OPEN örnek cevap (isteğe bağlı; "cevabı girilmemiş" sayısına girmez).
- **Giriş yolları** (`/kurum/soru-havuzu/yaz`, `ui/QuestionWriter.tsx`): tek tek yaz (tür seç, Enter ile sonraki şık, harfe tıklayıp doğru şık, Ctrl+V ile ekran görüntüsü, “+ Boşluk ekle”, canlı kâğıt önizlemesi, Ctrl+Enter kaydet ve yenisi) ve yapıştır ve böl (`paste.ts > splitPasted`: numara, A) şıklar yan yana / alt alta, *C, “Cevap:”, sondaki “Cevap anahtarı: 1-C…”, “( )” → D/Y, ___ → boşluk; yapay zekâ yok). Ders, düzey, konu, zorluk, bilişsel düzey ve şık sayısı tarayıcıda hatırlanır.
- **Yazı yönü:** `textDir` satır satır harf çoğunluğuna bakar (Arapça ağırlıklı satır sağdan sola). Tarayıcının `dir="auto"`su ilk harfe baktığı için Türkçe ağırlıklı satırları yanlış yaslıyordu.
- **Sınava giriş:** optikle okunan türler (MC, TF) sınava/denemeye girer; TF optikte A = Doğru, B = Yanlış. FILL ve OPEN yalnızca çalışma kağıdında (havuzdan kurma ekranında sınav seçiliyken gizlenir; sunucu da reddeder). Türün şık sayısını aşan MC (ör. LGS'de 5 şık) reddedilir. Karma sınav (optik + klasik) şimdilik istenmedi.
- **Toplu cevap** (`updateItems`): yalnızca MC/TF'ye ve türüne uyan değerle yazılır; FILL/OPEN cevabı yazma ekranında düzenlenir.
- **Kitapçık:** yazılan sorular metin olarak basılır (açık uçluya cevap boşluğu); çalışma kağıdının anahtar sayfası sorunun kendi cevabını gösterir.
- **Online test (Test…) kaldırıldı;** tek sınav yapısı `Exam`.

### Soru havuzu — kullanım geçmişi ve sonuçlardan ölçülen bilgiler (2026-11-10)
- **Saklanmaz, hesaplanır:** `exams/internal/for-bank.ts > bankUsage`. Sorunun girdiği sınav ve çalışma kağıtları `Exam.sections[].items`'tan; silinen deneme sayılmaz. Eski `QuestionItem.usedCount` sayacı (deneme silinince azalmıyordu) şemadan kaldırıldı.
- **Gören sınıf:** derse bağlı sınavda dersin sınıfı + sonucu okunan öğrencilerin ana sınıfı (`enrollment > studentHomeClassrooms`). Derse bağlanmamış çalışma kağıdının kime dağıtıldığı bilinmez, sınıf eklemez.
- **Ölçülen:** sonucu olan sınavlarda `itemAnalysis`'ten öğrenci sayısıyla ağırlıklı doğru oranı; ölçülen zorluk (%70+ kolay, %40–69 orta, altı zor) ancak 20 öğrenciden (ITEM_RULES.minN) sonra. Uyarı sonucu olan en son sınavdan; "anahtar hatası" her durumda, ayırt edicilik uyarıları 20 öğrenciden sonra. Girilen zorluk kendiliğinden değişmez; panelde "Zorluğu … yap" düğmesi.
- **Havuz:** kartta tek satır (kaç sınav / çalışma kağıdı, son kullanım, %doğru, uyarı ya da ölçülen zorluk farkı, gören sınıflar); tıklayınca yan panelde her kullanım. Süzgeçler: hiç kullanılmamış, en çok kullanılan (sıralı), sorunlu, "X sınıfı görmedi". Özet sayılarda "Hiç kullanılmamış".
- **Havuzdan sınav:** ders seçilince o sınıfın gördüğü sorular varsayılan olarak gizlenir ("8-A görmedi (9 gizli)"); kutu kaldırılırsa kartta "8-A gördü".
- "Boyut" (kâğıtta kapladığı yer) kullanıcı kararıyla istenmedi.

### Soru havuzu — kazanım bağı ve arşiv (2026-11-10)
- **Kazanım:** `QuestionItem.curriculumTopicId` müfredat satırına (konu + kod + kazanım) bağlar; ilişki kurulmaz (curriculum'un tablosu). Bağ ders + düzey + konu adından kendiliğinden kurulur (`curriculum > matchOutcome`; ad karşılaştırması `topicKey`; düzey boşsa yalnızca tek düzeyde geçen konu). Kaydederken, toplu etiket değişince ve havuz açılırken (`linkOutcomes`, müfredat sonradan yüklenir / satır silinirse) yenilenir. Bağlanınca konu adı müfredattaki yazılışa çekilir. Hoca için ek alan yok: yazma ekranında konunun altında "Kazanım: 10.1.1 …" ya da "müfredatta yok" görünür. Kartta kod + kazanım satırı; "Eksik bilgi → Kazanımı bağlı değil" süzgeci. question-bank artık curriculum'a bağımlı (eslint MODULES).
- **Arşiv:** `QuestionItem.archivedAt`. Arşivdeki soru havuz listesinde, özet sayılarda ve havuzdan sınav ekranında görünmez; sunucu da yeni sınava almaz; eski kitapçıklarda yerinde kalır. Toplu "Arşive kaldır" / "Arşivden çıkar", yan panelde düğme, "Durum: Arşiv (N)" süzgeci. Silme onayı kullanılmış soruları sayar ve arşivi önerir.

### Kitapçık — optik formu arkaya ekleme (2026-11-10)
- Kitapçık sayfasında "Optik formu arkaya ekle" (`?optik=1`, çalışma kağıdında yok): tek yazdırmada sorular + optik form. Sıra: sorular → optik form → (açıksa) cevap anahtarı.
- Form okunabilsin diye kendi sayfası kenar boşluksuz basılır: CSS adlandırılmış sayfa (`@page omr { margin: 0 }`, `.omr-sheet { page: omr }`); soru sayfaları 12 mm kenar boşluğunu korur. `print-page` sınıfı kullanılmaz (yazdırmada `position: fixed`, her sayfada tekrarlanırdı). Basılan form ayrı "Optik formu yazdır" sayfasıyla aynı ölçüde (210×297 mm, aynı viewBox; PDF'le karşılaştırıldı).

### Soru havuzu — yazılış birleştirme ve Türkçe arama (2026-11-10)
- **Ders adı** kayıtta tek yazılışa çekilir: Dersler (`schedule > listCourses`) → müfredat → havuzda en sık kullanılan ("ilmihal", "İLMİHAL" → "İlmihal"). Karşılaştırma `curriculum > subjectKey` (büyük/küçük harf, şapka, kesme işareti, boşluk önemsiz). Öneri listeleri de aynı kuralla birleşir (`mergeSubjectNames`), Dersler'deki adlar önce gelir; düzey listesine sınıf düzeyleri (Seviye-2) eklendi. Önceden öneriler Dersler'e bakmıyordu (İlmihal listede çıkmıyordu).
- **Konu:** müfredata bağlanırsa müfredattaki yazılış; bağlanmazsa aynı derste havuzda en sık kullanılan yazılış (eşitlikte büyük harfle başlayan).
- **Arama:** `QuestionItem.searchText` = `searchKey(ders + konu + metin)`: Türkçe küçük harf, şapkasız, kesme işaretsiz, ı = i. SQLite LIKE Türkçe harflerde büyük/küçük harf ayırdığı için arama bu alanda yapılır.
- **`tidyBank`** (havuz açılırken; eski `linkOutcomes`'un yerine): yazılışları birleştirir, kazanım bağını ve arama anahtarını yeniler; yalnızca değişen soruları yazar. question-bank artık schedule'a da bağımlı.
- **Havuzdan sınav:** oluşturulduktan sonra "Sınav oluşturuldu; kitapçık açılıyor…" ve "Kitapçığı aç" bağlantısı (yönlendirme gecikirse düğme sessizce "Oluşturuluyor…" kalıyordu).

### Optik form üst kısmı ve kitapçık düzeni (2026-11-10)
- **Form bilgi alanı** (`shared/omr/layout.ts > buildForm`, ikinci tasarım): resmî form dili; solda gri etiket hücresi, sağda yazma alanı. Öğrenci bilgileri üç sıra (Ad Soyad · Sınıf / Şube · İmza; kişiselde Ad Soyad · Sınıf / Numara · İmza; tarih yok), işaretleme örneği şeridi (doğru: tam dolu; yanlış: tik, çarpı, nokta; bilgi alanıyla kitapçık şeridi arasında ortalanır), kitapçık türü şeridi; öğrenci numarası / kişisel QR kutusunda aynı gri başlık bandı. Yalnızca okuyucunun bakmadığı alanlar değişti; baloncukların yeri (`computeLayout`) aynı, eski basılı formlar da okunur. Doğrulama: tarayıcıda 24 örnek form (genel + kişisel, 4/5 şık, 0/90/180/270°) üretilip okutuldu, 24/24 cevap, numara ve kitapçık doğru (betik: esbuild ile omr modülleri paketlenip Playwright'ta çalıştırıldı).
- **Kitapçık başlığında tarih yok** (tür · soru sayısı).
- **Kitapçık:** "Kaynak numaralarını ört" seçeneği kaldırıldı (11-10). İki sütunda şıklar daha erken ikili / alt alta dizilir (`QuestionView narrow`), sözcük ortadan bölünmez.

### Optik form sürüm 2 — kompakt düzen (2026-11-10)
- **Neden:** az bilgi alan form sayfanın üst yarısını kaplıyordu; cevap alanını yukarı almak baloncukların yerini değiştirir. Eski basılı formlar bozulmasın diye düzen sürümlendi (`layout.ts > FORM_VERSION = 2`, `FormSpec.version`).
- **Sürüm işareti:** sürüm 2 formlarda sol kenarda (14, 67) küçük dolu kare (`VERSION_MARK`; önce 14, 40'taydı, "Ad Soyad" yanında işaretleme kutusu gibi göründüğü için indirildi — o konumda basılmış form yoktu). Okuyucu (`scanForm(img, layoutFor)`) köşe ve yönü bulduktan sonra bu noktaya bakar: doluysa sürüm 2, değilse sürüm 1 düzeniyle okur; `ScanResult.version` döner. `OmrScanner` `layoutFor = (v) => computeLayout({ ...spec, version: v })` verir. Tek `Layout` verilirse işarete bakılmaz.
- **Sürüm 2 düzeni:** bilgiler kutusuz tek satır (Ad Soyad · Sınıf / Şube · İmza, alt çizgili); öğrenci numarası solda yatay ızgara (her satır bir hane, 0–9); sağında kitapçık türü ve küçük işaretleme örneği; kişisel formda numara basılı kutuda (kodlanmaz, kimlik şeridinden okunur) ve en sağda QR; cevaplar 98 mm'den (sürüm 1'de 128). Sürüm 1 çizimi (`headerV1`) eski formları yeniden üretmek / sınamak için duruyor.
- **Doğrulama:** tarayıcıda (esbuild + Playwright) her sürümde 30 örnek form (genel + kişisel, 4/5 şık, 0/90/180/270°) üretilip `layoutFor` ile okutuldu: sürüm 2 30/30, sürüm 1 30/30; sürüm her seferinde doğru tanındı.

### Optik form — öğrenci numarası alanı seçimi (2026-11-10)
- **Ayar:** `Exam.omrStudentNo` (varsayılan true). Optik okuma sekmesi, optik form sayfası ve kitapçık ("Optik formu arkaya ekle" açıkken) "Öğrenci numarası alanı: Var / Yok" (`exams/ui/FormStudentNo.tsx`, `PUT /api/kurum/denemeler/[id]/form-ayar`). `examFormSpec(..., { studentNumber })` → `FormSpec.studentNumber: false`.
- **Numarasız form:** numara ızgarası basılmaz; sol blokta büyük işaretleme örneği. Kitapçık baloncukları ve cevap alanı yerinde kalır (ayar sonradan değişse de okuma bozulmaz). Kişisel formda numara her durumda kimlik şeridinden okunur.
- **Okuyucu:** her form kartında "Öğrenci" seçim listesi (kayıtlı öğrenciler, ada göre); numara okunduysa eşleşen öğrenci seçili gelir, numarasız formda ya da yanlış okumada listeden seçilir. Örnek formlarda numarasız ayarda öğrenci önceden seçilir.
- **Doğrulama:** sürüm 1 / 2 × numaralı / numarasız, her biri 30 örnek form: 120/120 doğru. Uygulamada ayar düğmesi, örnek form + öğrenci listesi ve kitapçıktaki düğme denendi.
- **İşaretleme örneği kaldırıldı** (kullanıcı isteği, sürüm 2): ne büyük kutu (numarasız form) ne küçük satır; nasıl işaretleneceği alt kenardaki notta. Numarasız formda numara bloğunun yeri boş kalır (baloncuk yerleri sabit olduğu için cevap alanı yukarı alınmadı).


### Soru havuzu — çözüm ve kaynak notu; tek giriş yolu (2026-11-11)
- **Sekme kaldırıldı:** "Sorular / Kaynaklar ve kesme" sekmeleri ile üstteki "Kaynaktan soru kes" düğmesi aynı sayfaya gidiyordu. Sekmeler (`ui/tabs.ts`) silindi; `/kurum/soru-havuzu/kaynaklar` artık "Kaynaktan soru kes" başlıklı alt sayfa (geri: Soru havuzu), "Soru yaz" ile aynı düzen.
- **Yeni alanlar** (`QuestionItem`): `explanation` (çözüm / açıklama, ≤ 4000, satır sonları korunur) ve `sourceNote` (kaynak notu, ≤ 200, boşluklar tekleşir). Her iki türde (kesilmiş ve yazılan) var. `sourceNote` arama anahtarına girer (`searchOf(c, text, sourceNote)`), çözüm girmez.
- **Giriş:** yazma ekranında ortak çubukta "Kaynak" (hatırlanır, her soruya yazılır) ve soru başına "Çözüm / açıklama". Yapıştır ve böl: `Çözüm:` / `Açıklama:` satırından sorunun sonuna kadar çözüm (`DraftQuestion.explanation`). Kesme ekranında "Kaynak notu" (sayfa numarası eklenir: "X Yayınları, s. 12"). Havuzda yan panel ("Soru ayrıntısı") çözüm ve kaynak notunu her soru için düzenler (`PATCH sorular` → `cleanPatch`).
- **Gösterim:** kartın altında kaynak notu (yoksa kesilmişte dosya adı + sayfa) ve "Çözümlü" rozeti (paneli açar). "Eksik bilgi → Çözümü yazılmamış" süzgeci (`missing: "cozum"`).
- **Kitapçık:** çözümlü soru varsa "Çözümler" düğmesi (`?cozum=1`): cevap anahtarından sonra, kitapçık numarasıyla yalnızca çözümlü sorular; optik form ekliyse formdan sonraki sayfada.
- **Doğrulama:** ayrı test sunucusu (3123, `.next-test`, dev.db kopyası): yazılan soru çözüm + kaynakla kaydedildi, kesilmiş soruya PATCH ile yazıldı, "palme" araması buldu, süzgeç ve sayfalar 200, kitapçıkta çözüm (optikli / optiksiz) basıldı. Ayrıştırıcı örnek metinde 2. sorunun çözümünü ve çok satırlı çözümü doğru ayırdı. Yan panel tarayıcıda denenmedi. `tsc`, `lint` temiz. `prisma db push` dev.db ve test.db'ye uygulandı (yalnızca sütun ekleme).
- **Yapay zekâ konuşması (11-11, karar bekliyor):** önerilen sıra: (1) kesmede yapay zekâyla bulma (kutu + metin + şık + cevap), (2) yapıştır-böl yedeği, (3) konu/kazanım (yalnızca müfredat listesinden), bilişsel düzey ve zorluk önerisi, (4) cevap önerisi / anahtar kontrolü, (5) Arapça/Osmanlıca okuma, (6) soru üretme (sonra). İlkeler: onaysız havuza girmez (`origin: AI`), öğrenci verisi gönderilmez, kurum bazında aç/kapa + aylık sınır + kayıt; çağrı sunucuda `@anthropic-ai/sdk`. Yeni `explanation` alanı yapay zekânın çözüm önerisi için de hedef. Kullanıcıdan beklenen kararlar: ilk adım, API anahtarı (tek mi kurum başına mı), kitap sayfalarını API'ye gönderme (telif), model (Opus 5.5 / karşılaştırma).
- **Soru havuzu MCP sunucusu (11-11, POC):** Kullanıcının o an kullandığı agent (Claude Code, Claude Desktop, Cursor…) havuza soru yazar. Soruyu agent'ın kendi modeli üretir; bizde API anahtarı ya da model çağrısı yok. Kod `src/mcp/server.ts` (stdio, yalnızca yerel), `npm run mcp`, Claude Code için `.mcp.json`. Araçlar (İngilizce adlar): `get_bank_context` (dersler, düzeyler, tür kuralları, müfredat konu/kazanımları), `search_questions` (onaylı sorularda arama), `add_questions` (`createWrittenItems(..., { origin: "AI" })`; hepsi kaydedilir ya da hiçbiri, hata "3. soru: …" diye agent'a döner). Yapay zekâ sorusu `needsReview = true` ile kaydedilir: havuz listesinde, özette ve sınav kurarken görünmez; havuzda "Durum > Onay bekleyen" süzgeci, uyarı satırı, karttaki ve toplu işlemdeki "Onayla" düğmesi (`QuestionPatch.approved`). Onaylanmamış soru sınava eklenemez (`bankItemsByIds > pending`). Kurum: `MCP_OWNER_EMAIL` ya da veritabanındaki tek hesap (`identity > resolveLocalOwner`). Tuzak: modüllerdeki `import "server-only"` Next dışında hata verir; `tsconfig.mcp.json` bunu boş dosyaya yönlendirir (`--conditions=react-server` React'i bozduğu için kullanılmadı). Lint'te `src/mcp/**` de `src/app` gibi ince katman sayılır. Sağlamlık (11-11 uç durum testi): yapay zekâ sorusunda MC/TF/FILL cevabı zorunlu (elle yazmada değil); "A) …" şık önekleri ve "9. sınıf" düzeyi MCP katmanında düzeltilir (`tidy`); kurum her çağrıda yeniden çözülür (seed sonrası kimlik değişir). `npm run mcp` proje klasöründen çalışmalı: Claude Desktop / Cursor ayarında `npm --prefix <proje yolu> run --silent mcp` kullanın. **Agent talimatları (11-11):** üç katman. (1) Sistem kuralları `src/mcp/guide.ts` (İngilizce; iş akışı, kendi kendini kontrol, yazım, yasaklar): sunucu talimatı (`instructions`, bağlanınca) ve `write_questions` tarifi (Claude Code'da `/mcp__rea-question-bank__write_questions`, kontrol listesinin tamamıyla). (2–3) Kurum kuralları `src/mcp/rules/institution.md` (şimdilik ders türüne göre genel; her çağrıda okunur, `get_bank_context > institutionRules`). Sunucuda zorunlu: yapay zekâ sorusunda `explanation`; yeni alan `agentNote` (agent'ın şüpheleri; onay bekleyen kartta ve soru ayrıntısında). Belirsizlikte agent yazar ve not düşer; uydurma alıntıda o soruyu yazmaz. Soruların dili kullanıcının istediği dil. **Çerçeve değişti (11-11):** agent'ın görevi kullanıcıya yardım; soruyu aktarma / uyarlama / yeni yazma kararı kullanıcı ile agent arasında, bizim talimatlarımız yalnızca soruların doğru girilmesi için. Yeni alan `basis` (transcribed | adapted | original; `BASIS`, kartta "YZ · Aktarıldı" rozeti); aktarılan soruda çözüm isteğe bağlı, cevap zorunlu. `add_questions` görsel alır (`image.path` ya da `image.base64`; sunucu depoya kopyalar, PNG/JPG/WEBP, 5 MB; SVG kabul edilmez). İkinci tarif `import_questions` (dosyadaki soruları olduğu gibi aktarma); `write_questions`a `source` (esinlenme). "Asla kopyalama" kuralı kalktı; yerine kaynak ve yer bilgisi (`sourceNote`) zorunlu tutuluyor (talimatla). Zorunlu bilgi: ders ve düzey her soruda zorunlu; eksikse agent sorar (talimat "What you need from the user": konu, sayı ve tür de yeni yazmada sorulur, hepsi tek mesajda, seçenekler get_bank_context'ten). Sunucu bilinmeyen ders / düzeyi reddeder ("Mathematics", "Grade 9"); kullanıcı yeni ders/düzey isterse agent onay alıp `confirmedNew: true` gönderir. Sonraki adım: uzaktan HTTP + anahtar.

### Soru havuzu — benzer soru (aynı / kardeş) (2026-11-17)
- **Hesap:** `question-bank/similarity.ts` (saf; `findSimilar`, `answerKey`, `SIMILARITY` eşikleri, `SIMILAR_KINDS` etiketleri). Ayrıntı ve ölçümler: `notes/soru-benzerligi.md` 9. bölüm. Veritabanında saklanmaz; her istekte dersin metinli soruları üzerinden hesaplanır (`internal/similar.ts`: `similarForItems`, `similarForItem`, `similarForDrafts`).
- **Yazma:** `createWrittenItems` elle yazmada "Aynı soru" bulursa `needsConfirm` (409); `yaz` route'u `confirm=1` ile `allowSimilar`. QuestionWriter'da `Message` bileşeni "Yine de kaydet / Vazgeç" (yapıştır-böl kaldığı gruptan devam eder). Yanıtta `ids` ve `similar` döner. Kayıt artık `createMany` değil, transaction içinde tek tek `create` (kimlikler için).
- **Havuz:** sayfa `similarForItems` ile kart rozeti ("Aynısı var" / "Kardeşi var (n)"); yan panelde `SimilarList` (`GET /api/kurum/soru-havuzu/sorular/[id]/benzer`).
- **MCP:** `search_questions` `similarTo` (stem, options, type, answer; subject zorunlu); `add_questions` yanıtında `similar`; talimat (`guide.ts > BEFORE`) similarTo'yu kullanmasını söylüyor.
- **Doğrulama:** test sunucusu (3123, `.next-test`, dev.db kopyası): kopya → 409, confirm → kaydedildi; şık karıştırılmış kopya → 409; olumsuz kök + farklı şıklar ve yeni soru → geçti; onay sayfasında rozetler; MCP similarTo ve aynı gönderimdeki iki eş soru birbirini buldu. Havuz sayfası ~0,2 s. Yan panel ve yazma ekranı uyarısı tarayıcıda denenmedi. `tsc` (iki tsconfig) ve `lint` temiz.
- **Ekran adı (11-17):** "Kardeş soru" → **"Benzer soru"** (rozet "Benzeri var"); kod `sibling` kaldı.
- **Deneme kurma (11-17):** `similarPairs(ownerId)` (havuzdan sayfası) → `BankExamBuilder similar`. Seçilen listede `ClashNote` ("Aynısı / Benzeri denemede: <bölüm> <sıra>"), havuz kartında "seçilen …" etiketi, düğme yanında çift sayısı; `randomFill` benzerleri atlar; aynı soru çifti varsa `confirm()`. Sunucu engellemez. Tarayıcıda (headless Chromium, test sunucusu) denendi: kopya seçilince havuz etiketi, ikisi seçilince iki satırda uyarı ve "1 çift aynı soru"; "yer alır / yer almaz" çifti uyarı vermedi. Ölçek notu: ders başına n² karşılaştırma, büyük havuzda önbellek gerekir.

### Yanlışlara benzer soru önerisi (2026-11-17)
- **Akış (kullanıcı kararı: öğretmen seçer, öğrenciye kendiliğinden gitmez):** karnede "Benzer soru öner" (`?sonuc=`), deneme sayfasında "Yanlışlara benzer soru" (`?sinif=` süzgeciyle) → `/kurum/denemeler/[id]/benzer`. Yanlış / boş her soru (yanlış yapan sayısına göre) ve havuzdaki aynı / benzer adaylar; öğretmen işaretler ("Her sorudan birini işaretle": sınıfın görmediği ilk aday) → "Seçilen n soruyla çalışma kağıdı hazırla" deneme kurma ekranını `?sec=…&amac=calisma&ad=…&ders=…` ile açar (`BankExamBuilder preset`: çalışma kağıdı, tek kitapçık, ilk bölümde sorular). Kayıt yine öğretmenin "Çalışma kağıdını oluştur" düğmesiyle.
- **Hesap:** `exams > practiceSuggestions` (`internal/for-practice.ts`): yalnızca havuzdan kurulmuş denemede (bölümde `items.length === count`); kitapçık eşlemesi `orderFor` ile A'daki soruya çevrilir; boş = yanlış. Adaylar `similarForItems` (onaylı, arşivde değil, bu denemede yok); sınıfın gördüğü (`bankUsage.classIds`) işaretlenir, elenmez.
- **Doğrulama:** test DB'de havuzdan 2 kitapçıklı deneme + 2 sonuç: B kitapçığındaki yanlış A'daki doğru soruya eşlendi, boş sayıldı; tek öğrenci / herkes kapsamı doğru. Tarayıcıda: öneri sayfası → "Her sorudan birini işaretle" → çalışma kağıdı ekranı adı ve soruyla açıldı. Kesilmiş (görsel) soruda benzer aranamaz, sayfada söylenir.

### Onay ekranı iyileştirmesi (2026-11-17)
- **Gruplar** (`?durum=onay&onay=`): `reviewQueue` (question-bank) süzgece uyan bütün onay bekleyenleri ayırır: `tekrar` (havuzda aynısı var), `not` (agent notu var), `cozdu` (aktarılmış, kaynakta anahtar yok, cevabı agent çözdü), `cevap` (cevabı eksik), `temiz` (hiçbiri). Sayfada sayılarla bağlantı satırı; süzgeç formu `onay`ı korur. `listItems` ve kuyruk ortak `whereOf` kullanır.
- **Toplu işlem:** "Listedeki n sorunun tümünü onayla" (bütün sayfalar; sorunlu gruplarda ek uyarı), tekrar grubunda "Listedeki n soruyu sil". Kartta "Sil" ve aynısı varsa "Havuzda aynısı var: karşılaştırın" (ayrıntı panelini açar).
- **Yeni alan `answerBy`** (key | agent; elle girilende boş): MCP `answerSource` ("key" | "solved") → aktarılan soruda; uyarlanan / yeni yazılanda kendiliğinden "agent". Kartta "Cevabı agent çözdü" rozeti. Talimat: anahtar yoksa agentNote'a yazma, answerSource kullan (önceden 74 notun 73'ü bu cümleyle başlıyordu; grup ayrımı işe yaramıyordu). Eski kayıtlarda alan boş, notlar duruyor.

### Uzaktan MCP (2026-11-17)
- **Yapı:** araçlar ve tarifler `src/mcp/bank-server.ts > createBankServer({ ownerId, appUrl, localFiles })`. Yerel: `src/mcp/server.ts` (stdio, `npm run mcp`). Uzak: `src/app/api/mcp/route.ts` (Streamable HTTP, durumsuz, `enableJsonResponse`; her istekte yeni sunucu). Kurum kuralları dosyası `process.cwd()`'den okunur (Next'te `__dirname` paket klasörüdür).
- **Kimlik:** `Authorization: Bearer rqb_…`. Yeni tablo `ApiKey` (identity): yalnızca SHA-256 özeti ve ilk 8 karakter; düz anahtar bir kez gösterilir; iptal edilen 401; son kullanım dakikada bir yazılır; kurum başına en fazla 20 etkin anahtar. Sayfa: Soru havuzu → "Yapay zekâ bağlantısı" (`/kurum/soru-havuzu/baglanti`): anahtar oluştur / listele / iptal et, Claude Code komutu ve JSON ayarı anahtarla hazır.
- **Uzakta görsel:** yalnızca base64 (`image.path` anlaşılır hatayla reddedilir).
- **Doğrulama:** test sunucusu + SDK HTTP istemcisi: araç/tarif listesi, get_bank_context (kurum kuralları dahil), base64 görselli kayıt, path reddi, yanlış ve iptal edilmiş anahtar 401, yerel stdio aynı araçlarla çalışıyor. Sayfa tarayıcıda denendi (tarih biçimi `fmtDateTime` ile; aksi hâlde hydration uyarısı).
- **Eksikler:** istek sınırı (rate limit) yok; HTTPS dağıtım tarafında sağlanmalı; anahtarın kapsamı tüm kurum (öğretmen başına yetki yok).
- Şema: `answerBy` ve `ApiKey` dev.db ve test.db'ye `db push` ile eklendi (yalnızca ekleme; öncesinde scratchpad'e yedek).
