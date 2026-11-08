# Test senaryosu: Sıfırdan kurulum (boş veritabanı)

Dal: `dahili-ders-takip`. Bu senaryo **demo veri olmadan**, boş bir kurumu baştan kurarak ilerler. Her adım bir öncekinin verisine dayanır; sırayla gidin.

Her maddenin başındaki kutuyu işaretleyin: `[x]` geçti, `[!]` sorun var. Sorunları en alttaki **Sorun kaydı** tablosuna yazın.

---

## 0. Hazırlık

- [ ] Test DB'yi sıfırlayın: `npm run db:test:reset` → `prisma/test.db` boş olarak yeniden oluşur. (Demo DB `prisma/dev.db` etkilenmez.)
- [ ] Uygulamayı test DB ile başlatın: `npm run dev:test` → http://localhost:3000
  - Telefondan denemek için: `npm run dev:test -- -H 0.0.0.0`
- [ ] Doğru DB'de olduğunuzu kontrol edin: `demo@sinavkur.com` ile giriş **başarısız** olmalı.

> Öğretmen linklerini **gizli pencerede** veya başka tarayıcıda açın; aynı tarayıcıda tek oturum açık kalır.
> Senaryonun herhangi bir yerinde baştan başlamak için: sunucuyu durdurun → `npm run db:test:reset` → `npm run dev:test`.

---

## 1. Hesap açma ve boş kurum

**1.1 Kayıt**
- [ ] `/kayit` → ad: *Test Kurumu*, e-posta: *test@kurum.local*, şifre: *test1234* → Kayıt ol.
- **Beklenen:** Hesap açılır, Kurum paneli (`/kurum`) gelir.
- [ ] Aynı e-postayla ikinci kez kayıt olmayı deneyin → anlaşılır bir hata.
- [ ] Çıkış yapıp yeniden giriş yapın; yanlış şifreyle de deneyin.

**1.2 Boş durumlar** (veri yokken hiçbir sayfa hata vermemeli, ne yapılacağını söylemeli)
- [ ] Özet (kokpit): üstte **Kurulum · 0/6 adım** ve "Sıradaki: Sınıf ekle" düğmesi. Adımlar: Sınıflar → Personel → Öğrenciler → Dersler → Ders programı → Takvim. Her adım tamamlandıkça yeşil ✓ ve sayı gelir; hepsi tamamlanınca rehber kaybolur (her bölümden sonra Özet'e dönüp bakın).
- [ ] Menü: 1280×800 civarı bir pencerede Yönetim'in son maddesi (Puan cetvelleri) kaydırmadan görünüyor; altta "e-posta · Çıkış" tek satır.
- [ ] Yoklama · Sözlü ve yazılı · Ödevler · Denemeler ve optik
- [ ] Takip · Analiz (tüm sekmeler) · Veli karnesi · Haftalık veli raporu
- [ ] Soru havuzu · Online testler
- [ ] Yönetim: Öğrenciler · Personel · Sınıflar · Dersler · Ders programı · Takvim ve planlar · Müfredat · Puan cetvelleri
- [ ] ⌘K arama: bir şey yazın → "sonuç yok" benzeri mesaj, hata yok.
- **Beklenen:** Hiçbir sayfada 500 hatası / boş beyaz ekran yok; boş listelerde yönlendirici bir mesaj var.

---

## 2. Sınıflar

- [ ] Yönetim → Sınıflar → sağ üstte **+ Yeni sınıf** → yan panel açılır. *9-A* (düzey 9) → **Kaydet ve yenisini ekle** → *10-A* (düzey 10) → **Kaydet ve yenisini ekle** → *SEVİYE-2* (düzey Seviye-2) → **Kaydet**.
- [ ] Aynı adla ikinci bir sınıf eklemeyi deneyin.
- [ ] Panelde Esc'e basın ya da arka plana tıklayın → panel kapanır.
- [ ] Bir sınıfın adını değiştirip geri alın.
- **Beklenen:**
  - Sınıflar tabloda: Sınıf · Düzey · Öğrenci · Ek üye · Ders · Etüt mesulü. Yeni eklenenler yeşil vurgulu, yanında "eklendi".
  - "Kaydet ve yenisini ekle" düzeyi korur, adı boşaltır.
  - Telefonda tablo yerine iki satırlık liste.
  - Aynı ad: "Bu isimde bir sınıf zaten var."

---

## 3. Personel (öğretmenler, etüt mesulü, yönetici)

Yönetim → **Personel**. Sekmeler: Öğretmenler · Etüt mesulleri · Yönetici.

**Öğretmenler** sekmesi → **+ Öğretmen ekle** → yan panel (ad, branş; "Kaydet ve yenisini ekle" ya da Enter):

| Ad Soyad | Branş |
|---|---|
| Deniz Aksoy | Matematik |
| Burak Tan | Bilişim |
| Murat Ilgın | Din Kültürü / Tecvid |

**Etüt mesulleri** sekmesi → **+ Etüt mesulü ekle** → ad: *Kerem Yalçın*, sorumlu olduğu sınıflar: *9-A, 10-A, SEVİYE-2* (branş alanı yok).

- [ ] Hepsini ekleyin. Sekme sayıları: Öğretmenler (3), Etüt mesulleri (1).
- [ ] Öğretmeni branşsız eklemeyi deneyin → Kaydet pasif / "Öğretmenin branşı gerekli."
- [ ] Etüt mesulleri sekmesinde Kerem Yalçın'ın satırında "9-A, 10-A, SEVİYE-2". Sınıflar tablosunda etüt mesulü görünür.
- [ ] İkinci bir etüt mesulü ekleyip 10-A'yı seçin (çipte "10-A · Kerem Yalçın" yazar) → kaydedince 10-A yeni kişiye geçer, Kerem'de "9-A, SEVİYE-2" kalır.
- [ ] Bir öğretmeni **Düzenle** → rolünü Etüt mesulü yapın → "Etüt mesulleri sekmesine geçer" notu, branş yerine sınıf seçimi → Kaydet → kişi öbür sekmede. Geri Öğretmen yapın → branş ister; sınıfları boşa çıkar.
- [ ] Bir sınıfın etüt mesulü yokken Etüt mesulleri sekmesinde sarı "Etüt mesulü atanmamış sınıflar: …".
- [ ] **Yönetici** sekmesi: kurum hesabının adı ve e-postası.
- [ ] Eski adres `/kurum/ogretmenler` → Personel'e yönlenir.
- [ ] Telefonda (ya da dar pencerede): her kişi iki satır; "Link oluştur" ve "Düzenle" satırın içinde, yana kaydırmak gerekmiyor.

---

## 4. Öğrenciler

**4.1 Tek tek ekleme**
- [ ] Öğrenciler boşken sayfada iki büyük seçenek: "Tek tek ekle" / "Excel'den yükle".
- [ ] **+ Öğrenci ekle** → yan panel; "Öğrenci no" kutusunda sıradaki numara yazılı (boş kurumda *1*). *9001* yapın: Ali Kaya, sınıf 9-A, veli adı / telefonu → **Kaydet ve yenisini ekle** (ya da Enter).
- [ ] Panel açık kalır: numara *9002*, sınıf 9-A dolu, altta "Eklendi: Ali Kaya". (Kaydetmeyin; 9002 aşağıdaki toplu yüklemede geliyor.) **Vazgeç** → listede Ali Kaya yeşil, "1 öğrenci eklendi · Vurguyu kaldır".
- [ ] Listeyi 9-A'ya süzüp **+ Öğrenci ekle** → sınıf 9-A seçili gelir.
- [ ] Zorunlu alanlar (no, ad, soyad) boşken kaydetmeyi deneyin.
- [ ] Aynı numarayla ikinci öğrenci eklemeyi deneyin.

**4.2 Toplu yükleme (yapıştır)**
- [ ] Öğrenciler → **Excel'den yükle** (listenin üstünde açılır) → aşağıdaki tabloyu kopyalayıp yapıştırın (sekmeyle ayrılmış olmasına gerek yok; Excel'den de yapıştırabilirsiniz):

```
Numara	Ad	Soyad	Sınıf	Veli Adı	Veli Telefonu
9002	Elif	Demir	9-A	Ayşe Demir	05550000002
9003	Mert	Şahin	9-A	Hasan Şahin	05550000003
9004	Zeynep	Çelik	9-A	Fatma Çelik	05550000004
9005	Emre	Öztürk	9-A	Ahmet Öztürk	05550000005
9006	Selin	Arslan	9-A	Merve Arslan	05550000006
9007	Can	Doğan	9-A	Mehmet Doğan	05550000007
9008	Ece	Kılıç	9-A	Sema Kılıç	05550000008
9009	Yusuf	Aydın	9-A	İbrahim Aydın	05550000009
9010	Büşra	Koç	9-A	Hülya Koç	05550000010
1001	Ömer	Yıldız	10-A	Kemal Yıldız	05550000011
1002	İrem	Polat	10-A	Nur Polat	05550000012
1003	Furkan	Erdem	10-A	Ali Erdem	05550000013
1004	Sude	Kaplan	10-A	Gül Kaplan	05550000014
1005	Berk	Uçar	10-A	Okan Uçar	05550000015
1006	Ela	Güneş	10-A	Derya Güneş	05550000016
1007	Kaan	Özkan	10-A	Tuncay Özkan	05550000017
1008	Nisa	Turan	10-A	Hacer Turan	05550000018
1009	Eren	Bulut	10-A	Serkan Bulut	05550000019
1010	Esra	Kurt	10-A	Leyla Kurt	05550000020
```

- **Beklenen:** Önizlemede 19 satır; kaydedince 9-A'da 10, 10-A'da 10 öğrenci.
- [ ] Aynı tabloyu tekrar yükleyin → öğrenciler **güncellenir**, kopya oluşmaz.
- [ ] Tabloda bir satırın sınıfını *11-A*, bir başkasınınkini *9a* yapıp **Önizle** → üstte sarı "Yeni sınıf açılacak: 11-A (1 öğrenci), 9A (1 öğrenci)… kurumdaki sınıflar: …" ve satırlarda "yeni" etiketi. Yüklerseniz iki sınıf da açılır. (Sonra öğrencileri geri alın, sınıfları silin.)
- [ ] "Ad" başlığını silip yükleyin → eksik sütun uyarısı.
- [ ] **Numara sütunu olmadan** yükleyin (Numara sütununu silin, 2–3 yeni öğrenci yazın) → önizlemede numara "otomatik"; yükleyince "N öğrenciye sıradaki numara verildi", numaralar en büyük numaradan devam eder.
- [ ] **Şablonu indir** → dosya açılıyor, başlıklar doğru.

**4.3 Ek üye (SEVİYE-2)**
- [ ] Sınıflar → SEVİYE-2 → **+ Başka sınıftan ekle** → 9-A'dan 4, 10-A'dan 4 öğrenci ekleyin (toplam 8).
- [ ] SEVİYE-2 → Etüt mesulü: Kerem Yalçın.
- **Beklenen:** "0 öğrenci · 8 ek üye"; öğrenciler "Başka sınıftan katılanlar" altında ana sınıflarıyla. Öğrenci profilinde "Ayrıca: SEVİYE-2".

---

## 5. Dersler

Ders **yalnızca** Yönetim → Dersler'de açılır. **+ Ders ekle** → yan panel: sınıf(lar)ı seçin, adı yazın, sorumluyu seçin.

| Sınıf | Ders | Tür | Sorumlu | Not |
|---|---|---|---|---|
| 9-A | Matematik | Okul | Deniz Aksoy | |
| 9-A | Bilişim Teknolojileri | Mesleki | Burak Tan | |
| 9-A | Fizik | Okul | Kerem Yalçın | "Başka kurumda alınıyor" işaretli |
| 10-A | Matematik | Okul | Deniz Aksoy | |
| 10-A | Programlama | Mesleki | Burak Tan | |
| SEVİYE-2 | Tecvid | Dini | Murat Ilgın | |
| SEVİYE-2 | İlmihal | Dini | Murat Ilgın | |

- [ ] **Matematik**'i tek seferde ekleyin: panelde hem 9-A hem 10-A'yı seçin → Kaydet → iki satır oluşur.
- [ ] Kalanları ekleyin. "Kaydet ve yenisini ekle" sınıf seçimini ve türü korur.
- [ ] Ad yazarken tür kendiliğinden değişir (Tecvid → Dini, Programlama → Mesleki); türü elle değiştirirseniz bir daha değişmez.
- [ ] Ad kutusunda kurumda daha önce açılmış ders adları önerilir.
- [ ] 9-A'ya ikinci kez "Matematik" eklemeyi deneyin → "9-A: Bu sınıfta bu adla bir ders zaten var."
- [ ] Bir satıra tıklayın → düzenleme paneli; adı değiştirip kaydedin, geri alın.
- [ ] Sınıf sayfası (Sınıflar → 9-A): dersler **salt okunur**; bir derse tıklayınca Dersler'deki düzenleme paneli açılır. "Dersleri düzenle" Dersler'e (9-A süzülü) götürür.
- [ ] ⌘K → "fizik" → ders sonucu düzenleme panelini açar.
- **Beklenen:**
  - Dersler tek tabloda; "Tümü" ve sınıf düğmelerinde sayılar doğru; Fizik "Dışarıda" etiketli; yeni eklenenler yeşil.
  - Sınıf sayfasında yeni derslerin altında gri "Henüz değerlendirme yok" (sarı uyarı değil).

---

## 6. Ders programı

- [ ] Ders programı → 9-A → günün altındaki **+ Saat ekle** → "Ders" listesinde yalnızca 9-A'nın dersleri var; öğretmen dersin sorumlusundan dolu gelir. Haftaya Matematik (2 saat), Bilişim (2 saat) yerleştirin.
- [ ] 10-A → Matematik, Programlama.
- [ ] SEVİYE-2 → Cumartesi Tecvid, Pazar İlmihal.
- [ ] **Bugün** olan güne en az bir ders koyun (sonraki adımlarda yoklama için).
- [ ] Programdan yeni ders **açılamaz**: listede *Robotik* yok → "Dersler sayfasında ekleyin" bağlantısı Dersler'de 9-A seçili ekleme panelini açar → ekleyin → programa dönün, artık listede.
- [ ] Dersi olmayan bir sınıfta "+ Saat ekle" → "Bu sınıfın dersi yok." Kaydet pasif.
- [ ] Türü "Etüt" olan bir ders seçince Tür kendiliğinden "Etüt" olur.
- [ ] Aynı dersi aynı saate ikinci kez ekleyin → "Çakışma: … programda zaten var." Kaydedilmez.
- [ ] Aynı sınıfa aynı saatte başka bir grup dersi ekleyin → "Çakışma: 9-A sınıfında … var." Kaydedilmez.
- [ ] Aynı öğretmeni aynı saatte başka sınıfa koyun → "Çakışma: Deniz Aksoy … dersinde." Kaydedilmez.
- [ ] SEVİYE-2'ye, 9-A'nın dersiyle aynı saatte bir ders koyun (farklı öğretmen) → sarı uyarı: "4 öğrenci (…) aynı saatte 9-A · … dersinde de var." **Yine de kaydet** ile kaydedilir.
- [ ] Bitişik saatler (16:00–16:40 ve 16:40–17:20) → uyarı yok.
- [ ] Sayfanın üstündeki "Programda N çakışma · M uyarı" kutusu: satıra tıklayınca o sınıfın programı açılır, çakışan dersler kırmızı / sarı çerçeveli.
- [ ] Programı olan bir dersi silmeyi deneyin → "Bu dersin programda N saati var…" uyarısı.
- [ ] Öğretmen görünümü (Ders programı → öğretmen) → her öğretmenin haftası doğru.

---

## 7. Takvim, müfredat ve yıllık plan

**7.1 Takvim**
- [ ] Takvim ve planlar → eğitim yılını ayarlayın → **Resmî tatilleri ekle**.
- [ ] **+ Etkinlik**: bir ara tatil haftası ve bir "Veli toplantısı" ekleyin.
- **Beklenen:** Ay / yıl / liste görünümlerinde görünürler. Tatil günü yoklama ekranında "tatil" olarak çıkar.

**7.2 Müfredat**
- [ ] Müfredat → **+ Müfredat ekle** → "Ders" listesinde yalnızca Dersler'de açtığınız dersler var; "Düzey" listesinde sınıflarınızın düzeyleri (9, 10, Seviye-2). *Tecvid* · *Seviye-2* için 8–10 konu girin → Kaydet.
- [ ] Set başlığının altında "Kullanan sınıflar: SEVİYE-2".
- [ ] Düzeyi 9 olan bir Tecvid seti açın → "9. sınıf düzeyinde bu dersi alan sınıf yok" sarı uyarısı.
- [ ] Excel ile yükleyin; dosyada kurumda olmayan bir ders adı (ör. *Tecvıd*) ve düzey (ör. *7*) olsun → önizlemede iki uyarı; aktarım yine yapılır.
- [ ] (İsteğe bağlı) "Örnek müfredatı yükle" → 8. sınıf / 12. sınıf / TYT setleri gelir; hepsinde sarı uyarı çıkar ("Kurumda bu adla ders yok" ya da "Bu düzeyde bu dersi alan sınıf yok"), çünkü örnekler bu kurumun sınıflarıyla eşleşmez.

**7.3 Yıllık plan**
- [ ] Takvim ve planlar → Yıllık ders planı → **+ Yeni plan** → SEVİYE-2 · Tecvid (ders listeden seçilir), konular müfredattan.
- **Beklenen:** Konular haftalara dağıtılır, tatil haftası atlanır.
- [ ] **Haftalık planı içe aktar** → `notes/ornek-haftalik-plan.csv`.
- **Beklenen:** Sınıf / ders adları bu kurumda farklıysa "Bu adla ders yok" uyarısı çıkar; uyarıya rağmen anlaşılır biçimde ilerlenebilir.

---

## 8. Puan cetvelleri

- [ ] Puan cetvelleri → boş durumda "Henüz cetvel yok. Sağdaki hazır örneklerden başlayabilirsiniz." görünür.
- [ ] Hazır örneklerden bir **sözlü** ve bir **yazılı** cetvel oluşturun.
- [ ] **+ Yeni cetvel** → kendi cetvelinizi kurun (*Ezber*, 3 kriter).
- [ ] Bir kriterin puanını 0 yapıp kaydetmeyi deneyin → "1–100 arası tam sayı" hatası.
- [ ] **Kontrol:** cetvel yokken öğretmenin "Başlat" ekranındaki mesaj, cetvellerin *şu anki* menü yerini doğru söylüyor mu? (Mesajda "Sözlü ve yazılı → Puan cetvelleri" yazıyor; menüde artık Yönetim → Puan cetvelleri.) Bunu 8. adımdan **önce** öğretmen linkiyle görmek isterseniz 9.1'i öne alın.

---

## 9. Öğretmen telefonda

**9.1 Giriş linki**
- [ ] Personel → Murat Ilgın, Burak Tan (Öğretmenler sekmesi) ve Kerem Yalçın (Etüt mesulleri sekmesi) için giriş linki oluşturun → **Kopyala**.
- [ ] Gizli pencerede Burak Tan'ın linkini açın.
- **Beklenen:** Doğrudan "Bugün" ekranı; üstte "Burak Tan · Öğretmen".

**9.2 Yoklama**
- [ ] Bugünkü derse girin → 2 öğrenciyi "gelmedi", 1'ini "geç" işaretleyin → Kaydet.
- [ ] Derse yeniden girin → işaretler yerinde.
- [ ] ‹ › ile geçmiş bir güne gidin, o günün dersi "eksik giriş" olarak görünüyor mu?

**9.3 İşlenen konu**
- [ ] Murat Ilgın → Tecvid dersi (gerekirse ‹ › ile Cumartesiye) → "Bu derste işlenen konu" → bir konu işaretleyin.
- **Beklenen:** Kart "Konu işlendi" olur; yönetici tarafında planda o konu "işlendi".

**9.4 Sözlü / yazılı**
- [ ] Murat Ilgın → Sözlü ve yazılı → SEVİYE-2 · Tecvid → **+ Başlat** → Sözlü, *Ezber* cetveli.
- [ ] 8 öğrencinin 7'sine puan verin, 1'ine "Gelmedi"; birinin puanını **çok düşük** verin (uç değer testi için).
- **Beklenen:** "Kaydet ve sonraki" sıradaki öğrenciyi açar; üstte "x/8 girildi · ort. %" güncellenir.

**9.5 Ödev**
- [ ] Burak Tan → 9-A Bilişim → **+ Ödev ver** → kaydet → "10 öğrenciye atandı".
- [ ] Yönetici → Ödevler → Yeni ödev: "Ders" artık yazılmıyor, seçilen sınıfın derslerinden seçiliyor; sınıf değişince liste değişir.
- [ ] Yönetici → Yoklama → **Ek ders ekle**: ders sınıfın derslerinden seçilir.
- [ ] Ödeve dokunun → durumları işaretleyin.

**9.6 Etüt mesulü**
- [ ] Kerem Yalçın'ın linki → 9-A · Fizik (Dışarıda) → Yazılı başlatın, başlık *Okul 1. yazılı* → notları girin.
- [ ] Üstte **Takip** → kapsam "9-A, 10-A, SEVİYE-2".

**9.7 Yetki**
- [ ] Öğretmen oturumunda `/kurum` yazın → `/ogretmen`e döner.
- [ ] Başka öğretmenin ders adresini deneyin → 404.

---

## 10. Denemeler ve optik

- [ ] Denemeler ve optik → **Yeni deneme** → serbest deneme, 20 soru, A–B kitapçık → cevap anahtarında **Rastgele doldur**.
- [ ] Denemeyi 9-A · Matematik dersine bağlayın.
- [ ] Optik form sekmesi → **Örnek taranmış form üret** → okutun → kaydedin.
- [ ] Okuyucu dosyası (TXT) → **Örnek okuyucu dosyası üret** → içe aktarın.
  - `notes/ornek-fmt.txt` bu kurumun öğrenci numaralarıyla eşleşmez; yüklerseniz tüm satırlar "eşleşmeyen" çıkmalı (doğru davranış).
- **Beklenen:** Sıralı liste, karne, sınıf ortalamaları, madde analizi açılıyor.
- [ ] 8 kişiden az sonuçla "Uç değerleri ayır" → "kişi sayısı az, ayrılmadı".

---

## 11. Takibat (yönetici)

- [ ] **Takip** → Dikkat isteyenler: 9.2'deki devamsızlar ve 9.4'teki düşük puanlı öğrenci gerekçeleriyle görünüyor.
- [ ] Sağ panel: girişi eksik dersler, plana göre geride kalanlar, sözlü/yazılı yapılmayan dersler.
- [ ] Sınıflar / Dersler / Öğretmenler sekmeleri.
- [ ] Sözlü ve yazılı → Tecvid değerlendirmesi → **Uç değerleri ayır** → düşük puan "uç ↓" ile işaretli (grup 8 kişi, sınırda).
- [ ] Analiz → Başarı Skoru, Devam raporları.
- [ ] Öğrenci profili (9.4'te puan verilen bir öğrenci): yoklama, sözlü/yazılı, ödev, deneme bölümleri dolu.

---

## 12. Veli

- [ ] Veli karnesi → SEVİYE-2'den bir öğrenci → **Yeni bağlantı üret** → gizli pencerede açın.
- **Beklenen:** Devam, sözlü/yazılı, ödev, deneme bilgileri.
- [ ] Haftalık veli raporu → aynı öğrencinin mesaj önizlemesi → **Öğretmen notu ekle** → WhatsApp / kopyala.

---

## 13. Arama ve gezinme

- [ ] ⌘K → *ozturk* (Emre Öztürk), *9005*, *ela 10-a*, *tecvid*, *murat*, *yoklama*.
- [ ] Menüde her grup masaüstünde kaydırmadan sığıyor; telefonda menü açılıp kapanıyor.

---

## 14. İzolasyon ve silme

- [ ] İkinci bir hesap açın (*test2@kurum.local*) → boş kurum gelir; ilk kurumun bir sınıf / öğrenci adresini deneyin → 404.
- [ ] İlk kurumda öğretmen linkini **Yenile** → eski link "geçersiz"; açık oturum düşer.
- [ ] Bir öğrenciyi silin / sınıftan çıkarın → yoklama, not ve ödev ekranları hata vermiyor.
- [ ] Bir öğretmeni silmeyi deneyin (dersi ve programı varken) → uyarı mı, engelleme mi? Anlaşılır mı?

---

## Sorun kaydı

| # | Adım | Ne oldu | Beklenen | Önem (Y/O/D) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
