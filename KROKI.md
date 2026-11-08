# Kroki: kim, nerede, ne yapar

Bu dosya ürünü anlatır: hangi kayıt nerede oluşur, nerede kullanılır, hangi rol neyi yapabilir. Kodun yapısı için [ARCHITECTURE.md](ARCHITECTURE.md), geçmiş kararlar için [PROJECT_MEMORY.md](PROJECT_MEMORY.md).

**Kural:** Bir ekran ya da kayıt akışı değişince bu dosya da aynı commit'te güncellenir. ⚠ işareti bilinen tutarsızlıktır; koddaki karşılığı [notes/yonetim-duzenleme-plani.md](notes/yonetim-duzenleme-plani.md) dosyasındadır (U1… numaraları).

Son güncelleme: 8 Kasım 2026.

---

## 1. Roller

| Rol | Nasıl girer | Nereye gider | Ne yapabilir |
|---|---|---|---|
| **Yönetici** (kurum hesabı) | `/giris`: e-posta + şifre (`/kayit` ile açılır) | `/kurum` (yönetim paneli) | Her şey |
| **Etüt mesulü** | Kişisel link `/o/<anahtar>` | `/ogretmen` + `/kurum` | Yöneticinin yaptığı her şey + öğretmen ekranı. Takip'te varsayılan kapsamı kendi sınıflarıdır |
| **Öğretmen** | Kişisel link `/o/<anahtar>` | Yalnızca `/ogretmen` | Kendi derslerinin yoklaması, işlenen konu, sözlü/yazılı, ödev |
| **Veli** | Öğrenciye özel link `/veli/<anahtar>` | Veli karnesi (salt okunur) | Görüntüleme |
| **Öğrenci** | Giriş yok | — | Online testi kodla çözer (`/s/<KOD>`) |

- Kurumda tek yönetici hesabı vardır (Personel → Yönetici sekmesinde görünür). Etüt mesulü ve öğretmen, Personel sayfasındaki kayıtlardır (`Teacher.role`). Öğrenciler ayrı sayfadadır.
- Kişisel link yenilenir ya da kaldırılırsa açık oturumlar kapanır.
- Bir tarayıcıda tek oturum açık kalır.

---

## 2. Kayıtlar

Sütunlar: **Oluşur** = kaydın doğduğu yer; **Düzenlenir**; **Kullanılır** = kaydın seçildiği ya da gösterildiği yerler; **Kim** = yazma yetkisi.

### Sınıf (`Classroom`)
| | |
|---|---|
| Oluşur | Yönetim → **Sınıflar** → "+ Yeni sınıf" (yan panel; "Kaydet ve yenisini ekle" ile arka arkaya) |
| Ayrıca oluşur | Öğrenciler → Excel'den yükle: dosyadaki sınıf adı yoksa sınıf açılır; önizleme "Yeni sınıf açılacak: …" diye önceden uyarır |
| Düzenlenir | Sınıf sayfası `/kurum/siniflar/[id]`: ad, düzey, etüt mesulü, ek üyeler |
| Kullanılır | Öğrenci, Ders, Ders programı, Yoklama, Ödev, Yıllık plan, Takvim etkinliği, Takip, Analiz |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/enrollment/internal/classrooms.ts` · `ui/ClassManager.tsx` |

Düzey serbest metindir (9, 10, Seviye-2…). Müfredat düzeyleri bu değerlerden gelir; aynı düzeydeki sınıflar müfredatı paylaşır.

### Öğrenci (`Student`, `ClassMember`)
| | |
|---|---|
| Oluşur | Yönetim → **Öğrenciler** → "+ Öğrenci ekle" (yan panel, `?yeni=1`; "Kaydet ve yenisini ekle", Enter) ya da "Excel'den yükle" (listenin üstünde, `?yukle=1`). Eklenenler listede yeşil (`?eklendi=`) |
| Düzenlenir | Öğrenci profili `/kurum/ogrenciler/[id]` |
| Ek sınıf üyeliği | Sınıf sayfası → "+ Başka sınıftan ekle" (ör. SEVİYE-2) |
| Kullanılır | Yoklama, Sözlü/yazılı, Ödev, Deneme sonuçları (öğrenci no ile eşleşir), Veli karnesi, Takip |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/enrollment/internal/students.ts` · `ui/StudentForm.tsx` · `ui/ImportStudents.tsx` |

Öğrenci no 1–6 hanedir (optik formda 6 hane var) ve kurumda tektir. Formda sıradaki numara (en büyük + 1) yazılı gelir, değiştirilebilir; Excel'de Numara boşsa sırayla verilir.

### Öğretmen / etüt mesulü (`Teacher`) ve kişisel link (`AccessLink`)
| | |
|---|---|
| Oluşur | Yönetim → **Personel** → Öğretmenler sekmesi "+ Öğretmen ekle" (ad, branş) · Etüt mesulleri sekmesi "+ Etüt mesulü ekle" (ad, sorumlu olduğu sınıflar). Yan panel, `?yeni=1` |
| Düzenlenir | Aynı sayfa → Düzenle (yan panel): ad, rol, branş / sınıflar; silme. Rol değişince kişi öbür sekmeye geçer, link korunur; öğretmene dönen mesulün sınıfları boşa çıkar |
| Link | Aynı sayfa → "Giriş linki": oluştur, kopyala, WhatsApp, yenile, kaldır |
| Sınıfın etüt mesulü | Personel → etüt mesulünün sınıfları **ya da** sınıf sayfasındaki "Etüt mesulü" seçimi (ikisi aynı alanı yazar: `Classroom.mentorId`) |
| Kullanılır | Ders sorumlusu, Ders programı, Sınıfın etüt mesulü, Takip → Öğretmenler |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/schedule/internal/teachers.ts` · `ui/PersonnelManager.tsx` · `app/kurum/personel` · `enrollment > setMentorClasses` · `PUT /api/kurum/ogretmenler/[id]/siniflar` · `modules/identity/internal/access.ts` |

Etüt mesulünün branşı yoktur (boş kaydedilir; listelerde "Etüt mesulü" yazar). Telefonda iki satırlık liste; giriş linki satırın içinde.

### Ders (`Course`)
Sınıfın dersidir; (sınıf, ad) tektir. Türü: Okul · Mesleki · Dini · Hazırlık · Etüt. "Başka kurumda alınıyor" işaretli olabilir.

| | |
|---|---|
| Oluşur | **Yalnızca** Yönetim → **Dersler** → "+ Ders ekle" (yan panel, `?yeni=1`). Birden fazla sınıf seçilebilir |
| Düzenlenir / silinir | Dersler → satıra tıkla (yan panel, `?ders=<id>`): ad, tür, sorumlu, dışarıda. Ad değişince programdaki satırlar da değişir. Programda saati olan ders silinmez |
| Görüntülenir | Sınıf sayfası (salt okunur; ders Dersler'deki paneli açar), ⌘K arama (paneli açar) |
| Seçilir | Ders programı ve ek ders (kimlik ile; sunucu da var olan ders ister), Sözlü/yazılı (kimlik ile), Deneme → derse bağla (kimlik ile), Ödev ve Yıllık plan (sınıfın derslerinden seçilen ad ile), Takip → Dersler (ad ile birleşir) |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/schedule/internal/courses.ts` · `ui/CourseAdmin.tsx` · `app/kurum/dersler/page.tsx`. `courseIdFor` / `syncCourses` yalnızca derse bağlanmamış eski program satırları için |

### Ders programı satırı (`ScheduleSlot`)
| | |
|---|---|
| Oluşur | Yönetim → **Ders programı** → gün → "+ Saat ekle" (sınıf, **ders listeden**, öğretmen ve tür dersten gelir, **günler çoklu seçilir**, saat). Aynı saat seçilen her güne ayrı satır olarak eklenir; bir günde çakışma varsa hiçbiri kaydedilmez. Ders listede yoksa Dersler'e bağlantı |
| Düzenlenir / silinir | Aynı ekranda derse tıklayınca. Günler, aynı dersin aynı saatte başka günlerdeki satırlarıyla (seri) birlikte gelir: değişiklik seçili günlerin hepsine uygulanır, gün eklemek satır açar, gün çıkarmak o günü siler (uyarıyla). "Sil" yalnızca açılan günü siler. Silinince geçmiş yoklamalar korunur |
| Kullanılır | Yoklama (günün dersleri), Öğretmenin "Bugün" ekranı, Eksik girişler, Takip |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/schedule/internal/slots.ts` · `validate.ts` · `ui/ScheduleBoard.tsx` |

Çakışma denetimi (`internal/clashes.ts`): aynı ders iki kez ve aynı sınıf / aynı öğretmende kesişen iki grup dersi **kaydedilmez**; etüt / özel ders kesişmesi ve ortak öğrencisi olan iki sınıfın (ek üyeler) aynı saatteki dersleri **uyarı**dır, "Yine de kaydet" ile geçilir. Mevcut çakışmalar sayfanın üstünde listelenir, dersler kırmızı / sarı çerçevelenir.

### Yoklama (`LessonSession`, `Attendance`)
| | |
|---|---|
| Oluşur | Öğretmen: `/ogretmen` → derse dokun → yoklama. Yönetici: Giriş → **Yoklama** (programdaki dersler; "Ek ders ekle" ile sınıfın derslerinden biri için ek ders / etüt) |
| Kim | Öğretmen (kendi dersi), etüt mesulü, yönetici |
| Kod | `modules/schedule/internal/attendance.ts` |

### Takvim etkinliği (`CalendarEvent`)
| | |
|---|---|
| Oluşur | Yönetim → **Takvim ve planlar** → "+ Etkinlik" · "Resmî tatilleri ekle" · Haftalık plan içe aktarma (izin haftaları) |
| Kullanılır | Yoklama (tatil günü), Yıllık plan dağıtımı (tatil haftası atlanır), Özet → Önümüzdeki 7 gün |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/planning/internal/events.ts` |

### Müfredat konusu (`CurriculumTopic`)
(ders adı, düzey) başına konu listesidir. Sınıfa değil düzeye bağlıdır; **ders açmaz**. Bir sınıf, düzeyi uyuyor ve bu adla dersi varsa müfredatı kullanır.

| | |
|---|---|
| Oluşur | Yönetim → **Müfredat** → "+ Müfredat ekle" (ders Dersler'deki adlardan, düzey Sınıflar'daki düzeylerden seçilir) · Excel'den yükle (eşleşmeyen ad / düzey uyarılır) · örnek müfredat |
| Görüntülenir | Set başlığında "Kullanan sınıflar"; eşleşme yoksa sarı uyarı |
| Kullanılır | Yıllık plan şablonu (sınıfın düzeyine uyan setler) ve plan satırlarının bağı (`PlanItem.curriculumTopicId`), Soru havuzu ve deneme konuları (ad ile), Müfredat → Takip |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/curriculum/` (`curriculumGradeOptions`, `gradeScope`, `curriculumForClass`) · `app/kurum/mufredat/page.tsx` |

Set kaydedilirken / Excel'den yeniden yüklenirken konuların kimliği korunur (aynı ünite + konu adı); adı değişen konu yeni kayıt olur ve plan satırındaki bağı boşalır. Kayıttan sonra o dersin planlarının bağları tazelenir (`planning > relinkPlans`).

Düzey seçenekleri: sınıf düzeyleri + 8 varsa LGS, 11 / 12 varsa TYT ve AYT + var olan setlerin düzeyleri.

### Yıllık plan (`LessonPlan`, `PlanItem`)
| | |
|---|---|
| Oluşur | Takvim ve planlar → Yıllık ders planı → "+ Yeni plan" ("Müfredattan doldur") · "Haftalık planı içe aktar" (CSV) · başka sınıftan kopyala · Müfredat → Takip → "Plan oluştur" |
| Görüntülenir | **Konu takibi** = plan sayfası (`/kurum/takvim/plan/[id]`): durum, işlendiği ders, değerlendirme, deneme; Müfredat → Takip'teki sınıf satırından da açılır |
| İşlendi işareti | Öğretmen ders ekranı / yoklama → "Bu derste işlenen konu" · konu takibi sayfası |
| Kim | Plan: yönetici, etüt mesulü. İşaret: öğretmen de |
| Kod | `modules/planning/internal/lessonPlans.ts` · `weeklyImport.ts` · `plan.ts` (`parsePlan`, `layoutPlan`) · `reporting/internal/topicTracking.ts` + `reporting/ui/TopicTracking.tsx` |

Derse ad ile bağlı; formda ad sınıfın derslerinden seçilir. Haftalık plan içe aktarmada (CSV) ad tutmazsa uyarı verilir, kayıt yine yapılır.
Plan metninde `# Ünite` satırı ünite başlığıdır. "Üniteler paralel işlenir" (`LessonPlan.parallel`) seçiliyse her ünite ilk haftadan kendi sırasıyla ilerler (Kur'ân · Tecvid · Ezber tek derste). Her satır kaydedilirken sınıfın müfredat setine bağlanır (ünite + konu adı, şapka / büyük-küçük harf farkı gözetilmez); bağsız satır konu takibinde "müfredatta yok" görünür. Plan düzenlenince satırlar yerinde güncellenir; işlendi bilgisi, yoklama bağı ve konuya bağlı değerlendirmeler korunur.

### Puan cetveli (`Rubric`)
| | |
|---|---|
| Oluşur | Yönetim → **Puan cetvelleri** → "+ Yeni cetvel" ya da hazır örnekten |
| Kullanılır | Sözlü/yazılı başlatırken seçilir |
| Kim | Yönetici, etüt mesulü (öğretmen ekleyemez) |
| Kod | `modules/assessment/internal/rubrics.ts` · `ui/RubricManager.tsx` |

### Sözlü / yazılı / uygulama (`Assessment`, `AssessmentScore`)
| | |
|---|---|
| Oluşur | Öğretmen: `/ogretmen` → "Sözlü ve yazılı" → ders → "+ Başlat". Yönetici: Giriş → **Sözlü ve yazılı** → Yeni |
| Puan | Telefon ekranı ("Kaydet ve sonraki") · kâğıt form |
| Kim | Öğretmen (kendi dersi), etüt mesulü (sınıfının bütün dersleri, dışarıda alınanlar dahil), yönetici |
| Kod | `modules/assessment/` |

### Ödev (`Homework`, `HomeworkStatus`)
| | |
|---|---|
| Oluşur | Giriş → **Ödevler** → Yeni ödev · Öğretmen ders ekranı → "+ Ödev ver" |
| Durum | Yaptı / Eksik / Yapmadı: ödev sayfası, öğretmen ekranı |
| Kim | Öğretmen (kendi dersi), etüt mesulü, yönetici |
| Kod | `modules/homework/` |

Derse ad ile bağlı; formda ad sınıfın derslerinden seçilir (öğretmen ekranında dersin kendisi).

### Deneme / sınav (`Exam`, `ExamResult`)
| | |
|---|---|
| Oluşur | Giriş → **Denemeler ve optik** → Yeni deneme · Havuzdan sınav (çalışma kâğıdı dahil) |
| Sonuç | Optik form tarama · okuyucu TXT · elle |
| Derse bağlama | Deneme başlığındaki ders listesi (kimlik ile) |
| Kim | Yönetici, etüt mesulü |
| Kod | `modules/exams/` |

### Diğerleri
| Kayıt | Oluşur | Kod |
|---|---|---|
| Soru havuzu (`QuestionSource`, `QuestionItem`) | Araçlar → Soru havuzu → kaynak yükle → soru kes | `modules/question-bank/` |
| Online test (`Test`…) | Araçlar → Online testler (`/panel`) | `modules/online-test/` |
| Veli linki (`Student.parentToken`) | Takibat → Veli karnesi → "Yeni bağlantı üret" | `modules/reporting/` |
| Haftalık veli raporu (`ParentDispatch`) | Takibat → Haftalık veli raporu | `modules/reporting/` |
| Başarı Skoru ayarları (`Setting`) | Analiz → Başarı Skoru → Ayarlar | `modules/reporting/` |

---

## 3. Sayfa haritası

### Yönetim paneli `/kurum` (yönetici, etüt mesulü)

```
Özet                      /kurum                 Kurulum rehberi (eksik adım varken), bugünün dersleri, son denemeler, dikkat isteyenler
Giriş
  Yoklama                 /kurum/yoklama         Günün dersleri, ek ders / etüt
  Sözlü ve yazılı         /kurum/degerlendirme   Liste, yeni, sonuç, kâğıt form, uç değerleri ayır
  Ödevler                 /kurum/odevler         Yeni ödev, durum, sınıf / ders raporu
  Denemeler ve optik      /kurum/denemeler       Yeni deneme, havuzdan, optik, TXT, raporlar
Takibat
  Takip                   /kurum/takip           Dikkat isteyenler; Sınıflar / Dersler / Öğretmenler sekmeleri
  Analiz                  /kurum/analiz          Başarı Skoru, sınıf gelişimi, devam raporları …
  Veli karnesi            /kurum/veli-karnesi    Veli linki üret
  Haftalık veli raporu    /kurum/veli-bulteni    Mesaj önizleme, öğretmen notu, gönderim
Araçlar
  Soru havuzu             /kurum/soru-havuzu
  Online testler          /panel
Yönetim
  Öğrenciler              /kurum/ogrenciler      Liste; + Öğrenci ekle → yan panel; Excel'den yükle → listenin üstünde
  Personel                /kurum/personel        Sekmeler: Öğretmenler · Etüt mesulleri · Yönetici; + ekle / Düzenle → yan panel; giriş linki
  Sınıflar                /kurum/siniflar        Tablo (telefonda liste); + Yeni sınıf → yan panel
    └ Sınıf sayfası       /kurum/siniflar/[id]   Etüt mesulü, Dersler (salt okunur → Dersler), Öğrenciler
  Dersler                 /kurum/dersler         Bütün dersler tek tablo, sınıf süzgeci; + Ders ekle / düzenle → yan panel
  Ders programı           /kurum/ders-programi   Çakışma listesi; sınıfa / öğretmene göre hafta; + Saat ekle (ders listeden)
  Takvim ve planlar       /kurum/takvim          Takvim, yıllık ders planı, haftalık plan içe aktarma
  Müfredat                /kurum/mufredat        Ders × düzey konu listeleri, kullanan sınıflar, takip; + Müfredat ekle
  Puan cetvelleri         /kurum/puan-cetvelleri
```

Arama: her sayfada ⌘K / Ctrl+K (öğrenci, sınıf, ders, öğretmen, sayfa).

**Ortak ekleme kalıbı** (Sınıflar, Dersler, Öğrenciler, Personel): başlıkta "+ … ekle" → `?yeni=1` → yan panel (`shared/ui/Drawer.tsx`; masaüstünde sağdan, telefonda tam ekran; Esc kapatır; Enter kaydeder). "Kaydet" listeye döner ve eklenenleri yeşil vurgular; "Kaydet ve yenisini ekle" panelde kalır. Boş listede ne yapılacağını söyleyen bağlantı.

**Kurulum sırası** (Özet'teki rehber, `reporting > setupSteps`): Sınıflar → Personel → Öğrenciler → Dersler → Ders programı → Takvim.

### Öğretmen ekranı `/ogretmen` (öğretmen, etüt mesulü; telefon öncelikli)

```
Bugün                     /ogretmen               Eksik girişler, günün dersleri, gün gezinme
  └ Ders ekranı           /ogretmen/ders          Yoklama, işlenen konu, sözlü/yazılı, + Ödev ver
Sözlü ve yazılı           /ogretmen/degerlendirme Derslerim → + Başlat → puan girişi
Ödev                      /ogretmen/odev/[id]     Durum işaretleme
Takip (yalnızca etüt mesulü) → /kurum/takip
```

### Herkese açık

```
/giris, /kayit            Kurum hesabı
/o/<anahtar>              Öğretmen / etüt mesulü girişi
/veli/<anahtar>           Veli karnesi
/s/<KOD>                  Online test çözme
```

---

## 4. Rol tablosu (yazma yetkisi)

| İşlem | Yönetici | Etüt mesulü | Öğretmen |
|---|:-:|:-:|:-:|
| Sınıf, öğrenci, ders, program, takvim, müfredat, cetvel | ✓ | ✓ | — |
| Personel: öğretmen / etüt mesulü ekleme, rol, mesulün sınıfları, giriş linki | ✓ | ✓ | — |
| Yoklama | ✓ | ✓ | kendi dersi |
| İşlenen konu | ✓ | ✓ | kendi dersi |
| Sözlü / yazılı başlatma ve puan | ✓ | sınıfının bütün dersleri | kendi dersi |
| Ödev verme ve durum | ✓ | ✓ | kendi dersi |
| Deneme, optik, TXT | ✓ | ✓ | — |
| Takip, analiz, veli | ✓ | ✓ (varsayılan kendi sınıfları) | — |

Denetim: sayfalarda `requireOwner` / `requireStaff`, API'de `ownerOrThrow` (yönetici + etüt mesulü) ve `actorOrThrow` (öğretmenin de kullandığı rotalar: yoklama, ödev, işlenen konu, sözlü/yazılı). Kod: `modules/identity/internal/tenant.ts`.
