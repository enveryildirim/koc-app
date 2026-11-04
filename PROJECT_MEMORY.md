# PROJECT_MEMORY — SınavKur

Bu dosya projede ne yapıldığını, neden öyle yapıldığını ve kalan işleri kaydeder. Projeye yeni başlayan bir geliştirici veya yapay zekâ asistanı önce bunu okumalı.

Son güncelleme: 4 Kasım 2026 · Dal: `deneme-sinavza`

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

**Modüler monolit.** Ayrıntılı kurallar için **[ARCHITECTURE.md](ARCHITECTURE.md)** dosyasını okuyun. Kod `src/modules/<modül>/` altında, iş alanına göre bölünmüştür: identity, enrollment, exams, homework, schedule, online-test, reporting. `src/app/` ince bir katmandır ve veritabanına doğrudan erişemez. Modül sınırlarını `npm run lint` denetler.

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
  online-test/           # testler, public akış (publicTestByCode, submitPublicAttempt), OMR kaydetme
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

### Bilinen sınırlamalar
- **Ters görüntü:** Görüntü 180° ters çekilirse yanlış okunur; formda yön işareti yok.
- **Gerçek kâğıt testi yapılmadı:** Gerçek kâğıt ve kamera ile test edilmedi.

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
  - **Risk / erken uyarı:** kurallar ve ağırlıklar aşağıdaki tabloda. Toplam 4+ = Yüksek, 2–3 = Orta, 1 = Düşük.

    | Uyarı | Kural | Ağırlık |
    |---|---|---|
    | Net düşüşü | Aynı türdeki son iki denemede ≥ 5 net veya ≥ %10 düşüş | 2 |
    | Son denemeye girmedi | Sınıfın son denemesinde sonucu yok | 1 |
    | Devam düşük | Son 30 günde devam < %85 | 2 |
    | Ödev yapmıyor | Son 30 günde ödev yapma < %60 | 1 |

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
- **Sonraki aşama:** 4) öğretmen görünümü (öğretmenin dersleri + planları) ve veli linkine "yaklaşan denemeler / ödevler" bölümü.

## 5. Özellik durumu

### Aşama 1 — Online test (`/panel`, `/sinav/[id]`, `/s/[code]`)
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
- [ ] **Soru frekans analizi kitapçık bazında:** B eşlemesi artık var ve konu analizinde kullanılıyor, ama soru frekans analizi hâlâ kitapçık bazında ayrı.
- [ ] **Kurum karşılaştırma:** Kurumlar arası karşılaştırma ve çoklu şube yok.
- [ ] **Ödev raporu:** Sınıf ve ders bazında ödev raporu yok (öğrenci bazında var).
- [ ] **Risk eşikleri sabit:** Risk eşikleri kodda tanımlı (`modules/reporting/risk.ts`); kurumun ayarlayabileceği bir ekran yok.
- [ ] **Diğer modüller:** Muhasebe, mobil uygulama, veliye otomatik SMS/e-posta (şu an WhatsApp linki ve kopyalama var), ödeme/paket satışı yok.
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
- **Seed ID'leri:** Seed her çalıştığında ID'ler değişir. ID'leri sabit kodlamayın, veritabanından sorgulayın.
- **Tarih işleme:** Yerel tarih için `shared/date.ts > ymd()` kullanılmalı. Ders oturumu tarihleri string olarak tutulur.
