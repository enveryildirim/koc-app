# Mimari — Modüler monolit

SınavKur tek bir Next.js uygulaması ve tek bir veritabanı olarak çalışır. Kod ise iş alanına göre **modüllere** bölünmüştür. Her modül kendi tablolarının sahibidir. Dışarıya küçük bir arayüz sunar, iç işleyişini gizler. Modüller arasındaki kurallar ESLint ile otomatik denetlenir.

## Katmanlar

```
src/
  app/        Yalnızca yönlendirme. Sayfa ve route dosyaları modül fonksiyonlarını çağırır ve sonucu gösterir.
              Bir sayfa birden fazla modülü birleştirebilir. Veritabanına doğrudan erişemez.
  modules/    İş alanları (aşağıdaki tablo).
  shared/     Modüllerden bağımsız altyapı: db, errors, http, date, phone, storage (kurum dosyaları), omr/ (optik form kütüphanesi), ui/.
```

## Modüller

| Modül | Sahip olduğu tablolar | Bağımlı olduğu modüller | Ekranlar |
|---|---|---|---|
| `identity` | User, AccessLink | — | `/giris`, `/kayit`, `/o/[token]`, `/api/auth/*` |
| `enrollment` | Classroom, Student (veli alanları hariç), ClassMember | identity | `/kurum/ogrenciler`, `/kurum/siniflar/[id]`, `/api/kurum/{siniflar,ogrenciler}` |
| `exams` | Exam, ExamResult | identity, enrollment, question-bank, schedule | `/kurum/denemeler/*`, `/api/kurum/denemeler/*` |
| `homework` | Homework, HomeworkStatus | identity, enrollment, schedule | `/kurum/odevler/*`, `/api/kurum/odevler/*` |
| `schedule` | Teacher, Course, ScheduleSlot, LessonSession, Attendance | identity, enrollment | `/kurum/ders-programi`, `/kurum/yoklama/*`, `/api/kurum/{ogretmenler,dersler,program,yoklama}` |
| `question-bank` | QuestionSource, QuestionItem | identity | `/kurum/soru-havuzu/*`, `/api/kurum/soru-havuzu/*` |
| `curriculum` | CurriculumTopic | identity | `/kurum/mufredat`, `/api/kurum/mufredat/*` |
| `online-test` | Test, Question, Option, Attempt, Answer | identity | `/panel`, `/sinav/*`, `/s/[code]`, `/sonuc/[id]`, `/api/{tests,t,attempts}` |
| `planning` | CalendarEvent, LessonPlan, PlanItem | identity, enrollment, exams, homework, schedule | `/kurum/takvim/*` (haftalık plan içe aktarma dahil), `/api/kurum/{takvim,plan}/*` |
| `assessment` | Rubric, Assessment, AssessmentScore | identity, enrollment, schedule, planning | `/kurum/degerlendirme/*`, `/ogretmen/degerlendirme/*`, `/api/kurum/{degerlendirme,puan-cetvelleri}/*` |
| `reporting` | Student.parent* (veli paylaşım alanları), Setting, ParentDispatch | hepsi (online-test ve question-bank hariç; assessment dahil) | `/kurum` (özet), `/kurum/takip`, `/kurum/raporlar`, `/kurum/analiz`, `/kurum/veli-karnesi/*`, `/veli/[token]` |

Bağımlılık yönü tektir ve döngü yoktur: `identity ← enrollment ← schedule ← {exams, homework} ← planning ← assessment ← reporting`; `question-bank` yalnızca `identity`'ye bağlıdır; `exams` havuzdan deneme kurarken onu okur (`question-bank/internal/for-exams.ts`). Bu yön `eslint.config.mjs` dosyasındaki `MODULES` tablosunda tanımlıdır. Yeni bir bağımlılık gerekiyorsa önce o tabloyu güncelleyin.

## Bir modülün içi

```
modules/<m>/
  index.ts     İstemci + sunucu güvenli: tipler, etiketler, saf fonksiyonlar.
               "use client" bileşenleri yalnızca bunu import eder.
  server.ts    `import "server-only"` + internal/ dosyalarının dışa açılan fonksiyonları.
               İstemci bileşenine girerse derleme kırılır.
  internal/    Sorgular ve iş kuralları. Yalnızca modülün kendisi import eder.
  ui/          Modülün React bileşenleri.
```

## Kurallar

1. **Kiracı izolasyonu modülün içindedir.** Kurumla ilgili her sunucu fonksiyonu ilk parametre olarak `ownerId` alır ve filtreyi kendisi uygular. Başka kurumun kaydı "yok" sayılır (`notFound`). Sayfa ve route'lar `ownerId` filtresi yazmaz.
2. **Yazma yalnızca tablonun sahibi olan modülde yapılır.** Başka modülün verisi gerekiyorsa o modülün `server.ts` fonksiyonu kullanılır. Bir modül yalnızca başka bir modül için gereken fonksiyonu kendi `internal/for-<istemci>.ts` dosyasına koyar (örnek: `exams/internal/for-enrollment.ts`).
3. **reporting bir okuma modelidir.** Raporlar birçok modülün tablosunu birlikte okuduğu için `reporting` bütün kurum tablolarını prisma ile doğrudan **okuyabilir**. Yazma istisnaları veli paylaşım alanları (`parentToken`, `parentSharedAt`, `parentViewedAt`, `parentNote`) ve kendi tablolarıdır: `Setting` (Başarı Skoru ayarları, haftalık rapor şablonu) ve `ParentDispatch` (haftalık veli raporu notu ve gönderim kaydı).
4. **Hatalar Next.js'ten bağımsızdır.** Modüller `shared/errors` hatalarını fırlatır (`invalid`, `notFound`, `conflict`, `unauthorized`). Route'lar `shared/http > api()` ile sarılır; bu sarmalayıcı hatayı `{ error }` gövdeli 400/404/409/401 yanıtına çevirir:
   ```ts
   export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
     await deleteClassroom(await ownerOrThrow(), (await ctx.params).id);
   });
   ```
   Sayfalar için ayrı fonksiyonlar vardır (`findExam`, `findStudent` vb.). Bunlar `null` döner; sayfa da Next'in `notFound()` fonksiyonunu çağırır.
5. **Herkese açık akışlar açıkça adlandırılır.** Giriş gerektirmeyen fonksiyonlar `ownerId` almaz ve adlarından anlaşılır: `publicTestByCode`, `submitPublicAttempt`, `publicAttemptResult`, `parentReportByToken`. Cevap anahtarı gibi gizli verinin gösterilip gösterilmeyeceğine bu fonksiyonlar karar verir.

## Denetim

- `npm run lint` modül sınırlarını denetler:
  - Bir modülün `internal/` klasörü dışarıdan import edilemez.
  - Tanımlı olmayan yönde modül bağımlılığı kurulamaz.
  - `app/` ve `shared/` veritabanına (`@/shared/db`) doğrudan erişemez.
- `server-only` paketi, sunucu kodunun istemci paketine girmesini derleme sırasında engeller.
- Lint, bir modülün **başka modülün tablosuna** prisma ile yazmasını yakalayamaz. Kod incelemesinde 2. ve 3. kurala dikkat edin.

## Yeni özellik eklerken

1. Özelliğin hangi modülün tablolarına yazdığını belirleyin; kod o modüle gider.
2. Fonksiyonu `internal/` içine yazın, `server.ts`'ten dışa açın. İlk parametre `ownerId` olsun.
3. Sayfa veya route bu fonksiyonu çağırsın. Route ise `api()` ile sarın.
4. Yeni bir modül gerekiyorsa `eslint.config.mjs > MODULES` tablosuna ekleyin.

## Ders, sınıf üyeliği ve etüt mesulü

- **Ders (`Course`, schedule):** sınıfın dersi; (classroomId, name) tektir. Türü (`kind`): okul, mesleki, dini, hazırlık, etüt. Tür yalnızca varsayılanları belirler. `external` = başka kurumda alınan ders (bilgisini sorumlusu, genelde etüt mesulü girer).
- **Programla bağ:** program satırı eklenince/değişince `courseIdFor` aynı adlı dersi bulur ya da oluşturur (tür addan tahmin edilir: `guessCourseKind`). Eski satırlar `syncCourses` ile bağlanır (sınıf sayfası açılırken). Ders yeniden adlandırılırsa program satırlarının adı da değişir; geçmiş yoklama oturumları değişmez.
- **Ana sınıf ve ek üyelik (enrollment):** `Student.classroomId` ana sınıftır; mevcut özellikler (deneme, karne, skor) buna bakar. `ClassMember` ek sınıflardır. Bir sınıfın bütün öğrencileri `listStudents({ inClass })`; yoklama bunu kullanır.
- **Etüt mesulü:** `Teacher.role = MENTOR`; sınıfa `Classroom.mentorId` ile bağlanır. Classroom enrollment'ındır ama Teacher schedule'ındır; bu yüzden öğretmenin etüt mesulü olduğu route'ta (`schedule > findTeacher`) doğrulanır, sonra `enrollment > setClassroomMentor` yazar.

## Roller ve kişisel giriş linki

- **Oturum türleri** (`identity > getSession`): kurum hesabı (e-posta + şifre) ya da kişisel linkle giren personel (`AccessLink`). JWT'de `sub` = kurum, personelde ayrıca `lid` = link. Link silinir/yenilenirse oturum geçersiz olur (her istekte link aranır).
- **Yetki:** `requireOwner` / `ownerOrThrow` kurum hesabını ve **etüt mesulünü** (yönetici yetkisi) kabul eder; öğretmen panele girerse `/ogretmen`'e yönlenir, kurum API'leri 401 döner. `requireStaff` öğretmen ekranı içindir. `actorOrThrow` öğretmenin de kullandığı rotalar içindir (yoklama, işlenen konu); TEACHER için kaydın o öğretmene ait olduğunu ilgili modül denetler (`schedule > teachesSubject`: programda satırı ya da dersin sorumlusu).
- **Eşitleme:** öğretmenin adı/rolü schedule'dadır; değişince `identity > syncAccessLink`, silinince `revokeAccessLink` çağrılır.
- **Öğretmen ekranı:** `/ogretmen` ("Bugün": eksik girişler + günün dersleri, veri `reporting > teacherAgenda`) ve `/ogretmen/ders` (işlenen konu + telefona uygun yoklama `QuickAttendance`).

## Değerlendirme (`assessment`)

- **Puan cetveli** (`Rubric`) yöneticinindir; kriterler `[{ name, max }]` (1–8 kriter, 1–100). Değerlendirme açılınca kriterler `Assessment.criteria`'ya **kopyalanır**; cetvel sonradan değişse/silinse de puanlar bozulmaz.
- **Değerlendirme** derse (`Course`) bağlıdır; isteğe bağlı plan satırına (`planItemId`, `planTopic`) bağlanır — ezber parçası gibi. Puan: kriter sırasıyla `scores`, `total`, `percent` (0–100) ya da `absent`.
- **Yetki:** öğretmen yalnızca girdiği / sorumlu olduğu derste açar, puan girer, siler (`courseFor` → `schedule > teachesSubject`). Öğrenci sınıfın üyesi olmalı (`listStudents({ inClass })`). Cetvel API'leri yalnızca yönetici.
- **Okumalar:** `listAssessments`, `assessmentSheet`, `studentAssessments` (profil), `classAssessmentSummary` (sınıf sayfası: son 30 gün sayı, ortalama, değerlendirilmemiş öğrenci).

## Soru havuzu (`question-bank`)

- **Dosyalar** `shared/storage` ile `STORAGE_DIR/<ownerId>/` altında durur (varsayılan `./storage`, git dışı). `public/` kullanılmaz; görseller `ownerId` denetleyen route'lardan sunulur. Dosya türü ilk baytlardan belirlenir.
- **Kesme tarayıcıda yapılır.** PDF `pdfjs-dist` ile tuvale çizilir; sunucuya yalnızca kesilmiş PNG'ler ve 0–1 oranlı kutu (`crop`) gider.
- **Otomatik bulma** `question-bank/detect.ts > detectQuestions()` saf fonksiyonudur (mürekkep izdüşümü, sütun ve boşluk analizi). Yapay zekâ dedektörü eklenirken aynı `DetectedBox` tipini döndürmeli; `QuestionItem.origin` (`MANUAL | AUTO | AI`) ve `text` alanları bunun için hazırdır.

## Müfredat (`curriculum`)

- Ders + düzey için ünite / konu / kazanım listesi; Excel ile içe ve dışa aktarılır (`parseCurriculumTable`, `CURRICULUM_COLUMNS`). `sample.ts` örnek (sahte) veridir.
- Diğer modüller müfredata bağımlı değildir: sayfalar müfredat konularını öneri olarak verir (yıllık plan "müfredattan doldur", soru havuzu ve cevap anahtarı konu seçimi). Bağlantı konu **adı** üzerindendir (`planning > topicMatches`).
- Takip ekranı (`reporting > curriculumTracking`) her konu için plan ilerlemesini, havuzdaki soru sayısını ve deneme başarısını okur; düzey → sınıf / deneme türü eşlemesi `curriculum > gradeScope`.
