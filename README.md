# SınavKur

Online sınav hazırlama, paylaşma, otomatik puanlama ve optik form okuma uygulaması.
Next.js 15 + TypeScript + Tailwind + Prisma (SQLite).

## Hızlı başlangıç

```bash
npm install
cp .env.example .env
npm run db:setup   # SQLite veritabanını oluşturur ve demo verileri yükler
npm run dev        # http://localhost:3000
```

Demo hesap: **demo@sinavkur.com / demo1234** (giriş sayfasında “Demo hesabıyla gir” düğmesi de var).
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
