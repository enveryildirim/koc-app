# SınavKur

Dershane ve kurslar için eğitim destek sistemi: öğrenci kaydı, deneme sınavı okuma (optik form + okuyucu TXT),
karneler ve analizler, ödev takibi, ders programı ve yoklama, soru havuzundan sınav hazırlama.
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

## Kurum paneli (`/kurum`)

| Modül | Sayfa | İçerik |
|---|---|---|
| Kayıt | `/kurum/ogrenciler` | Öğrenci listesi, tek tek ekleme, Excel (.xlsx) / CSV / yapıştır ile toplu yükleme, sınıflar, kurum dışı (STS) öğrenciler, öğrenci profili |
| Sınav okuma | `/kurum/denemeler` | LGS / TYT / AYT / serbest deneme, A–B kitapçık cevap anahtarı, sınava özel optik form, görüntüden tarama, optik okuyucu TXT içe aktarma (sütun tanımlı) |
| Raporlar | deneme sekmeleri | Sıralı liste, öğrenci karnesi + hata karnesi, toplu karne yazdırma, soru frekans analizi, sınıf ortalamaları, öğrencinin tüm sınavları ve birleştirilmiş ortalama |
| Ödev takip | `/kurum/odevler` | Sınıfa ödev verme, Yaptı / Eksik / Yapmadı işaretleme, öğrenci bazında ödev raporu |
| Ders planlama & yoklama | `/kurum/ders-programi`, `/kurum/yoklama`, `/kurum/raporlar` | Haftalık program, öğretmenler, günlük yoklama, ek ders/etüt, devamsızlık / gelmeyenler / öğretmen ders sayısı / öğrenci ders listesi raporları |
| Başarı Skoru | `/kurum/analiz?tab=skor` | Öğrenci başına 0–100 skor (düzey, gelişim, katılım, devam, ödev), açıklamalar, 4 haftalık değişim, kurum ayarları |
| Haftalık veli raporu | `/kurum/veli-bulteni` | Haftanın özetini veliye WhatsApp / kopyalama ile gönderme, haftalık öğretmen notu, gönderim ve açılma takibi |

Net hesabı: LGS'de 3 yanlış, TYT/AYT'de 4 yanlış 1 doğruyu götürür (deneme bazında değiştirilebilir). Çift işaretleme yanlış sayılır.

Demo veride: 4 sınıf (8-A, 8-B, 12-A, 12-B), ~80 öğrenci, 6 deneme, 20 ödev, 8 öğretmen ve son 7 haftanın yoklamaları.
Test kolaylıkları: “Örnek taranmış form üret”, “Örnek okuyucu dosyası üret”, “Örnek veriyle dene” (öğrenci yükleme) ve cevap anahtarında “Rastgele doldur”.
