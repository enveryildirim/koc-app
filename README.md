# SınavKur

Dershane ve kurslar için eğitim destek sistemi: öğrenci kaydı, deneme sınavı okuma (optik form + okuyucu TXT),
karneler ve analizler, ödev takibi, ders programı ve yoklama. Ayrıca online sınav hazırlama ve paylaşma.
Next.js 15 + TypeScript + Tailwind + Prisma (SQLite).

## Hızlı başlangıç

```bash
npm install
cp .env.example .env
npm run db:setup   # SQLite veritabanını oluşturur ve demo verileri yükler
npm run dev        # http://localhost:3000
```

Demo hesap: **demo@sinavkur.com / demo1234** → giriş sonrası **Kurum Paneli** (`/kurum`) açılır (giriş sayfasında “Demo hesabıyla gir” düğmesi de var).
Demo verilerini sıfırlamak için: `npm run db:seed`

## Demo veriler

| Kod | Sınav | Not |
|---|---|---|
| `MAT801` | 8. Sınıf Matematik | 20 dk süreli |
| `GENEL1` | Genel Kültür | Tüm soru tipleri (tek/çok cevap, D/Y, kısa cevap) |
| `ENGA20` | İngilizce A2 | 10 dk süreli |
| `FEN020` | Fen Bilimleri – Optik Form | 20 soru, optik form testi için |

Her sınavda rastgele 8–17 katılım bulunur. Sınavı çözmek için: `/s/<KOD>` (ör. `/s/GENEL1`).

## Optik form

`Sınav → Optik Form` sekmesi:
1. **Formu yazdır**: köşe işaretli A4 cevap formu (en fazla 60 soru, A–E; öğrenci no 6 hane).
2. **Görüntü yükle**: taranmış veya telefonla çekilmiş form fotoğrafları. Okuma tamamen tarayıcıda yapılır.
3. **Örnek taranmış form üret**: test için rastgele doldurulmuş, döndürülmüş ve gürültülü sahte bir tarama oluşturur.
4. Okunan cevapları gerekirse düzeltin → **Tümünü sonuçlara kaydet**.

Optik formda yalnızca tek cevaplı çoktan seçmeli ve doğru/yanlış sorular yer alır.
Algoritma (`src/lib/omr/scan.ts`): uyarlamalı eşikleme → köşe karelerini bulma → homografi → baloncuk doluluk oranı.

## Kurum paneli (`/kurum`)

| Modül | Sayfa | İçerik |
|---|---|---|
| Kayıt | `/kurum/ogrenciler` | Öğrenci listesi, tek tek ekleme, Excel (.xlsx) / CSV / yapıştır ile toplu yükleme, sınıflar, kurum dışı (STS) öğrenciler, öğrenci profili |
| Sınav okuma | `/kurum/denemeler` | LGS / TYT / AYT / serbest deneme, A–B kitapçık cevap anahtarı, sınava özel optik form, görüntüden tarama, optik okuyucu TXT içe aktarma (sütun tanımlı) |
| Raporlar | deneme sekmeleri | Sıralı liste, öğrenci karnesi + hata karnesi, toplu karne yazdırma, soru frekans analizi, sınıf ortalamaları, öğrencinin tüm sınavları ve birleştirilmiş ortalama |
| Ödev takip | `/kurum/odevler` | Sınıfa ödev verme, Yaptı / Eksik / Yapmadı işaretleme, öğrenci bazında ödev raporu |
| Ders planlama & yoklama | `/kurum/ders-programi`, `/kurum/yoklama`, `/kurum/raporlar` | Haftalık program, öğretmenler, günlük yoklama, ek ders/etüt, devamsızlık / gelmeyenler / öğretmen ders sayısı / öğrenci ders listesi raporları |

Net hesabı: LGS'de 3 yanlış, TYT/AYT'de 4 yanlış 1 doğruyu götürür (deneme bazında değiştirilebilir). Çift işaretleme yanlış sayılır.

Demo veride: 4 sınıf (8-A, 8-B, 12-A, 12-B), ~80 öğrenci, 6 deneme, 20 ödev, 8 öğretmen ve son 3 haftanın yoklamaları.
Test kolaylıkları: “Örnek taranmış form üret”, “Örnek okuyucu dosyası üret”, “Örnek veriyle dene” (öğrenci yükleme) ve cevap anahtarında “Rastgele doldur”.
