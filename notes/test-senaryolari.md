# Test senaryoları: Ders takip PoC

Dal: `dahili-ders-takip`. Her senaryoda **adımlar** ve **beklenen sonuç** var. Sorun çıkarsa senaryonun numarasını ve ekran görüntüsünü not edin.

## 0. Hazırlık

1. Demo veriyi sıfırlayın: `npm run db:seed`. Bütün test kayıtları silinir; soru havuzu silinmez.
2. Uygulamayı başlatın: `npm run dev` ve http://localhost:3000 adresini açın.
3. Giriş: **demo@sinavkur.com / demo1234**. Bu, kurum hesabıdır (yönetici).

**Öğretmen ve etüt mesulü linkleri:** Menü → Ders programı → üstteki **Öğretmenler** sekmesi → "Giriş linki" sütunu → **Kopyala**. Linkler her `db:seed`'de yenilenir.

> **Önemli:** Bir tarayıcıda tek oturum açık kalır. Öğretmen linkini aynı tarayıcıda açarsanız yönetici oturumu kapanır. Linkleri **gizli pencerede** ya da başka bir tarayıcıda açın.

**Telefonda denemek için:** `npm run dev -- -H 0.0.0.0` ile başlatın. Telefonda `http://<bilgisayarın-IP'si>:3000/o/<anahtar>` adresini açın; bilgisayarla aynı Wi-Fi'da olun. Alternatif: Chrome geliştirici araçlarında telefon görünümü.

**Demo kişileri** (hepsi kurgusal):

| Kişi | Rol | Dersleri |
|---|---|---|
| Ercan Sevim | Etüt mesulü | 9-A (etüt, dışarıda alınan Matematik ve Türkçe) |
| Hakan Toprak | Etüt mesulü | 10-A ve SEVİYE-2 |
| Selin Akar | Öğretmen | Bilişim Teknolojileri (9-A, 9-B), Programlama (10-A, 11-A) |
| Mahmut Kara | Öğretmen | İslam Tarihi (9–11), SEVİYE-2 Kur'ân ve Tecvid (Cumartesi / Pazar) |
| Yasin Er | Öğretmen | SEVİYE-2 İlmihal ve Kitâbet (Cumartesi / Pazar) |

- **Hafta sonu:** yalnızca SEVİYE-2'nin dersi vardır. Hafta içi dersleri görmek için "Bugün" ekranında ‹ › ile güne geçin.
- **Eksik giriş örnekleri:** Selin Akar, Mahmut Kara ve Ercan Sevim'in son günlerdeki bazı yoklamaları bilerek boş bırakıldı.

---

## A. Temel: sınıf, ders, üyelik (yönetici)

**A1. Sınıf sayfası**
- **Adımlar:** Menü → Öğrenci listesi → üstteki **Sınıflar** sekmesi → **SEVİYE-2** kartı.
- **Beklenen:**
  - "0 öğrenci · 16 ek üye · 4 ders".
  - Etüt mesulü: Hakan Toprak.
  - Öğrenciler "Başka sınıftan katılanlar" altında, ana sınıflarıyla (10-A / 11-A) listelenir.

**A2. Ders ekleme ve düzenleme**
- **Adımlar:**
  1. 9-A sayfası → "+ Ders ekle" → ad: *Kimya*, tür: *Okul*, sorumlu: *Ercan Sevim*, "Başka kurumda alınıyor" işaretli → Kaydet.
  2. Aynı adla tekrar ekleyin.
- **Beklenen:**
  - Ders "Dışarıda" etiketiyle görünür.
  - Aynı adla ikinci ders: "Bu sınıfta bu adla bir ders zaten var."

**A3. Programdaki dersi silme**
- **Adımlar:** 9-A → Fizik'e dokunun → "Dersi sil".
- **Beklenen:** "Bu dersin programda 2 saati var…" uyarısı; ders silinmez.

**A4. Ek üye**
- **Adımlar:**
  1. 9-A → "+ Başka sınıftan ekle" → 9-B'den bir öğrenci arayın → seçin.
  2. Öğrencinin profilini açın.
  3. Öğrenciyi 9-A'dan "Çıkar"ın.
- **Beklenen:**
  - Öğrenci "Başka sınıftan katılanlar"da görünür.
  - Profil başlığında "Ayrıca: 9-A" yazar.
  - Çıkarınca ana sınıfı (9-B) değişmez.

**A5. Etüt mesulü atama**
- **Adımlar:**
  1. 9-A → Etüt mesulü listesinden Kemal Yurt'u seçin, sonra Ercan Sevim'e geri alın.
  2. Ders programı → Öğretmenler → bir öğretmenin rolünü "Etüt mesulü" yapın.
- **Beklenen:**
  - Listede yalnızca etüt mesulleri vardır.
  - Rolü değişen öğretmen sınıf sayfasındaki listeye gelir.

**A6. Programdan ders oluşması**
- **Adımlar:** Ders programı → 9-A → Cumartesiye yeni bir ders ekleyin, ad: *Robotik Kodlama*.
- **Beklenen:** 9-A sayfasında "Robotik Kodlama · Mesleki" kendiliğinden görünür.

---

## B. Öğretmen telefonda: giriş, Bugün, ders ekranı

**B1. Linkle giriş**
- **Adımlar:** Gizli pencerede Yasin Er'in linkini açın.
- **Beklenen:**
  - Doğrudan "Bugün" ekranı açılır.
  - Üstte "Yasin Er · Öğretmen"; altında "Bugün / Sözlü ve yazılı" sekmeleri.

**B2. Günün dersleri**
- **Adımlar:** Cumartesi ya da Pazar günü ekrana bakın.
- **Beklenen:** SEVİYE-2 İlmihal ve Kitâbet kartları "Yoklama bekliyor" etiketiyle görünür.

**B3. Yoklama**
- **Adımlar:**
  1. Bir derse dokunun → iki öğrenciye dokunun (gelmedi) → birine "Geç" deyin → Kaydet.
  2. Aynı derse yeniden girin.
- **Beklenen:**
  - Kayıttan sonra "Bugün"e dönülür; kartta "Yoklama · 2 gelmedi" yazar.
  - Yeniden girince işaretler yerinde durur.

**B4. Eksik girişler**
- **Adımlar:** Selin Akar'ın linkini açın.
- **Beklenen:** Üstte sarı "Eksik girişler (N)" listesi çıkar. Birine "Gir ›" deyip yoklamayı kaydedince listeden düşer.

**B5. İşlenen konu**
- **Adımlar:** Mahmut Kara → SEVİYE-2 Tecvid dersi → "Bu derste işlenen konu" kutusundan bir konuyu işaretleyin.
- **Beklenen:** "Bugün" ekranında Tecvid kartı "Konu işlendi" olur.

**B6. Yetki**
- **Adımlar:**
  1. Öğretmen oturumunda adres çubuğuna `/kurum` yazın.
  2. Başka bir öğretmenin dersinin adresini deneyin.
- **Beklenen:**
  - `/kurum` sizi "/ogretmen"e geri gönderir.
  - Başkasının dersi "bulunamadı" (404) verir.

---

## C. Sözlü / yazılı / uygulama

**C1. Puan cetveli (yönetici)**
- **Adımlar:**
  1. Sözlü ve yazılı → Puan cetvelleri → bir cetveli açın → kriter ekleyin → Kaydet.
  2. Bir kriterin puanını 0 yapıp kaydetmeyi deneyin.
- **Beklenen:**
  - Değişiklik kaydedilir.
  - Puan 0 iken hata çıkar: "… 1–100 arası tam sayı olmalı."

**C2. Öğretmen sözlü başlatır**
- **Adımlar:** Mahmut Kara → "Sözlü ve yazılı" → SEVİYE-2 · Tecvid → Başlat. Tür: Sözlü, cetvel: Bilgi sözlüsü, plan konusu: bu haftaki.
- **Beklenen:** Puan ekranı açılır ve ilk öğrenci açık gelir.

**C3. Puan girme**
- **Adımlar:** Kriter düğmelerine dokunun → "Kaydet ve sonraki". Bir öğrenciye "Gelmedi" deyin. Birinin puanını silin.
- **Beklenen:**
  - Kaydedince sıradaki puansız öğrenci açılır.
  - Üstteki "x/16 girildi · ort. %" güncellenir.
  - "Gelmedi" etiketi görünür; silinen puan "Gir ›"e döner.

**C4. Dışarıda alınan ders (etüt mesulü)**
- **Adımlar:** Ercan Sevim'in linki → "Sözlü ve yazılı" → 9-A · Matematik (Dışarıda) → Başlat. Tür: Yazılı, cetvel: Yazılı (100 puan), başlık: *Okul 2. yazılı*.
- **Beklenen:** Okul notları aynı ekrandan girilir.

**C5. Sonuç ve kâğıt form (yönetici)**
- **Adımlar:**
  1. Sözlü ve yazılı → bir değerlendirmeyi açın.
  2. "Kâğıt form" → Yazdır.
- **Beklenen:**
  - Öğrenci × kriter tablosu ve altta kriter ortalamaları.
  - Kâğıt formda sınıf listesi ve boş kutular var.

**C6. Özetler**
- **Adımlar:** Puanı olan bir öğrencinin profilini açın, sonra SEVİYE-2 sınıf sayfasına bakın.
- **Beklenen:**
  - Profilde "Sözlü ve yazılı" bölümü: en düşük ortalama üstte, gerekiyorsa "düşüşte" etiketi.
  - Sınıf sayfasında her dersin altında "Son 30 gün: …" özeti; değerlendirme yapılmayan derslerde sarı uyarı.

---

## D. Takip (yönetici ve etüt mesulü)

**D1. Dikkat isteyenler**
- **Adımlar:** Menü → Takip.
- **Beklenen:** Öğrenciler gerekçeleriyle ("Devam", "Not", "Ödev") listelenir. Sağda: girişi eksik dersler, plana göre geride kalanlar, 30 gündür sözlü/yazılı olmayan dersler.

**D2. Etüt mesulünün kapsamı**
- **Adımlar:**
  1. Hakan Toprak'ın linki → üstte "Takip".
  2. "Tüm kurum"a geçin.
- **Beklenen:**
  - Kapsam: "10-A, SEVİYE-2".
  - "Tüm kurum"da liste genişler.

**D3. Sekmeler**
- **Adımlar:** Sınıflar, Dersler ve Öğretmenler sekmelerini açın.
- **Beklenen:**
  - Sınıflar: devam, ödev, sözlü/yazılı ortalaması.
  - Dersler: en zayıf kriter, plan durumu.
  - Öğretmenler: eksik yoklama sayısı. Liste ada göre sıralıdır, sıralama yapılmaz.

**D4. Düzeltme sonrası**
- **Adımlar:** B4'te eksik yoklamayı girdikten sonra Takip'i yenileyin.
- **Beklenen:** O öğretmenin eksik sayısı azalır.

---

## E. Optik okuyucu (FMT TXT)

**E1. Hazır biçimle yükleme**
- **Adımlar:** Denemeler → "Ara kontrol sınavı (FMT örneği)" → Okuyucu dosyası (TXT) → `notes/ornek-fmt.txt` dosyasını seçin → kaydedin.
- **Beklenen:**
  - Biçim "Bu sınava kayıtlı".
  - Önizlemede her bölüm ayrı renkte.
  - Kayıt sonucu: 19 sonuç kaydedilir; 009999 "eşleşmeyen", 002005 "kitapçık boş" olarak bildirilir.

**E2. Puanlama**
- **Adımlar:** Sıralı listeyi açın.
- **Beklenen:** 2001 (A kitapçığı) 28 net, 2002 (B kitapçığı) 27 net. Bu sınavda yanlış doğruyu götürmez.

**E3. Hatalı biçim**
- **Adımlar:** Siyer başlangıcını 40 yapın.
- **Beklenen:** "İlmihal ve Siyer-i Nebî cevap blokları çakışıyor"; kaydet düğmesi pasif.

**E4. Biçimi kopyalama**
- **Adımlar:** Denemeler → Yeni deneme → Okuyucu biçimi: "Ara kontrol sınavı… ile aynı" → oluşturun → TXT sekmesine geçin.
- **Beklenen:** Biçim kayıtlı gelir.

**E5. Telefonla okuma (gerçek kâğıt)**
- **Adımlar:** Bir denemenin optik formunu yazdırın, doldurun, telefonla çekin ("Optik form tara").
- **Beklenen:** Numara ve cevaplar okunur. Bu test şimdiye kadar hiç yapılmadı.

---

## F. Hocanın sınavı ve çalışma kağıdı

**F1. Derse bağlama**
- **Adımlar:** Bir denemenin başlığındaki ders listesinden "9-A · İslam Tarihi"ni seçin.
- **Beklenen:** Denemeler listesinde sınavın altında ders adı görünür.

**F2. Çalışma kağıdı**
- **Adımlar:** Denemeler → Havuzdan sınav → "Çalışma kağıdı (puanlanmaz)" → soru ekleyin → oluşturun.
- **Beklenen:**
  - Kitapçık açılır, optik form düğmesi yoktur.
  - "Cevap anahtarı sayfası" seçilirse anahtar son sayfaya eklenir.
  - Listede "Çalışma kağıdı" etiketi görünür.

**F3. Cevapsız soru**
- **Adımlar:** Cevabı boş bir soruyla (Matematik · Üslü, ilk soru) önce sınav, sonra çalışma kağıdı kurun.
- **Beklenen:** Sınav reddedilir ("cevabı girilmemiş"); çalışma kağıdı kabul edilir.

---

## G. Ödev

**G1. Öğretmen telefondan ödev verir**
- **Adımlar:** Selin Akar → 9-A Bilişim Teknolojileri dersi → "+ Ödev ver" → kaydedin.
- **Beklenen:** "… 18 öğrenciye atandı."

**G2. Ödev kontrolü**
- **Adımlar:** Ders ekranındaki ödeve dokunun → durumları işaretleyin.
- **Beklenen:** Değişiklikler anında kaydedilir. Teslimi geçmiş ödevde "N işaretlenmedi" uyarısı görünür.

**G3. Ek üyeler**
- **Adımlar:** Yönetici → Ödev takibi → SEVİYE-2 Kitâbet ödevini açın.
- **Beklenen:** 16 öğrencinin hepsi (ek üyeler) listededir.

**G4. Sınıf ve ders raporu**
- **Adımlar:** Ödev takibi → "Sınıf ve ders bazında".
- **Beklenen:** Yapma oranı en düşük olan üstte; Excel'e aktarılabilir.

---

## H. Haftalık plan içe aktarma

**H1. Yükleme ve önizleme**
- **Adımlar:** Yıllık takvim → üstteki **Yıllık ders planı** sekmesi → "Haftalık planı içe aktar" → `notes/ornek-haftalik-plan.csv`.
- **Beklenen:**
  - "13 hafta (11 ders haftası, 2 izin) · 5 ders".
  - İzin haftaları: Yaz talebe izni, 1. ara tatil izni.

**H2. Ders adı uyarısı**
- **Adımlar:** SEVİYE-2'yi seçin.
- **Beklenen:** "Ezber" satırında "Bu adla ders yok: SEVİYE-2" uyarısı çıkar. Adı düzeltebilir ya da öyle bırakabilirsiniz.

**H3. Kaydetme**
- **Adımlar:** Kaydet; sonra "Aynı ders için plan varsa yeniden yaz" işaretli tekrar kaydet.
- **Beklenen:**
  - İlk kayıt: 4 plan oluşur; Tecvid planı zaten olduğu için atlanır; takvime 2 izin haftası eklenir.
  - İkinci kayıt: 5 plan güncellenir.

**H4. Tarih kontrolü**
- **Adımlar:** SEVİYE-2 Tecvid planını açın.
- **Beklenen:** "Medd-i lâzım" 23 Kasım haftasındadır; 9 Kasım izni atlanmıştır.

---

## I. Veli

**I1. Veli karnesi**
- **Adımlar:** Veli karnesi → SEVİYE-2'den bir öğrenciye link oluşturun → linki gizli pencerede açın.
- **Beklenen:** "Sözlü ve yazılı" bölümünde ders, tür, yüzde ya da "Gelmedi" görünür.

**I2. Haftalık veli raporu**
- **Adımlar:** Haftalık veli raporu → aynı öğrencinin mesaj önizlemesi.
- **Beklenen:** Her değerlendirme bir satır: "• Tecvid (…): %78".

---

## J. Güvenlik

**J1. Link yenileme**
- **Adımlar:** Öğretmen bir pencerede açıkken yönetici o öğretmenin linkini "Yenile"r; öğretmen sayfayı yeniler.
- **Beklenen:** Öğretmen giriş sayfasına düşer. Eski link: "Giriş linki geçersiz…".

**J2. Link kaldırma**
- **Adımlar:** Linki "Kaldır"ın.
- **Beklenen:** Aynı sonuç: oturum kapanır, link çalışmaz.

**J3. Rol değişikliği**
- **Adımlar:** Bir öğretmeni etüt mesulü yapın; öğretmen `/kurum` açsın.
- **Beklenen:** Yönetim paneli açılır. Geri öğretmen yapılınca tekrar yönlendirilir.

**J4. Başka kurum**
- **Adımlar:** Yeni bir hesap açın (Kayıt ol) → demo kurumun bir sınıf adresini deneyin.
- **Beklenen:** 404.

---

## L. Uç değerleri ayır

Demo veride TYT Deneme 2'de bir öğrenci (12-A) A kitapçığını çözüp formda B işaretlemiş; neti −7 çıkar.

**L1. Sınıf ortalamaları**
- **Adımlar:** Denemeler ve optik → TYT Deneme 2 → Sınıf ortalamaları → **Uç değerleri ayır**.
- **Beklenen:**
  - 12-A: "17 · 1 ayrıldı", toplam net 80,56 (altında "hepsiyle 75,41").
  - Kurum geneli 73,69 (hepsiyle 71,51).
  - Altta "Uç değerler (1)": ↓ Çok düşük, −7,00 net, "Sonucu kontrol et" karneye götürür.
  - Düğme kapatılınca eski rakamlar döner. Excel dosyasının adında "(uç değerler ayrıldı)" yazar.

**L2. Sıralı liste**
- **Adımlar:** Sıralı liste sekmesi (düğme sekmeler arasında açık kalır).
- **Beklenen:** Sıra ve yüzdelik dilim değişmez; öğrenci 37. sırada "uç ↓" etiketiyle durur. "Ortalama net" 73,69, altında "1 ayrıldı · hepsiyle 71,51".

**L3. Sınıf gelişimi**
- **Adımlar:** Analiz ve uyarılar → Sınıf gelişimi → TYT → düğmeyi aç / kapat.
- **Beklenen:** Kapalıyken 12-A düşüşte görünür (▼ 3,42); açıkken yükselişte (▲ 1,73). Hücredeki "1 ayrıldı" bağlantısı denemenin sınıf ortalamalarına gider.

**L4. Küçük grup**
- **Beklenen:** 8 kişiden az grupta hiçbir şey ayrılmaz; sayfada "kişi sayısı az, ayrılmadı" yazar.

---

## K. Eski özellikler bozulmadı mı?

- **K1:** LGS / TYT denemeleri: sıralı liste, karne, konu analizi, madde analizi açılıyor.
- **K2:** Başarı Skoru (Analiz ve uyarılar → Başarı Skoru) ve kokpit (Özet) açılıyor.
- **K3:** Yönetici yoklama ekranı (`/kurum/yoklama`) eskisi gibi çalışıyor.
- **K4:** Online testler (`/panel`) açılıyor, bir test kodla çözülebiliyor.
