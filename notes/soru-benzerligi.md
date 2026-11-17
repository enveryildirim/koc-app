# Soru benzerliği (fikir)

Durum: 6. bölümdeki 1. adım (tekrarı önleme ve kardeş soru) yapıldı, 17 Kasım 2026. Uygulama ve ölçüm: 9. bölüm. (Fikir 11 Kasım 2026'da MCP çalışması sırasında konuşuldu.)

---

## 1. "Benzer" üç ayrı şey

| İlişki | Örnek | Ne yapılmalı |
|---|---|---|
| **Aynı soru** | Aynı PDF iki kez aktarılmış ya da havuzdaki soru birkaç kelimesi değiştirilip yeniden yazılmış | Yakalanmalı |
| **Kardeş soru** (aynı kalıp, başka sayılar) | "30°, 45°, 60° açılarını birim çemberde işaretle" / "240°, 270°, 330° …" | Hata değil, işe yarar. Öğretmen bilsin |
| **Aynı kazanım** | Aynı kazanıma ait farklı sorular | İstenen durum, benzerlik sayılmaz |

Kullanıcıya yüzde değil **etiket** gösterilmeli: "%78 benzer" öğretmene bir şey söylemez, "kardeş soru" söyler.

## 2. Bugünkü durum

- `search_questions` (MCP) yalnızca "kelime içinde geçiyor mu" diye arıyor. Agent doğru kelimeyi tahmin edemezse ("üçgenin alanı" / "üçgende alan") tekrarı göremez.
- `add_questions` benzerlik kontrolü yapmıyor.
- Kaynaktan kesilen sorular yalnızca görselden oluşuyor; metinleri olmadığı için karşılaştırılamıyorlar.

## 3. Deneme ölçümü (dev.db, metni olan 103 soru)

- **Düz harf üçlüsü (trigram) benzerliği yanıltıcı çıktı.** En yüksek puanı (0,84) iki farklı sadeleştirme sorusu aldı. Puanı ortak kalıp şişirdi: "…ifadesinin en sade hali aşağıdakilerden hangisidir".
- **TF-IDF ağırlığı eklenince sonuç düzeldi.** Çok soruda geçen kalıpların ağırlığı düşünce aynı çift 0,41'e indi.
- **Yeniden yazılmış kopya bulundu.** Havuzdaki bir soru başka kelimelerle yazılıp arandı. Asıl soru 0,82 ile ilk sırada geldi, ikinci aday 0,41'de kaldı.
- **Havuzda gerçek tekrar yok.** 0,9'u geçen çift çıkmadı. En yakın çiftler birim çember soruları (0,71–0,77), yani kardeş soru.
- **Metin yetmeyen yer: geometri.** Anlam şekilde. "…olduğuna göre |AC| kaç cm?" biçimindeki farklı sorular 0,6 civarında puan alabiliyor.

## 4. Kullanıcıya faydası

**Havuza eklerken**
- Aynı sorunun ikinci kez girilmesi engellenir. Havuz büyüdükçe en çok bu yüzden kirlenir.

**Deneme hazırlarken**
- Aynı denemeye birbirine çok benzeyen iki soru konmaz. Biri diğerinin cevabını ele verebilir ya da ikisi aynı şeyi iki kez ölçer.
- Uyarı verilir: "Bu soru ya da çok benzeri geçen ay 10-A'nın denemesinde çıktı." Denemeler havuzdaki soruların kimliğini zaten saklıyor (`Exam.sections[].items`).
- Telafi sınavı veya ikinci bir deneme için her sorunun kardeşi bulunur.

**Öğrenci yanlış yaptığında** (bence en büyük fayda)
- Gereken veri zaten var: optik okuyucu her öğrencinin cevabını kaydediyor (`ExamResult.answers`), deneme de hangi havuz sorusunun kullanıldığını biliyor.
- Benzerlik eklenince öneri yapılabilir: "Bu öğrenciye yanlış yaptığı sorunun 3 kardeşini ödev ya da etüt olarak ver."
- Böylece soru havuzu ölçme aracından öğrenme aracına dönüşür.

**Havuzun durumunu görmek**
- Gruplama şunu gösterir: "Trigonometrik oranlarda 40 soru var, ama aslında 4 kalıp." Soru sayısı yüksek, çeşitlilik düşük.
- Agent'a yön verilebilir: "Bu kazanımda eksik kalan kalıpları yaz."

**Zorluk tahmini**
- Kardeş soruların zorluğu yakındır. Bir sorunun deneme sonuçları biliniyorsa, yeni kardeşinin zorluğu denemeye girmeden tahmin edilebilir.

## 5. Çok soruda nasıl ölçülür

Herkesi herkesle karşılaştırmak gerekmiyor ve tek bir yöntem yetmiyor. Katmanlar ucuzdan pahalıya doğru:

1. **Daraltma.** Bir soru yalnızca aynı ders ve sınıftaki (mümkünse aynı kazanımdaki) sorularla karşılaştırılır. 10.000 soruluk havuzda bile her soru için birkaç yüz aday kalır.
2. **Metin benzerliği** (TF-IDF + harf üçlüsü). Kopyaları ve küçük değişiklikleri yakalar, her eklemede çalışacak kadar hızlıdır. Türkçe ekler ("üçgenin", "üçgende") harf üçlüsü sayesinde kendiliğinden eşleşir.
3. **Anlam benzerliği** (embedding). Her soru bir anlam vektörüne çevrilip saklanır. Farklı kelimelerle yazılmış aynı soruyu, hatta Türkçe ve İngilizce aynı soruyu bulur. Bir model gerektirir.
4. **Yapı.** Aynı kazanım, aynı tür, aynı bilişsel düzey ve aynı cevap, metin farklı olsa bile güçlü ipuçlarıdır.
5. **Görsel.** Kesilmiş sorular için OCR ile metin çıkarılır ya da görselin parmak izi alınır.
6. **Hakem olarak dil modeli.** Önceki katmanların bulduğu en yakın birkaç çift için şu sorulur: "Aynı soru mu, kardeş mi, farklı mı?" Pahalıdır ama az sayıda çifte uygulanır. Geometride şekli görerek karar verebilen tek katman budur.

**Kalibrasyon:** Ölçümün doğru çalışıp çalışmadığını öğretmenin kararları gösterir. "Olası tekrar" işaretli bir soru onay ekranında reddedildi mi, kabul edildi mi? Bu kararlar eşiği zamanla ayarlamak için kullanılır.

## 6. Önerilen sıra

1. **Tekrarı önleme ve kardeş soru.** İkisi aynı ölçümle çalışır, hemen işe yarar.
   - Sunucuda TF-IDF ile aday bulunur, karar agent'ta ve öğretmende kalır.
   - `search_questions`'a `similarTo` eklenir: taslak soru gönderilir, en benzer 5 soru puanıyla döner.
   - `add_questions` her soruyu kendiliğinden kontrol eder. Puan ≥ 0,8 olunca soruyu reddetmez; kaydeder ve "olası tekrar: #id" diye işaretler. Bu işaret onay ekranındaki kartta görünür. 0,8 bir başlangıç değeri.
2. **Yanlış yapılan sorunun kardeşini önermek.** Veri hazır, eksik olan benzerlik ilişkisi. Uzun vadede en çok değer bu adımdan gelir.
3. **Sonrası.** Anlam benzerliği (embedding), görsel sorular için OCR veya parmak izi, havuzun kalıp haritası.

## 7. Model eğitimi gerekir mi?

Şimdilik gerekmiyor:

- **Hiçbir katman eğitim istemiyor.** TF-IDF havuzun kendi istatistiğiyle çalışır; çok dilli hazır embedding modelleri Türkçeyi destekler; hakem dil modeli de hazırdır. Hakem modeli yönlendirmek için talimata örnek çiftler eklemek yeterli.
- **Eğitim için veri yok.** Binlerce etiketli çift (aynı / kardeş / farklı) gerekir. Havuzda 103 soru var ve gerçek tekrar yok.
- **Asıl "öğrenme" eşik ayarı.** Öğretmenin onay kararlarıyla eşik ayarlanır. Bu basit bir kalibrasyon, model eğitimi değil.
- **Zorluk tahmini de eğitim istemez.** Bir sorunun zorluğu denemelerdeki doğru cevaplama oranından çıkar (madde analizi), yani düz istatistik. Yeni bir soruya kardeşinin zorluğu verilir.

Ne zaman düşünülür: Öğretmen kararları binlerle ölçüldüğünde ve hazır yöntemler belirli bir yerde sürekli yanıldığında, örneğin matematik formüllerinde ya da Osmanlıca metinde. O zaman da sıra şöyle olmalı:

1. Önce metni hazırlarken düzeltilir. Sayılar maskelenir, formül yazımı tek biçime getirilir.
2. Sonra talimattaki örnekler artırılır.
3. Ancak bunlar yetmezse, öğretmen kararlarıyla küçük bir embedding modeli ince ayarlanır.

Şekle dayalı sorularda (geometri) eğitim ucuz bir çözüm değil. Orada şekli görebilen hakem model daha pratik.

## 8. Jev (TypeSafe AI) değerlendirmesi (11 Kasım 2026)

**Ne olduğu**
- TypeSafe adlı şirketin sınıflandırma modeli; 15 Eylül 2026'da erken erişimle çıktı.
- Metin üretmiyor. Metin veya JSON alıyor ve tipli cevap döndürüyor:
  - evet/hayır olasılığı,
  - 255'e kadar seçenek arasından seçim (seçenek başına olasılıkla),
  - 2–10 basamaklı puan.
- Hızlı ve ucuz: cevap 70–500 ms'de geliyor; fiyatı milyon girdi tokeni başına yaklaşık 0,04 $.
- Embedding üretmiyor. Görsel desteği "deneysel".

**Belirsiz olanlar**
- Türkçe desteği belirtilmemiş. 1.14 sürümü için yalnızca "İngilizce dışındaki dillerde gelişme" deniyor.
- Doğruluk yalnızca şirketin kendi verisinde ölçülmüş: %67, bazı büyük dil modelleriyle aynı düzeyde.
- Yalnızca API ile kullanılıyor; kendi sunucumuzda çalıştıramıyoruz.

**Resmî kaynak:** typesafe.ai, docs.typesafe.ai ve Vercel AI Gateway. Hugging Face'teki "sora-2" topluluk yazısının yönlendirdiği thejevai.com güvenilir kaynaklarda geçmiyor; doğrulanmadan API anahtarı verilmemeli.

**Bizim için**
- **Aday bulmayı yapamaz.** Benzerlik puanı ya da vektör üretmiyor, binlerce soruyu taramaya uygun değil. 5. bölümdeki 2. katman (metin benzerliği) her durumda gerekli.
- **Hakem katmanına (5. bölüm, 6. katman) aday olabilir.** İki soru verilip "aynı / kardeş / aynı kazanım / farklı" diye seçtirilir. Dönen olasılıklar etiket ve eşik fikrine uyuyor. Ucuz olduğu için her aday çifte agent olmadan, sunucuda uygulanabilir.
- **Başka yerlerde daha da uygun olabilir:**
  - elle girilen ve kesilen sorulara kazanım önerme (müfredat konuları arasından seçim),
  - bilişsel düzey ve zorluk kontrolü,
  - "kişisel veri var mı", "olumsuz kök vurgulanmış mı" gibi evet/hayır kontrolleri.
- **Uygun olmadığı yerler:**
  - Matematik çözümünü doğrulamak: hızlı yargı modeli, akıl yürütme işine uygun değil.
  - Şekle dayalı sorular: görsel desteği deneysel.
- **MCP üzerinden gelen sorularda gereksiz.** Bu kararları kullanıcının agent'ı zaten veriyor. Jev'in getirisi agent'sız akışlarda: öğretmenin elle girdiği sorular ve tüm havuzu tarama.

**Karar:** POC'ye şimdilik bağımlılık eklenmeyecek. Hakem katmanına gelindiğinde kısa bir deneme yapılır:
1. 50 Türkçe soru çifti elle etiketlenir.
2. Jev ve kullanılan agent aynı çiftlerle ölçülür, sonuçlar karşılaştırılır.
3. Maliyet önemsiz; asıl soru Türkçede ne kadar doğru çalıştığı.

## 9. Uygulama (17 Kasım 2026)

**Yöntem** (`question-bank/similarity.ts`, saf hesap):
- Metin benzerliği: TF-IDF + kosinüs; sayılar `#` ile maskeli. Terimler: harf üçlüleri, kısa adlar ve simgeler (`ab`, `x`, `⊥`, `√`, `²`), simge ikilileri ve kelime içermeyen üçlüler (`ad ] ⊥`). Şıklar yarım ağırlık. IDF dersin sorularından.
- Sayı örtüşmesi: sayı çoklukümelerinin Jaccard'ı.
- Cevap: doğru cevabın içeriği (çoktan seçmelide şıkkın metni; açık uçluda karşılaştırılmaz).
- Etiket: metin ≥ 0,8 ve sayılar ≥ 0,6 ve cevap aynı → **Aynı soru**; metin ≥ 0,8, sayılar ya da cevap farklı → **Kardeş soru**.

**Ölçüm (dev.db):**
- İlk deneme (harf üçlüsü, simgeler atılmış): "en sade hali hangisidir" kalıbını taşıyan iki farklı soru 0,93 aldı; geometride yalnızca sayıları farklı ama şekli farklı sorular 0,99'a çıktı. Simgeler terim olunca ilk çift 0,64'e, farklı şekilli geometri çiftleri 0,74 ve altına indi.
- Eşiği geçen gerçek çiftler: birim çember soruları (0,84–0,96) ve aynı kosinüs kalıbı (1,0); hepsi kardeş, doğru.
- Sentetik: 12 sorunun kopyası, kelimesi değişmiş hâli ve sayısı değişmiş hâli: 36/36 doğru soruyu buldu ve doğru etiketledi.
- Şıkları karıştırılmış kopya "Aynı soru" (cevap harfi farklı, içerik aynı). Olumsuz kökle yeniden yazılmış soru (farklı cevap) aynı sayılmaz.

**Nerede kullanılıyor:**
- Elle yazma / yapıştır-böl: "Aynı soru" varsa kayıt durur, "Yine de kaydet / Vazgeç" (409 + confirm). Kardeş soru kaydı durdurmaz.
- Havuz kartı: "Aynısı var" / "Kardeşi var (n)" rozeti; soru ayrıntısında "Benzer sorular" listesi (`GET sorular/[id]/benzer`).
- MCP: `search_questions` `similarTo` (taslak soru → aynı / kardeş, onay bekleyen ve arşivdekiler dahil); `add_questions` yanıtında `similar` (havuz ve aynı gönderimdeki diğer sorular). Kayıt reddedilmez: öğretmen onay ekranında rozeti görür.
- Havuz: aynı dersin metinli soruları (ders yazılışı gözetilmez, sınıf düzeyiyle daraltılmaz). Kesilmiş (yalnızca görsel) sorular karşılaştırılmaz.

**Sonraki adımlar:** yanlış yapılan sorunun kardeşini önermek (6. bölüm, 2. adım); havuz büyüyünce benzerlik sonuçlarını önbelleğe almak (şu an her sayfa açılışında dersin tüm soruları üzerinden hesaplanıyor; 113 soruda ~0,2 s).

**Ekrandaki ad (17 Kasım 2026):** kullanıcı isteğiyle ekranda "kardeş soru" yerine **"benzer soru"** ("Benzeri var") kullanılıyor; kodda `sibling` adı kaldı. Bu nottaki "kardeş" = ekrandaki "benzer".

**Deneme kurarken (17 Kasım 2026):** `similarPairs` seçilebilir sorular (arşiv ve onay bekleyen hariç) arasındaki çiftleri bir kez hesaplar. Seçilen listede soru başına "Aynısı / Benzeri denemede: Genel 3", havuz kartında "Aynı soru / Benzer soru: seçilen …", düğmenin yanında "n çift aynı soru, n çift benzer soru". Rastgele ekleme seçilmişlere ve birbirine benzeyenleri almaz. Aynı soru çifti varsa oluştururken onay sorulur; benzer soru engellemez.

