# Test senaryoları: Soru havuzu ve yapay zekâ bağlantısı

Dal: `dahili-ders-takip`. 17 Kasım 2026'da eklenen özellikler:

- aynı / benzer soru tespiti,
- deneme kurarken uyarı,
- yanlışlara benzer soru önerisi,
- onay ekranı,
- kesilmiş sorulara metin ve görsel parmak izi,
- **vurgu** gösterimi,
- uzaktan MCP.

Her maddenin başındaki kutuyu işaretleyin: `[x]` geçti, `[!]` sorun var. Sorunları en alttaki **Sorun kaydı** tablosuna, senaryo numarasıyla yazın.

---

## 0. Hazırlık

- [ ] Demo veritabanını yedekleyin; senaryolar havuza soru ekler ve siler: `cp prisma/dev.db prisma/dev.db.yedek`. Bitince geri almak için: `cp prisma/dev.db.yedek prisma/dev.db`.
- [ ] Uygulamayı başlatın: `npm run dev` ve http://localhost:3000 adresini açın. Giriş: **demo@sinavkur.com / demo1234**.
- [ ] Soru havuzunu açın: Menü → **Soru havuzu**. Sayfa hatasız açılmalı. Üstte "Yapay zekâ bağlantısı", "Havuzdan sınav", "Kaynaktan soru kes" ve "+ Soru yaz" görünür.

> `npm run db:seed` soru havuzunu silmez. Demo havuzunda yapay zekâ ile eklenmiş, onay bekleyen sorular (10. sınıf Matematik, Seviye-2 İlmihal) ve bir kaynaktan kesilmiş 10 soru var.

**Senaryolarda kullanılan örnek sorular**

| Ad | Ders / düzey | Metin | Şıklar | Cevap |
|---|---|---|---|---|
| **S1** | İlmihal / Seviye-2 | Aşağıdakilerden hangisi İmanın Şartları arasında yer almaz? | Meleklere iman · Kitaplara iman · Namaz kılmak · Ahiret gününe iman | C |
| **S2** | Matematik / 9 | Bir sınıfta 24 öğrenci vardır. Öğrencilerin 3/8'i kızdır. Sınıfta kaç erkek öğrenci vardır? | 9 · 12 · 15 · 18 | C |
| **S3** | Matematik / 9 | Bir sınıfta 32 öğrenci vardır. Öğrencilerin 3/8'i kızdır. Sınıfta kaç erkek öğrenci vardır? | 12 · 16 · 20 · 24 | C |

S1 demo havuzunda zaten var (onaylı). S2'yi siz ekleyeceksiniz (A2).

---

## A. Soru yazarken tekrar kontrolü

**A1. Havuzda olan soruyu yeniden yazma**
- [ ] **Adımlar:** + Soru yaz → ders *İlmihal*, düzey *Seviye-2*, tür çoktan seçmeli → **S1**'i aynen yazın → **Kaydet ve yenisini yaz**.
- **Beklenen:**
  - Kayıt durur. Sarı uyarı çıkar: "Bu soru havuzdaki “Aşağıdakilerden hangisi İmanın Şartları…” sorusuyla aynı görünüyor."
  - Uyarıda **Yine de kaydet** ve **Vazgeç** düğmeleri var.
- [ ] **Vazgeç** → uyarı kapanır, yazdıklarınız silinmez.
- [ ] Tekrar Kaydet → **Yine de kaydet** → "Kaydedildi."

**A1b. Kelimesi değişmiş kopya**
- [ ] **Adımlar:** S1'i "yer almaz?" yerine "yer almamaktadır?" diye yazıp kaydedin.
- **Beklenen:** Büyük ihtimalle yine "aynı görünüyor" uyarısı çıkar.
- Uyarı çıkmazsa sorun değil; yöntemin hassasiyetini ölçüyoruz. Sorun kaydına "A1b yakalanmadı" diye yazın ve **Vazgeç**'e basın.

**A2. Benzer soru kaydı durdurmaz**
- [ ] **Adımlar:** **S2**'yi yazıp kaydedin (Matematik / 9). Ardından **S3**'ü yazıp kaydedin.
- **Beklenen:**
  - İkisi de uyarısız kaydedilir; benzer soru kaydı durdurmaz.
  - Havuzda S2 ve S3 kartlarında **Benzeri var** rozeti görünür.

**A3. Olumsuz kök, farklı cevap**
- [ ] **Adımlar:** S1'in metnini "…arasında **yer alır**?" yapın, şıklar aynı, cevap **A** (Meleklere iman) → Kaydet.
- **Beklenen:**
  - Uyarı çıkmaz; cevap farklı olduğu için aynı soru sayılmaz.
  - Kartında **Benzeri var** görünür.

**A4. Şıkları karıştırılmış kopya**
- [ ] **Adımlar:** S1'i şıkların sırasını değiştirerek yazın: Namaz kılmak · Meleklere iman · Kitaplara iman · Ahiret gününe iman, cevap **A** → Kaydet.
- **Beklenen:** "aynı görünüyor" uyarısı çıkar. Cevap harfi farklı olsa da doğru şıkkın metni aynı. **Vazgeç**.

**A5. Yapıştır ve böl: aynı gönderimde iki aynı soru**
- [ ] **Adımlar:** + Soru yaz → "Yapıştır ve böl" → ders *Matematik*, düzey *9* → şunu yapıştırın:
  ```
  1. Bir kitabın 120 sayfasının 2/5'i okunmuştur. Okunmayan kaç sayfa vardır?
  A) 48  B) 60  C) 72  D) 80
  Cevap: C

  2. Bir kitabın 120 sayfasının 2/5'i okunmuştur. Okunmayan kaç sayfa vardır?
  A) 48  B) 60  C) 72  D) 80
  Cevap: C
  ```
  → **2 soruyu havuza kaydet**.
- **Beklenen:**
  - "2. soru, 1. soruyla aynı görünüyor." uyarısı ve **Yine de kaydet** düğmesi çıkar.
  - **Vazgeç** ile çıkın, 2. soruyu metinden silin, tekrar kaydedin → "1 soru havuza eklendi."

**A6. Vurgu**
- [ ] **Adımlar:** Bir soru yazın: "Aşağıdakilerden hangisi asal sayı **değildir**?" (yıldızlarıyla), şıklar 2 · 3 · 4 · 5, cevap C → Kaydet.
- **Beklenen:**
  - Önizlemede ve havuz kartında "değildir" kalın görünür, yıldız görünmez.
  - Soru ayrıntısının başlık satırında da yıldız görünmez.
- [ ] Şıklardan birine `2*3` yazın → yıldız olduğu gibi kalır (eşi olmayan yıldız vurgu sayılmaz).

---

## B. Havuz kartı ve soru ayrıntısı

**B1. Rozetler**
- [ ] **Adımlar:** Havuzda A1 ile kaydettiğiniz S1 kopyasını bulun.
- **Beklenen:** Kartta sarı **Aynısı var** rozeti var; S2 / S3'te gri **Benzeri var**.

**B2. Benzer sorular listesi**
- [ ] **Adımlar:** **Aynısı var** rozetine tıklayın.
- **Beklenen:**
  - Sağda "Soru ayrıntısı" açılır. "Benzer sorular" bölümünde orijinal S1, **Aynı soru** etiketiyle görünür.
  - S3 için **Benzer soru** etiketiyle S2 görünür.
- [ ] Listedeki **Düzenle** bağlantısı yazma ekranını o soruyla açar.

**B3. Temizlik**
- [ ] S1 kopyasını kartı seçip **Sil** ile silin → orijinal S1'deki **Aynısı var** rozeti kaybolur.

---

## C. Onay ekranı (yapay zekâ ile eklenen sorular)

**C1. Gruplar**
- [ ] **Adımlar:** Havuz → Durum: **Onay bekleyen** → Filtrele.
- **Beklenen:**
  - Süzgeçlerin altında bir satır: Hepsi · Havuzda aynısı var · Agent notu var · Anahtarsız, agent çözdü · Cevabı eksik · Sorunsuz görünen. Her birinin yanında sayı var.
  - Sayısı 0 olan gruplar soluk görünür.
- [ ] Her gruba tıklayın → liste o gruba göre değişir. "Listedeki n sorunun tümünü onayla" düğmesindeki n, grubun sayısıyla aynı.

**C2. Agent notu ve cevap kaynağı**
- [ ] **Agent notu var** grubu → kartlarda sarı "Agent notu:" kutusu var. Notlarda "Kaynakta cevap anahtarı yok…" cümlesi **yok**; yalnızca gerçek şüpheler var.
- [ ] **Anahtarsız, agent çözdü** grubu → kartlarda sarı **Cevabı agent çözdü** rozeti var.

**C3. Grup süzgeçle birlikte**
- [ ] **Adımlar:** Bir grup seçiliyken Ders süzgecini *İlmihal* yapıp **Filtrele**.
- **Beklenen:** Seçili grup korunur, sayılar yalnızca İlmihal'e göre değişir.

**C4. Tek soru: onayla / sil**
- [ ] Bir kartta **Onayla** → "1 soru onaylandı…". Soru listeden çıkar, Hepsi sayısı 1 azalır.
- [ ] Başka bir kartta **Sil** → onay sorusu → silinir.

**C5. Toplu onay**
- [ ] **Agent notu var** grubunda **Listedeki n sorunun tümünü onayla** → onay penceresinde "…incelenmesi gereken bir durum var" uyarısı çıkar. **İptal**.
- [ ] **Sorunsuz görünen** grubunda aynı düğme (koyu) → uyarısız onay sorusu → onaylanır; grup 0 olur.

**C6. Havuzda aynısı var grubu**
- [ ] **Adımlar:** Bu grup boşsa önce MCP ile bir tekrar ekleyin (H4), sonra bu senaryoya dönün.
- **Beklenen:**
  - Kartın alt şeridinde "Havuzda aynısı var: karşılaştırın" yazar. Tıklayınca ayrıntı panelinde orijinal görünür.
  - Grubun üstünde **Listedeki n soruyu sil** düğmesi var.

---

## D. Deneme kurarken uyarı

**D1. Aynı soru çifti**
- [ ] **Adımlar:**
  1. A1'deki gibi S1'in bir kopyasını **Yine de kaydet** ile ekleyin.
  2. **Havuzdan sınav** → Ders: *İlmihal* → S1'e tıklayın.
- **Beklenen:**
  - Havuzda kopyanın kartının altında sarı "Aynı soru: seçilen Genel 1" yazar.
  - Kopyayı da ekleyin → seçilen listede iki soruda da "Aynısı denemede: Genel …" görünür.
  - Düğmenin yanında "1 çift aynı soru" yazar.
- [ ] Deneme adı yazıp **Denemeyi oluştur** → "1 çift aynı soru var… Yine de oluşturulsun mu?" onayı çıkar. **İptal**.

**D2. Benzer soru çifti**
- [ ] **Adımlar:** Ders: *Matematik* → S2 ve S3'ü ekleyin.
- **Beklenen:** "Benzeri denemede" uyarısı ve "1 çift benzer soru" yazar. Oluştururken onay **sorulmaz**.

**D3. Rastgele ekleme**
- [ ] **Adımlar:** S2 seçiliyken "Rastgele ekle"ye büyük bir sayı yazıp (ör. 30 orta) ekleyin.
- **Beklenen:** S3 (S2'nin benzeri) eklenmez.

**D4. Çalışma kağıdı**
- [ ] "Çalışma kağıdı" seçin → düğme **Çalışma kağıdını oluştur (n soru)** olur.

---

## E. Yanlışlara benzer soru önerisi

**E1. Hazırlık: havuzdan sonuçlu deneme**
- [ ] **Adımlar:**
  1. Havuzda S1'in bir kopyası (A1, **Yine de kaydet**) ve A3'teki "yer alır" sorusu olsun. Bunlar denemeye **girmeyecek**, aday olarak çıkacaklar.
  2. Havuzdan sınav → Ders: *İlmihal* → yalnızca **S1**'i ve birkaç başka İlmihal sorusu ekleyin → ad: *Benzer test* → **Denemeyi oluştur**. D1'deki onay çıkarsa kopyayı denemeden çıkarın.
  3. Deneme sayfası → **Okuyucu dosyası (TXT)** → **🧪 Örnek okuyucu dosyası üret** → kaydedin.
- **Beklenen:** Sonuçlar gelir (rastgele doğru, yanlış ve boş cevaplar). S1'i yanlış yapan öğrenciler için E2'de S1 kopyası **Aynı soru**, "yer alır" sorusu **Benzer soru** olarak çıkar.

**E2. Bütün öğrenciler**
- [ ] **Adımlar:** Deneme sayfası → **Yanlışlara benzer soru**.
- **Beklenen:**
  - Yanlış ya da boş bırakılan sorular, en çok yanlış yapılandan başlayarak listelenir ("n öğrenci yanlış / boş").
  - Her sorunun yanında havuzdaki adaylar **Aynı soru / Benzer soru** etiketiyle görünür.
  - Denemedeki sorular aday olarak **çıkmaz**. Adaylarda "hiç kullanılmadı / n× kullanıldı / sınıf daha önce gördü" bilgisi var.
  - Benzeri olmayan soruda "Havuzda benzeri yok." yazar.

**E3. Seçip çalışma kağıdı hazırlama**
- [ ] **Her sorudan birini işaretle** → adaylar işaretlenir; alttaki düğme "Seçilen n soruyla çalışma kağıdı hazırla" olur.
- [ ] Düğmeye basın.
- **Beklenen:**
  - Deneme kurma ekranı **çalışma kağıdı** modunda, **tek kitapçık**, ad "Benzer test · tekrar", sorular seçili olarak açılır.
  - Hiçbir şey kendiliğinden kaydedilmez. Kayıt için "Çalışma kağıdını oluştur"a basmanız gerekir.

**E4. Tek öğrenci (karneden)**
- [ ] **Adımlar:** Sıralı liste → bir öğrencinin adı → karne → **Benzer soru öner**.
- **Beklenen:**
  - Başlıkta öğrencinin adı, yalnızca onun yanlışları. "Geri" bağlantısı karneye döner.
  - Çalışma kağıdı adı "Benzer test · tekrar · <öğrenci adı>".
- [ ] Karneyi yazdırırken (Ctrl+P) **Benzer soru öner** düğmesi baskıda görünmez.

**E5. Havuzdan kurulmamış deneme**
- [ ] **Adımlar:** Demo'daki *LGS Deneme 1* sayfasını açın.
- **Beklenen:** "Yanlışlara benzer soru" düğmesi **yok**. Karnede de "Benzer soru öner" yok.

---

## F. Kesilmiş sorular: metin ve görsel parmak izi

**F1. Metin rozeti**
- [ ] **Adımlar:** Havuz → Kaynak süzgeci: *MATEMATIK* (demo kaynağı).
- **Beklenen:** Kesilmiş soruların kartında **Metinsiz** rozeti var.

**F2. Metni elle yazma**
- [ ] **Adımlar:** **Metinsiz**'e tıklayın → ayrıntı panelinde "Soru metni" alanı → görseldeki kökü yazın, şıkları satır satır yazın → **Kaydet**.
- **Beklenen:**
  - "Metin kaydedildi."
  - Rozet **Metin** olur.
  - Kitapçıkta soru yine görsel olarak basılır; bunu G4'te kontrol edin.
- [ ] Arama kutusuna metinden bir kelime yazıp **Filtrele** → soru bulunur.
- [ ] Metni silip **Kaydet** → "Metin silindi.", rozet yeniden **Metinsiz**.

**F3. Aynı görseli yeniden kesme**
- [ ] **Adımlar:** Kaynaktan soru kes → demo kaynağı → zaten kesilmiş bir sorunun etrafına kutuyu biraz farklı çizin (kenarlar birkaç piksel farklı) → **Kaydet**.
- **Beklenen:** "Bu soru havuzda zaten var (MATEMATIK, s. 1)." uyarısı, **Yine de kaydet / Vazgeç**.
- [ ] **Yine de kaydet** → kaydedilir. Havuzda iki kartta da **Aynısı var** görünür; ayrıntı panelinde öteki görselle listelenir. Bu kartta **Düzenle** bağlantısı **yok**.
- [ ] Kopyayı silin.

**F4. Farklı soru uyarı vermez**
- [ ] Kaynakta henüz kesilmemiş bir bölgeyi kesin → uyarısız kaydedilir.

---

## G. Yapay zekâ bağlantısı sayfası (anahtarlar)

**G1. Anahtar oluşturma**
- [ ] **Adımlar:** Havuz → **Yapay zekâ bağlantısı** → ad: *Test · Claude Code* → **Anahtar oluştur**.
- **Beklenen:**
  - Sarı kutuda `rqb_` ile başlayan anahtar ve "bir daha gösterilmez" uyarısı.
  - "Bağlanma" bölümündeki Claude Code komutunda ve JSON ayarında anahtar hazır.
  - Adres `http://localhost:3000/api/mcp`.
- [ ] **Kopyala** → "Kopyalandı". Anahtarı H için bir yere not edin.
- [ ] Sayfayı yenileyin → anahtar artık görünmez; listede yalnızca ilk 8 karakteri, "hiç kullanılmadı".

**G2. Boş ad**
- [ ] Ad boşken **Anahtar oluştur** düğmesi pasif.

**G3. İptal** (H'yi bitirdikten sonra yapın)
- [ ] Listede **İptal et** → onay → "iptal edildi · tarih".

**G4. Kitapçık**
- [ ] D veya E'de oluşturduğunuz bir denemenin **Soru kitapçığı**'nı açın:
  - vurgulu sorular (A6) kalın basılıyor,
  - metni yazılmış kesilmiş soru (F2) görsel olarak basılıyor.

---

## H. MCP ile agent (Claude Code)

Başka bir terminalde, proje klasörünün **dışında** bir yerde (uzak bağlantıyı denemek için) Claude Code açın.

**H1. Uzaktan bağlanma**
- [ ] G1'deki Claude Code komutunu çalıştırın → `/mcp` → `rea-question-bank` **connected**.
- [ ] Agent'a: "Soru havuzunda hangi dersler ve düzeyler var?"
- **Beklenen:** Kurum adı, dersler ve düzeyler listelenir. G sayfasında anahtarın "son kullanım" zamanı dolar (sayfayı yenileyin).

**H2. Eksik bilgi**
- [ ] "Bana 3 soru yaz." deyin.
- **Beklenen:** Agent ders, düzey, konu ve türü **tek mesajda**, seçenekler sunarak sorar; tahmin etmez.

**H3. Soru yazma**
- [ ] "9. sınıf Matematik, kesirler konusundan 3 çoktan seçmeli soru yaz; birinde olumsuz kök olsun."
- **Beklenen:**
  - Agent kaydeder ve onay bağlantısını verir; "onaylandı" demez.
  - Havuz → Onay bekleyen: 3 yeni soru, **YZ · Yeni yazıldı**, çözümü dolu (**Çözümlü**).
  - Olumsuz kök kalın görünür.

**H4. Tekrar yakalama**
- [ ] "S1'i havuza ekle" deyin (metni verin).
- **Beklenen:** Agent kaydetmeden önce havuzda aynısı olduğunu söyler ve ne yapmak istediğinizi sorar.
- [ ] "Yine de ekle" deyin → kaydedilir. Agent "similar" sonucunu bildirir. Onay ekranında **Havuzda aynısı var** grubunda görünür (C6).

**H5. Kaynaktan aktarma ve cevap kaynağı**
- [ ] Cevap anahtarı **olmayan** küçük bir PDF ya da fotoğraf verin: "Bu dosyadaki soruları olduğu gibi aktar."
- **Beklenen:**
  - Sorular **YZ · Aktarıldı**, kaynak notunda dosya adı ve sayfa.
  - **Cevabı agent çözdü** rozeti var; agent notunda "anahtar yok" cümlesi **yok**.
  - Uzaktan bağlantıda agent görseli base64 olarak gönderir. Yol gönderirse "image.path works only with the local server" hatasını alır ve düzeltir.

**H6. Kesilmiş soruları yazıya geçirme**
- [ ] Net bir PDF'ten (ör. `notes/tahriri_imtihanlar/` içinden) birkaç soru kesin (F). Sonra agent'a: "Havuzdaki metinsiz soruları yazıya geçir."
- **Beklenen:**
  - Agent görselleri alır, metinleri kaydeder. Okuyamadığı soruyu atlayıp söyler.
  - Kartlarda **Metin · YZ**. Ayrıntıda "yapay zekâ ile çıkarıldı · kontrol edin".
  - Soru onaya düşmez.
- [ ] F2'de elle metin yazdığınız soru agent tarafından **değiştirilmez** (skipped).

**H7. İptal edilen anahtar**
- [ ] G3 ile anahtarı iptal edin → agent'tan bir şey isteyin.
- **Beklenen:** Bağlantı hatası (401). `/mcp`'de sunucu bağlantısız görünür.
- [ ] Temizlik: `claude mcp remove rea-question-bank`.

**H8. Yerel bağlantı bozulmadı**
- [ ] Proje klasöründe Claude Code açın (`.mcp.json` ile yerel sunucu) → "Soru havuzunda hangi dersler var?" → yanıt gelir; anahtar gerekmez.

---

## I. Genel kontroller

- [ ] Havuz sayfası hızlı açılıyor (1–2 saniyeden kısa); onay görünümünde de.
- [ ] Deneme kurma sayfası hızlı açılıyor.
- [ ] Tarayıcı konsolunda kırmızı hata yok (F12 → Console); yerel ortamda sol altta "Issue" balonu çıkmıyor.
- [ ] Telefon görünümünde (Chrome geliştirici araçları) onay grubu satırı ve "Yapay zekâ bağlantısı" sayfası taşmıyor.
- [ ] Eski özellikler çalışıyor: soru yazma, kesme, havuzdan deneme, kitapçık + optik form, karne.

---

## Sorun kaydı

| # | Senaryo | Ne oldu | Beklenen | Önem (Y/O/D) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
