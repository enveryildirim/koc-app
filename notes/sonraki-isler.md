# Soru havuzu: sonraki işler

17 Kasım 2026 itibarıyla. Bugüne kadar yapılanlar: `PROJECT_MEMORY.md` (soru havuzu bölümleri), yapay zekâ bağlantısı: `MCP.md`.

Sıra önerisi: önce 1. Gerçek veri, sonraki işlerin gerekip gerekmediğini gösterir.

## 1. Geçmiş yazılı sınavları havuza aktarmak (önerilen)

- Kaynak: `notes/tahriri_imtihanlar/` (2018–2023). Test amaçlı, commit'lenmez.
- MCP `import_questions` ile, küçük bir örnekle başlanır: önce klasör incelenir (dosya türleri, sınav sayısı, netlik).
- Sınanacaklar:
  - aktarma kuralları: kaynak notu, cevap kaynağı (`answerSource`), agent notları;
  - onay grupları ve toplu onay;
  - yıllar arası tekrar / benzer soru tespiti: 0,8 eşiği gerçek veride doğru mu;
  - kesilmiş soruları yazıya geçirme: net bir kaynakla; dev.db'deki kesimler ~140 px, okunamadı;
  - yanlışlara benzer soru önerisi.
- Çıktı: sorunlar listesi ve eşik ayarı. Sonuçlar `notes/soru-benzerligi.md`'ye eklenir.

## 2. Yazma ekranına vurgu ipucu

- Soru metni alanının altına: "`**…**` arası kalın basılır (ör. olumsuz kök)".
- Görünüm ve kitapçık zaten destekliyor (`356f33b`).

## 3. Uzaktan MCP'yi sağlamlaştırmak

- **İstek sınırı (rate limit):** anahtar başına dakikalık üst sınır. Şu an yok.
- **Öğretmen başına anahtar ve yetki:**
  - anahtar bir öğretmene bağlansın, yalnızca kendi derslerine soru ekleyebilsin;
  - soruyu kimin eklediği kayıtlı olsun.
  - Şu an anahtar bütün kuruma erişiyor.
- **Yayına alma:** HTTPS ile (dağıtım tarafında).

## 4. Sunucuda yapay zekâ (kararlar bekleniyor)

- Kesme ekranında soruların yapay zekâyla bulunması: kutu, metin, şık, cevap. Sonra konu / kazanım önerisi, cevap anahtarı kontrolü, Arapça / Osmanlıca okuma.
- Kullanıcıdan beklenen kararlar:
  - ilk adım;
  - API anahtarı (tek mi, kurum başına mı);
  - kitap sayfalarını API'ye gönderme (telif);
  - model.
- Gerekçe ve ilkeler: `PROJECT_MEMORY.md` (11-11, "Yapay zekâ konuşması").

## 5. Benzerlik sonuçlarını önbelleğe almak

- Şu an her istekte hesaplanıyor; deneme kurma sayfasında ders başına n² karşılaştırma var. 113 soruda ~0,2–0,5 s.
- Havuz birkaç bin soruyu geçince gerekli. 1. maddeden sonra havuz büyüklüğüne göre karar verilir.

## 6. Yayına alma (Dokploy)

- Rehber: `DEPLOY.md`. Yayından önce kodda yapılacaklar orada bölüm 2'de kontrol listesi olarak duruyor:
  - `AUTH_SECRET` zorunlu,
  - güvenli çerez,
  - demo ve kayıt kapalı,
  - Dockerfile / standalone,
  - Prisma Migrate,
  - `/api/health`,
  - `db:backup`.
- Kullanıcıdan beklenen kararlar:
  - yayının amacı (pilot mu, gerçek kurum mu),
  - alan adı,
  - Git sağlayıcısı,
  - kayıt (kapalı mı, davetli mi),
  - S3 alanı.

## 7. Ürün adı (beklemede)

- "SınavKur" adının değişmesi konuşuldu (17 Kasım 2026). Yeni ad henüz belirlenmedi, iş beklemede.
- Ad 16 dosyada 25 yerde geçiyor:
  - ekranda: sayfa başlığı, logo, giriş sayfası, alt bilgi, karne başlığı, optik formdaki marka;
  - belgelerde.
- Öneri: demo e-postası (`demo@sinavkur.com`) değişmesin. Seed demo hesabını e-postayla bulur; değişirse yeni, boş bir hesap açılır.
- Eski commit mesajlarına ve `feature/sinavkur` dalına dokunulmaz.

## Yapılanlar (bu listeden)

- 17 Kasım 2026, eski agent notları: "Kaynakta cevap anahtarı yok; cevap agent tarafından çözüldü." cümlesi notlardan silindi.
  - 69 aktarılmış soruda `answerBy = agent` yapıldı (dev.db).
  - Onay bekleyenlerden 28'inde gerçek şüphe notu kaldı.
  - `basis` alanından önce eklenmiş 14 soruya dokunulmadı.
- 17 Kasım 2026, çözüm QR'ı: kitapçığa denemenin, karneye öğrencinin kişisel QR'ı (yalnızca yanlış ve boşları). Sayfa `/cozum/<anahtar>`, girişsiz, öğretmen "Çözümleri yayınla" deyince açılır.
  - Henüz yok: veli bülteninde bağlantı, çözüm sayfasında öğretmenin seçtiği benzer sorular.
