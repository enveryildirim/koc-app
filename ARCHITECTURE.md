# Mimari — Modüler monolit

SınavKur tek bir Next.js uygulaması ve tek bir veritabanı olarak çalışır. Kod ise iş alanına göre **modüllere** bölünmüştür. Her modül kendi tablolarının sahibidir. Dışarıya küçük bir arayüz sunar, iç işleyişini gizler. Modüller arasındaki kurallar ESLint ile otomatik denetlenir.

## Katmanlar

```
src/
  app/        Yalnızca yönlendirme. Sayfa ve route dosyaları modül fonksiyonlarını çağırır ve sonucu gösterir.
              Bir sayfa birden fazla modülü birleştirebilir. Veritabanına doğrudan erişemez.
  modules/    İş alanları (aşağıdaki tablo).
  shared/     Modüllerden bağımsız altyapı: db, errors, http, date, phone, omr/ (optik form kütüphanesi), ui/.
```

## Modüller

| Modül | Sahip olduğu tablolar | Bağımlı olduğu modüller | Ekranlar |
|---|---|---|---|
| `identity` | User | — | `/giris`, `/kayit`, `/api/auth/*` |
| `enrollment` | Classroom, Student (veli alanları hariç) | identity | `/kurum/ogrenciler`, `/api/kurum/{siniflar,ogrenciler}` |
| `exams` | Exam, ExamResult | identity, enrollment | `/kurum/denemeler/*`, `/api/kurum/denemeler/*` |
| `homework` | Homework, HomeworkStatus | identity, enrollment | `/kurum/odevler/*`, `/api/kurum/odevler/*` |
| `schedule` | Teacher, ScheduleSlot, LessonSession, Attendance | identity, enrollment | `/kurum/ders-programi`, `/kurum/yoklama/*`, `/api/kurum/{ogretmenler,program,yoklama}` |
| `online-test` | Test, Question, Option, Attempt, Answer | identity | `/panel`, `/sinav/*`, `/s/[code]`, `/sonuc/[id]`, `/api/{tests,t,attempts}` |
| `planning` | CalendarEvent, LessonPlan, PlanItem | identity, enrollment, exams, homework, schedule | `/kurum/takvim/*`, `/api/kurum/{takvim,plan}/*` |
| `reporting` | Student.parent* (veli paylaşım alanları) | hepsi (online-test hariç) | `/kurum` (özet), `/kurum/raporlar`, `/kurum/analiz`, `/kurum/veli-karnesi/*`, `/veli/[token]` |

Bağımlılık yönü tektir ve döngü yoktur: `identity ← enrollment ← {exams, homework, schedule} ← planning ← reporting`. Bu yön `eslint.config.mjs` dosyasındaki `MODULES` tablosunda tanımlıdır. Yeni bir bağımlılık gerekiyorsa önce o tabloyu güncelleyin.

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
3. **reporting bir okuma modelidir.** Raporlar birçok modülün tablosunu birlikte okuduğu için `reporting` bütün kurum tablolarını prisma ile doğrudan **okuyabilir**. Bunun tek yazma istisnası veli paylaşım alanlarıdır (`parentToken`, `parentSharedAt`, `parentViewedAt`, `parentNote`).
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
