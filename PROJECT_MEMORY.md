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

### Çok kiracılık (multi-tenant)
- **Kurum = kullanıcı.** Kurum tablolarında `ownerId` alanı var (User'a ilişki tanımlı değil).
- Her sorgu `ownerId` ile filtrelenir:
  - Sayfalar `requireOwner()` kullanır.
  - API'ler `apiOwner()` kullanır: giriş yoksa 401, başka kurumun kaydıysa 404.
- `seed-kurum.ts`, kurum tablolarını ilişki olmadığı için elle temizler.

### Klasör yapısı (önemli dosyalar)
```
prisma/
  schema.prisma          # Online test modelleri + kurum modelleri
  seed.ts                # Demo kullanıcı + 4 online test; sonunda seedKurum()
  seed-kurum.ts          # Sınıflar, ~80 öğrenci, 6 deneme, ödevler, program, 3 haftalık yoklama
src/lib/
  auth.ts                # Oturum (getUser, requireUser, getOwnedTest)
  grading.ts             # Online test puanlama
  exam.ts                # Deneme: EXAM_TYPES şablonları, gradeExam (net), normNo, fmtNet  (istemci-güvenli)
  examServer.ts          # loadExam, saveResults (no ile eşleştirme + upsert), regrade, examReport (sıra/ortalama)
  examOmr.ts             # Deneme → optik form tanımı (FormSpec) + cevap anahtarı (istemci-güvenli)
  kurum.ts               # requireOwner/apiOwner, ymd, dayOfWeek  (SUNUCU: next/headers içerir)
  kurumLabels.ts         # DAYS, LESSON_TYPES, ATTENDANCE, HOMEWORK etiketleri (istemci-güvenli)
  studentInput.ts        # Öğrenci girdisi doğrulama
  omr/layout.ts          # Parametrik optik form düzeni: computeLayout(spec), buildForm()
  omr/scan.ts            # Görüntüden okuma: scanForm(image, layout)
  omr/draw.ts            # Canvas çizimi + test için sahte "taranmış" form üretici
src/components/
  OmrScanner.tsx         # Ortak tarama arayüzü; mode="test" | "exam"
  FormSvg.tsx            # Yazdırılabilir form (SVG)
  kurum/ui.tsx           # PageHeader, Kpi, Empty, Tabs, th, td
  kurum/{kayit,sinav,odev,program}/   # Modül bileşenleri
src/app/
  panel, sinav/[id]/*, s/[code], sonuc/[id]   # Online test (aşama 1)
  kurum/*                                      # Kurum paneli (aşama 2)
  api/*                                        # Route handler'lar
```

**Uyarı:** `lib/kurum.ts`, `auth` üzerinden `next/headers` import ediyor. Bu yüzden `"use client"` bileşenler etiketleri **`lib/kurumLabels.ts`'den** almalı; yoksa derleme kırılır. `components/kurum/odev/labels.ts` ve `program/labels.ts` aynı etiketlerin yerel kopyaları; ileride `kurumLabels.ts`'e yönlendirilebilir.

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

### Net hesabı (`lib/exam.ts > gradeExam`)
- Net = D − Y / `wrongPer`. Varsayılan `wrongPer`: LGS = 3, TYT/AYT = 4. Deneme bazında değiştirilebilir.
- Çift işaret (`*`) yanlış sayılır, boşluk boş sayılır.
- B kitapçığı kendi anahtarıyla (`keyB`) puanlanır.
- Cevap anahtarı kaydedilince `regrade()` tüm sonuçları yeniden hesaplar.

---

## 4. Optik okuyucu (OMR)

### Form düzeni (`lib/omr/layout.ts`)
- A4, birim mm.
- Dört köşede 8 mm siyah kare işaret var: merkezleri (14,14), (196,14), (196,283), (14,283).
- 6 haneli öğrenci numarası alanı; isteğe bağlı A/B kitapçık alanı.
- Bölüm başlıkları ve 2–5 şık desteklenir; en fazla 180 soru.
- Sütun sayısı ve satır yüksekliği soru sayısına göre otomatik hesaplanır. Baloncuk yarıçapı yaklaşık 1,9–2,2 mm.
- Bölüm numaraları her bölümde 1'den başlar.
- **Formu basan, örnek üreten ve okuyan kodun hepsi aynı `computeLayout` çıktısını kullanır.** Bu yüzden düzende yapılan bir değişiklik üçünü birlikte etkiler.

### Okuma algoritması (`lib/omr/scan.ts`)
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

### Optik okuyucu TXT içe aktarma (`components/kurum/sinav/TxtImport.tsx`)
- Sabit sütunlu dosyadaki alanların başlangıç sütunları kullanıcı tarafından tanımlanır: ad, numara, kitapçık, cevaplar.
- Varsayılan tanım: ad 1–25, no 26–31, kitapçık 32, cevaplar 33'ten başlar.
- Tanım tarayıcının `localStorage`'ında saklanır.
- Dosya kodlaması UTF-8 değilse `windows-1254` ile okunur.

---

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

### Yapılmayanlar / sonraki adımlar
- [ ] **Puan hesabı:** Resmi LGS/YKS puanı hesaplanmıyor; şu an sadece net var.
- [ ] **Kitapçıklar arası soru eşleme:** B kitapçığı sorularını A sırasına eşleyen tablo yok. Bu yüzden soru analizi kitapçık bazında ayrı gösteriliyor.
- [ ] **Kurum karşılaştırma:** Kurumlar arası karşılaştırma ve çoklu şube yok.
- [ ] **Diğer modüller:** Muhasebe, mobil uygulama, veliye SMS/e-posta, ödeme/paket satışı yok.
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
- **Tarih işleme:** Yerel tarih için `lib/kurum.ts > ymd()` kullanılmalı. Ders oturumu tarihleri string olarak tutulur.
