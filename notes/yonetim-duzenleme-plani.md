# Yönetim düzenleme planı

Kaynak: sıfırdan kurulum testinden gelen geri bildirimler (8 Kasım 2026). Test verisi: `prisma/test.db`.

---

## 1. Tespitler (kod ve test DB incelemesi)

### 1.1 Ders dört yerden oluşuyor

| Nerede | Nasıl | Sorun |
|---|---|---|
| Sınıf sayfası → Dersler kutusu | Ders formu (`CourseManager`) | Dersler sayfasıyla **aynı bileşen**, iki giriş noktası |
| Yönetim → Dersler | Aynı form | ↑ |
| Ders programı → "+ Ders ekle" | **Serbest metin** ders adı; o adla ders yoksa kendiliğinden oluşur (`courseIdFor`) | Yazım farkı yeni ders açar. Ad alanı öğretmenin **branşıyla** dolu gelir: test DB'de S-2'ye "Dahili" adlı, türü *Okul* olan bir ders bu yoldan açılmış |
| Müfredat → "Yeni ders müfredatı" | Serbest metin ders adı | Ders oluşturmaz ama öyle görünür; mevcut derslerle bağlantısı yok |

Ödev ve yıllık plan formlarında da ders adı serbest metin (öneri listesi var, zorunlu değil). Ad tutmazsa ödev hiçbir derse bağlanmaz.

### 1.2 Ders programında kontrol yok
`parseSlot` yalnızca saat biçimine bakıyor. Test DB'de:
- S-2, Pazartesi 16:00–16:40, Dahili, Burak Kara → **aynı kayıt 3 kez**
- 10-A'da aynı saatte 3 ders
- Burak Kara aynı saatte hem 10-A'da hem S-2'de

### 1.3 Müfredat düzeyleri sabit
Düzey listesi koda yazılı: 5–12, LGS, TYT, AYT (`CURRICULUM_GRADES`). Kurumun sınıf düzeyleri ("Seviye-2" gibi) listede yok. Bu yüzden Seviye-2 müfredatı girilemiyor ya da hiçbir sınıfla eşleşmiyor.

### 1.4 Kişiler
- Öğretmen ve etüt mesulü aynı tabloda (`Teacher.role`) ve **branş zorunlu**. Etüt mesulü için branşın anlamı yok; test DB'de "S2", "Dahili" gibi doldurulmuş.
- Yönetici = kayıt olan tek hesap. Birden fazla yönetici olamıyor.
- Öğrenciler ayrı sayfada; giriş yapmıyorlar (veli linki var).

### 1.5 Ekleme kalıpları her sayfada farklı

| Sayfa | Ekleme biçimi |
|---|---|
| Sınıflar | Sağda sabit form; liste büyük kartlar |
| Öğretmenler | Sağda sabit form; liste tablo |
| Öğrenciler | Sekmeler: Liste / Tek tek ekle / Excel'den yükle |
| Dersler | Liste içinde satır formu |
| Ders programı | Açılır pencere |

Öğrenci numarası elle giriliyor (1–6 hane, optik formdaki 6 hane yüzünden). Boş kurumda kurulum sırasını (sınıf → öğretmen → öğrenci → ders → program) gösteren bir yer yok.

---

## 1b. UX değerlendirmesi (ekran görüntüleriyle, 1280×800 ve 390×844)

**Bağlam.** Kullanıcı: yönetici ya da etüt mesulü. Yönetim ekranları yılda bir kez yoğun kullanılır (kurulum), sonra ara sıra düzeltme için açılır. Bu yüzden öncelik toplu ve hızlı giriş, hatanın baştan önlenmesi ve kayıtların tek yerde durmasıdır. Ekranların süslü olması gerekmez. Telefon ikincil ama ekranlar telefonda da çalışmalı.

Önem derecesi: 3 = büyük sorun, 2 = küçük sorun, 1 = görünüm.

| # | Sorun | İlke | Önem | Çözüm (aşama) |
|---|---|---|---|---|
| U1 | "Ders" dört ekranda dört farklı biçimde oluşuyor. Müfredat'taki düğme ve sol listedeki madde sözcüğü sözcüğüne **"+ Yeni ders"** | Tutarlılık (H4), zihinsel model, etiket açıklığı | 3 | Ders tek yerde oluşur, müfredat düğmesi "Müfredat ekle" olur (2, 3) |
| U2 | Programa aynı ders 3 kez eklenebiliyor; aynı öğretmen aynı saatte iki sınıfta görünebiliyor; uyarı yok | Hata önleme (H5) | 3 | Çakışma kontrolü ve çakışma listesi (1) |
| U3 | Program formunda ders adı serbest metin ve öğretmenin **branşıyla dolu** geliyor. "Dahili" böyle ders oldu | Hatırlama yerine tanıma (H6), iyi varsayılan (Tesler) | 3 | Sınıfın derslerinden seçim (2) |
| U4 | Öğretmenler telefonda: Haftalık ders, **Giriş linki**, Düzenle ve Sil sütunları ekranın dışında kalıyor. Linki kopyalamak için yatay kaydırmak gerekiyor | Mobil uyum, Fitts | 3 | Telefonda iki satırlık liste, işlemler satırın içinde (1) |
| U5 | Sınıflar kartları yandaki formun yüksekliğine uzuyor: 3 sınıf ekranın yarısını kaplıyor, ders sayısı görünmüyor | Bilgi yoğunluğu (H8) | 2 | Tablo (1) |
| U6 | Kenar çubuğunda 800 px yükseklikte Yönetim'in son üç maddesi (Takvim ve planlar, Müfredat, Puan cetvelleri) görünmüyor; altta başka madde olduğuna dair ipucu yok | Sahte zemin, sistem durumunun görünürlüğü (H1) | 2 | Menü aralıklarını sıkılaştırmak (4) |
| U7 | Öğrenci ekleme bir **sekme**: eylem, gezinme gibi görünüyor. Kayıttan sonra öğrenci listede görünmüyor, yalnızca bir yazı çıkıyor | Görünürlük (H1), tepe-son kuralı | 2 | Listeden "+ Öğrenci ekle" düğmesi, kayıttan sonra satır vurgulanır (4) |
| U8 | Öğrenci no boş geliyor, sınıf "— Sınıfsız —" ile geliyor. Arka arkaya girişte her seferinde ikisi de elle seçiliyor | İyi varsayılan (Tesler), verimlilik (H7) | 2 | Sıradaki numara; son seçilen sınıf ya da süzgeçteki sınıf (1, 4) |
| U9 | Etüt mesulünden branş isteniyor; listede "S2", "Dahili" gibi anlamsız değerler var | Gerçek dünyaya uyum (H2) | 2 | Rol etüt mesulüyse branş alanı gizlenir (1) |
| U10 | Boş kurumda Özet "Bugün programda ders yok" diyor; kurulumun hangi adımda olduğu görünmüyor | Boş sayfa deseni, hedef eğimi | 2 | Kurulum rehberi (4) |
| U11 | Sınıf sayfasında yeni açılan 6 dersin hepsinde turuncu "Son 30 günde sözlü / yazılı yok" uyarısı. Her şey uyarı olunca hiçbir şey öne çıkmıyor | Von Restorff, uyarı yorgunluğu | 2 | 30 günden yeni derste gri "Henüz değerlendirme yok" (2) |
| U12 | Ekleme kalıpları farklı: sağda form (Sınıflar, Öğretmenler), sekme (Öğrenciler), satır formu (Dersler), açılır pencere (Program). Telefonda sağdaki form listenin **altına** düşüyor; düğme aşağıda kalıyor | Tutarlılık (H4), Jakob | 2 | Tek kalıp: başlıkta "+ Ekle", yan panel / telefonda tam ekran (4) |
| U13 | "Link oluştur" düğmesi iki satıra kırılıyor | Görsel | 1 | Kısa etiket ("Link") ya da `whitespace-nowrap` (1) |
| U14 | Ders programı telefonda 7 gün alt alta, çok uzun | Bilgi yoğunluğu | 1 | Sonra: telefonda gün seçici |

**Seçilen desen (U7, U12):** liste + başlıkta "+ Ekle" → masaüstünde sağdan açılan panel, telefonda tam ekran. Ekranda iki düğme olur: **Kaydet** (listeye döner, yeni satır vurgulanır) ve **Kaydet ve yenisini ekle** (form açık kalır, sınıf korunur, numara bir artar). Hatalar alanın altında, kaydetmeden önce gösterilir. Sağdaki sabit formlar kalkar; liste tam genişliği kullanır.

Neden bu desen: kurulum yılda bir kez yapılan, kısa süreli bir iş. Kullanıcı listeden kopmamalı ve sonucu hemen listede görmeli. Sekme ya da ayrı sayfa, kullanıcıyı listeden uzaklaştırıyor. Satır içi düzenleme ise telefonda sıkışıyor.

---

## 2. İlkeler

1. **Her kayıt tek yerde oluşur.** Başka ekranlar onu yalnızca **seçer**. Serbest metinle kayıt oluşmaz.
2. **Tek ekleme kalıbı:** liste sayfası, başlıkta "+ Ekle" düğmesi. Masaüstünde yandan açılan panel, telefonda tam ekran. Kaydedince listeye dönülür, yeni satır vurgulanır.
3. **Listeler tablo olur, kart olmaz.** Telefonda tablo, iki satırlık liste satırına dönüşür (Öğrenciler sayfasındaki gibi).
4. **Hata kaydetmeden önce yakalanır:** çakışma, kopya kayıt, eksik bağlantı.

---

## 3. Aşamalar

Her aşama ayrı bir commit olacak. Her aşamada `notes/test-senaryosu-sifirdan.md` ve kroki güncellenecek.

### Aşama 0: Kroki dosyası ✓
Yapıldı: `KROKI.md`. Önerilen dosya: `KROKI.md` (kökte, ARCHITECTURE.md'nin yanında). ARCHITECTURE.md kodu anlatır; kroki **ürünü** anlatır:

- **Kayıtlar:** her kayıt türü için nerede oluşur, nerede düzenlenir, nerede kullanılır, kim yapabilir, hangi kod dosyası.
- **Sayfa haritası:** menü ağacı; her sayfanın işi ve üzerindeki düğmeler.
- **Rol tablosu:** sayfa / işlem × Yönetici · Etüt mesulü · Öğretmen · Veli.

Örnek bölüm:

```
## Ders (Course)        — sınıfın dersi; (sınıf, ad) tektir
| İşlem            | Nerede                        | Kim                         |
|------------------|-------------------------------|-----------------------------|
| Ekle/düzenle/sil | Yönetim → Dersler             | Yönetici, etüt mesulü       |
| Görüntüle        | Sınıf sayfası (salt okunur)   | Yönetici, etüt mesulü       |
| Seçilir          | Ders programı, Ödev, Yıllık plan, Sözlü/yazılı, Deneme |  |
Kod: modules/schedule/internal/courses.ts · ui/CourseManager.tsx
```

Önce mevcut durum yazılır, tutarsızlıklar "⚠" ile işaretlenir. Sonraki aşamalar bitince ⚠'ler kalkar. Benim için de her değişiklikten önce okunacak tek yer olur.

### Aşama 1: Hızlı düzeltmeler (düşük risk) ✓
- [x] **Program çakışma kontrolü.** Kaydetmeden önce:
  - aynı sınıfta saat çakışması → engelle ("10-A'da 16:00–16:40 arası Dahili var")
  - aynı öğretmen aynı saatte başka sınıfta → engelle
  - ek üye öğrencinin ana sınıfında aynı saatte ders var → **uyarı** (SEVİYE-2 gibi gruplarda bilerek yapılabilir)
- [x] **Mevcut çakışmalar:** Ders programı sayfasının üstünde "N çakışma · M uyarı" listesi; satıra tıklayınca o sınıfın programı açılır, çakışan dersler kırmızı (kesin) / sarı (uyarı) çerçeveli. Test DB'deki kopyalar buradan temizlenir.
- [x] **Etüt mesulünde branş yok.** Rol "Etüt mesulü" seçilince branş alanı gizlenir; listede "—" görünür. Veritabanında branş boş olabilir.
- [x] **Öğrenci no otomatik.** Form açılınca sıradaki numara (en büyük numara + 1) yazılı gelir ve değiştirilebilir. Excel'de Numara sütunu yoksa ya da boşsa numaralar sırayla verilir. Sınır 6 hane (optik form).
- [x] **Sınıflar listesi:** kartlar yerine tablo. Sütunlar: Sınıf · Düzey · Öğrenci (+ek üye) · Ders · Etüt mesulü. Telefonda iki satırlık liste. "Yeni sınıf" başlıktaki düğmeyle yan panelde açılıyor (aşama 4 kalıbının ilk örneği, ortak bileşen `shared/ui/Drawer.tsx`).
- [x] **Öğretmenler telefonda (U4, U13):** iki satırlık liste; giriş linki ve Düzenle satırın içinde. "Link oluştur" tek satırda.

### Aşama 2: Ders tek yerde
- [ ] **Yönetim → Dersler tek ekleme yeri.** Bütün sınıfların dersleri tek tabloda: Sınıf · Ders · Tür · Sorumlu · Haftalık saat. Sınıf süzgeci ve "+ Ders ekle" var.
- [ ] **Sınıf sayfası:** dersler salt okunur liste olur. Son 30 gün değerlendirme özeti kalır. "Dersleri düzenle" bağlantısı → `/kurum/dersler?sinif=…`
- [ ] **Ders programı:** "Ders adı" metin kutusu yerine **sınıfın derslerinden seçim**. Öğretmen, dersin sorumlusundan dolu gelir; değiştirilebilir. Ders listede yoksa "Ders ekle" bağlantısı. Programdan kendiliğinden ders açılması kalkar (eski verileri bağlayan `syncCourses` kalır).
- [ ] **Ödev ve yıllık plan:** ders seçimi sınıfın derslerinden. Serbest metin kalkar.
- [ ] **Kullanılmayan dersler:** Dersler tablosunda programda saati, ödevi ya da değerlendirmesi olmayan derslere "kullanılmıyor" etiketi. Test DB'deki "Dahili (Okul)" gibi kayıtlar buradan görülüp silinir.

### Aşama 3: Müfredat
- [ ] **Müfredat ders açmaz.** "Yeni ders müfredatı" → "Müfredat ekle". Ders adı kurumdaki ders adlarından seçilir (sınıflar arası tekil liste).
- [ ] **Düzey listesi:** kurumun sınıf düzeylerinden gelir (9, 10, Seviye-2 …). LGS / TYT / AYT, kurumda o türde deneme ya da 8. / 12. sınıf varsa listede kalır.
- [ ] **Bağlantı göstergesi:** müfredat sayfasında "Bu müfredatı kullanan sınıflar: 9-A, 9-B" (düzey + ders adı eşleşmesi).

### Aşama 4: Ortak ekleme kalıbı ve kurulum rehberi
- [ ] **Excel'den yükleme yeni sınıf açacaksa** önizlemede "Yeni sınıf açılacak: 11-A" uyarısı (yazım hatası sessizce sınıf açmasın).
- [ ] **Öğrenciler:** sekmeler kalkar; sayfa doğrudan listedir. Başlıkta "+ Öğrenci ekle" (birincil) ve "Excel'den yükle" (ikincil).
  - "+ Öğrenci ekle" → panel. **Kaydet** → panel kapanır, listede yeni satır vurgulanır, "Ali Kaya eklendi" bildirimi. **Kaydet ve yenisini ekle** → panel açık kalır, sınıf seçimi korunur, numara bir artar. Arka arkaya giriş için.
  - Excel'den yükle → panel. Bitince listeye dönülür: "19 öğrenci eklendi, 2 güncellendi".
  - Liste boşken iki büyük seçenek: "Tek tek ekle" / "Excel'den yükle".
- [ ] **Aynı kalıp** Sınıflar, Personel ve Dersler sayfalarında. Sağdaki sabit formlar kalkar.
- [ ] **Kurulum rehberi (Özet sayfası):** kurum yeniyken adımlar ve sayılar:
  Sınıflar (3) ✓ → Personel (4) ✓ → Öğrenciler (0) → Dersler → Ders programı → Takvim. Her adımda bağlantı var. Hepsi tamamlanınca rehber kaybolur.

### Aşama 5: Kullanıcı yönetimi
Öneri (PoC'ye uygun, en hafif yol):
- [ ] **Yönetim → Personel** ("Öğretmenler" sayfasının yerine). Sekmeler: **Yöneticiler · Etüt mesulleri · Öğretmenler**. Her rolün kendi formu var:
  - *Öğretmen:* ad, branş, telefon, giriş linki
  - *Etüt mesulü:* ad, telefon, **sorumlu olduğu sınıflar** (buradan da atanabilir), giriş linki. Branş yok.
  - *Yönetici:* ad, e-posta, şifre. Bunun için kurum ile hesap ayrılmalı: yeni bir "kurum üyeliği" tablosu gerekir (veri modeli değişikliği).
- [ ] **Öğrenciler** ayrı sayfa olarak kalır (çok sayıda kayıt, kendi akışları var). Menüde "Kişiler" başlığı altında Personel ile yan yana durur.
- [ ] Rol değişikliği (öğretmen ↔ etüt mesulü) Personel'de tek tıkla yapılır; giriş linki korunur.

---

## 4. Kararlar (8 Kasım 2026: önerilenler kabul edildi)

1. **Kullanıcı yönetimi:** Personel sayfası (etüt mesulü / öğretmen ayrımı, branşsız etüt mesulü). Birden fazla yönetici ve öğrenci girişi sonraya kaldı.
2. **Öğrenciler** ayrı sayfa olarak kalır; menüde Personel'in yanında durur.
3. **Programda listede olmayan ders:** "Ders ekle" bağlantısı Dersler sayfasına götürür.
4. **Öğrenci no:** otomatik gelir, düzeltilebilir.

## 5. Sıra

0 → 1 → 2 → 3 → 4 → 5. Kararlar verildi; aşamalar sırayla yapılır.
