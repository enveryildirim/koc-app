# Yayına alma (Dokploy)

SınavKur'u bir sunucuda **Dokploy** ile yayınlama rehberi: hazırlık, ilk kurulum, güncelleme, yedek ve sorun giderme.

> **Durum (25 Kasım 2026):** Bölüm 2'deki maddelerin hepsi yapıldı. Üretim kipinde (`NODE_ENV=production`, standalone sunucu) yerelde denendi: anahtarsız / kısa anahtarla açılmama, güvenli çerez, demo ve kayıt kapalı, sağlık kontrolü, istek sınırları, güvenlik başlıkları, boş veritabanına `migrate deploy`, yedek betiği. Docker imajı henüz derlenip denenmedi (yerelde Docker çalışmıyordu); ilk Dokploy dağıtımında günlükleri izleyin.

---

## 1. Genel yapı

```
İnternet ──HTTPS──> Traefik (Dokploy) ──:3000──> sinavkur container (Next.js, tek kopya)
                                                     │
                                                     └── /app/data   (adlandırılmış volume: sinavkur-data)
                                                           ├── app.db         SQLite veritabanı
                                                           ├── storage/       kesim görselleri, kaynak PDF'ler
                                                           └── backups/       günlük tutarlı veritabanı kopyaları
```

- **Tek container, tek kopya.** Veritabanı SQLite, dosyalar yerel diskte. Uygulama birden fazla kopya (replica) çalıştırılmaz.
- **Bütün kalıcı veri tek volume'da** (`/app/data`). Container silinip yeniden kurulsa da veri kalır. Yedek de bu volume'dan alınır.
- **HTTPS** Dokploy'un Traefik'i ve Let's Encrypt ile sağlanır; uygulama yalnızca 3000 portunu dinler.

---

## 2. Yayından önce koddaki değişiklikler

Kontrol listesi. Her madde bittiğinde `[x]` yapın.

**Zorunlu**

- [x] **2.1 `AUTH_SECRET` zorunlu.**
  - Bugün tanımlı değilse oturumlar `"dev-secret"` ile imzalanıyor (`src/modules/identity/internal/session.ts`). Bu, yayında herkesin oturum sahteleyebilmesi demek.
  - Üretimde değişken yoksa ya da kısaysa (32 karakterden az) uygulama açılmamalı.
- [x] **2.2 Güvenli çerez.** Oturum çerezi üretimde `secure: true` (yalnızca HTTPS).
- [x] **2.3 Demo kapalı.**
  - Giriş sayfasındaki "Demo hesabıyla gir" düğmesi üretimde görünmez (`SHOW_DEMO_LOGIN=true` ile açılabilir).
  - Üretimde `prisma db seed` çalıştırılmaz.
- [x] **2.4 Kayıt kapalı.**
  - `/kayit` sayfası ve `POST /api/auth/register` yalnızca `ALLOW_REGISTRATION=true` iken çalışır. Varsayılan kapalı.
- [x] **2.5 Dockerfile ve `.dockerignore`.**
  - `next.config.ts`'de `output: "standalone"`.
  - Çok aşamalı imaj (Debian tabanlı `node:22-slim`; sharp ve Prisma için).
  - Prisma CLI imajda kalır (açılışta migration çalışır).
  - `.env`, `prisma/*.db`, `storage/`, `notes/`, `.next*` imaja girmez.
- [x] **2.6 Prisma Migrate.**
  - Geliştirmede `prisma db push` kullanıldı. Yayında şema değişiklikleri kayıtlı migration'larla yapılır.
  - Mevcut şemadan başlangıç migration'ı çıkarılır (`prisma/migrations/0_init`).
  - Container açılırken önce `prisma migrate deploy`, sonra sunucu çalışır.
  - Geliştiriciler bundan sonra şema değiştirince `prisma migrate dev --name <ad>` kullanır.
- [x] **2.7 Sağlık kontrolü.**
  - `GET /api/health`: veritabanına basit bir sorgu atar; sorun yoksa `200 {"ok":true}`, yoksa `503`.
- [x] **2.8 Tutarlı veritabanı yedeği.**
  - `npm run db:backup` (imajda düz `node` betiği olarak).
  - SQLite'ın `VACUUM INTO` komutuyla `/app/data/backups/app-YYYYMMDD.db` yazar.
  - 14 günden eski kopyaları siler.

**Kısa sürede**

- [x] **2.9 İstek sınırı:** girişe (şifre deneme) ve `/api/mcp`'ye.
- [x] **2.10 Güvenlik başlıkları:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.

**Nerede?**

| Madde | Dosya |
|---|---|
| 2.1–2.4 | `src/modules/identity/internal/config.ts` (ayarlar), `src/instrumentation.ts` (açılış denetimi) |
| 2.5 | `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`, `next.config.ts` |
| 2.6 | `prisma/migrations/` |
| 2.7 | `src/app/api/health/route.ts` |
| 2.8 | `scripts/db-backup.mjs` |
| 2.9 | `src/shared/rateLimit.ts`: giriş 15 dakikada adres başına 30, e-posta başına 10; kayıt saatte 5; `/api/mcp` dakikada 300, geçersiz anahtarla 10 dakikada 20. Sayaçlar bellekte (tek kopya), yeniden başlatmada sıfırlanır |
| 2.10 | `next.config.ts` |

**Geliştiriciler için (migration düzeni)**
- Şema değişikliği: `schema.prisma`'yı düzenleyin → `npm run db:migrate -- --name <ad>`. Oluşan `prisma/migrations/<tarih>_<ad>/` klasörünü commit'leyin.
- `prisma db push` artık kullanılmaz; yayındaki veritabanı yalnızca migration'larla değişir.
- `db push` ile kurulmuş eski bir yerel veritabanını bir kez işaretleyin: `npx prisma migrate resolve --applied 0_init` (önce `npx prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel prisma/schema.prisma --script` boş çıkmalı).

---

## 3. Ön koşullar

| Ne | Not |
|---|---|
| Sunucu | Dokploy kurulu. En az 2 GB RAM (derleme sunucuda yapılacaksa); daha küçükse bölüm 9.2 |
| Alan adı | Ör. `sinavkur.<kurum>.com`; A kaydı sunucunun IPv4 adresine |
| Git deposu | GitHub / GitLab / Gitea. Proje henüz bir uzak depoya gönderilmedi: önce gönderin (`git remote add origin …`, `git push`) |
| S3 alanı | Yedekler için: AWS S3, Cloudflare R2, Backblaze B2 vb. |

---

## 4. Ortam değişkenleri

Dokploy → uygulama → **Environment**.

| Değişken | Değer | Zorunlu | Açıklama |
|---|---|---|---|
| `AUTH_SECRET` | 48+ karakter rastgele | Evet | Üretmek için: `openssl rand -base64 48`. Değişirse herkesin oturumu kapanır |
| `DATABASE_URL` | `file:/app/data/app.db` | Evet | Mutlak yol; volume içinde |
| `STORAGE_DIR` | `/app/data/storage` | Evet | Kesim görselleri ve kaynak dosyalar |
| `APP_URL` | `https://sinavkur.<kurum>.com` | Evet | Kitapçık ve karnelere basılan çözüm QR'larının adresi. Yoksa `MCP_APP_URL`, o da yoksa isteğin adresi kullanılır |
| `MCP_APP_URL` | `https://sinavkur.<kurum>.com` | Evet | Yapay zekâ bağlantısındaki adres ve onay bağlantıları |
| `APP_TIME_ZONE` | `Europe/Istanbul` | Hayır | Varsayılan zaten bu |
| `ALLOW_REGISTRATION` | `false` | Hayır | İlk kurum hesabını açarken geçici olarak `true` (bölüm 5.6) |
| `SHOW_DEMO_LOGIN` | `false` | Hayır | Tanıtım sunucusunda `true` |
| `COOKIE_SECURE` | — | Hayır | Yalnızca yerelde HTTP üzerinden üretim derlemesi denerken `false`. Yayında boş bırakın |

`AUTH_SECRET` ve diğer gizli değerleri **build argümanı olarak değil**, çalışma zamanı ortam değişkeni olarak girin; build argümanları imajın içinde kalabilir.

---

## 5. İlk kurulum (Dokploy)

**5.1 Proje ve uygulama**
1. Dokploy → **Create Project** → ad: *SınavKur*.
2. Proje içinde **Create Service → Application** → ad: *sinavkur*.

**5.2 Kaynak**
- **Provider:** Git sağlayıcınız → depo → dal (ör. `main`).
- **Build Type:** **Dockerfile**; Dockerfile yolu `Dockerfile`, context `.`.

**5.3 Kalıcı veri (volume)**
- **Advanced → Volumes / Mounts → Add → Volume Mount** (bind mount değil).
- Volume adı: `sinavkur-data`. Mount yolu: `/app/data`.
- Yedekler yalnızca adlandırılmış volume ile çalışır.

**5.4 Ortam değişkenleri**
- Bölüm 4'teki tabloyu girin. İlk kurulumda `ALLOW_REGISTRATION=true`.

**5.5 Alan adı ve HTTPS**
1. DNS'te A kaydı: `sinavkur.<kurum>.com` → sunucu IP'si.
2. Dokploy → **Domains → Add Domain**:
   - Host: alan adınız
   - Container port: **3000**
   - HTTPS: açık
   - Certificate: **letsencrypt**

**5.6 İlk dağıtım ve kurum hesabı**
1. **Deploy**. Açılışta migration'lar uygulanır, boş veritabanı oluşur.
2. `https://<alan adı>/api/health` → `{"ok":true}`.
3. `https://<alan adı>/kayit` → kurum adı, e-posta, güçlü bir şifre → hesap açılır.
4. Environment'ta `ALLOW_REGISTRATION=false` yapın → **Redeploy**.
5. `/kayit` artık kapalı olmalı; kontrol edin.

**5.7 Sağlık kontrolü** ([Going Production](https://docs.dokploy.com/docs/core/applications/going-production))
- Dokploy'da uygulamanın sağlık kontrolü (healthcheck) ayarına:

```json
{ "Test": ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], "Interval": 30000000000, "Timeout": 10000000000, "StartPeriod": 30000000000, "Retries": 3 }
```

- Yeni sürüm sağlıklı olmazsa trafik eskisinde kalır.

**5.8 Yedek**
1. **Günlük tutarlı kopya.**
   - Dokploy'un zamanlanmış görev (Schedules) özelliğiyle container içinde her gece `npm run db:backup` çalıştırın.
   - Bu özellik sürümünüzde yoksa sunucunun crontab'ına ekleyin:

   ```
   15 3 * * * docker exec $(docker ps -qf "name=sinavkur") npm run db:backup
   ```
2. **Volume yedeği.** Dokploy → **Volume Backups** → volume `sinavkur-data` → S3 hedefi → günlük, ör. 03:30 ([Volume Backups](https://docs.dokploy.com/docs/core/volume-backups)).
   - Volume'un içindeki `backups/` klasörü tutarlı veritabanı kopyalarını, `storage/` dosyaları taşır.
   - Çalışan `app.db`'nin kendisi tutarsız kopyalanabilir; geri dönüşte `backups/` içindeki dosyayı kullanın.

**5.9 Yapay zekâ bağlantısı**
- Giriş yapın → Soru havuzu → **Yapay zekâ bağlantısı** → anahtar oluşturun.
- Sayfadaki adres `https://<alan adı>/api/mcp` olmalı.
- Ayrıntı: [MCP.md](MCP.md).

---

## 6. Güncelleme

1. Değişiklikleri depoya gönderin (`git push`).
2. Dokploy → **Deploy**. İsterseniz otomatik dağıtım (webhook) açın.
3. Açılışta yeni migration'lar uygulanır.

**Şema değişikliğinden önce** elle bir yedek alın: `docker exec <container> npm run db:backup`.

Migration'lar yalnızca ileri yönlü uygulanır. Sütun / tablo silen bir migration'ı yayına göndermeden önce yerelde, yayın verisinin bir kopyasıyla deneyin.

---

## 7. Geri dönüş

**Kod hatası**
- Dokploy → **Deployments** → önceki sürüm → **Rollback**.
- Yeni sürüm migration uyguladıysa eski kod yeni şemayla çalışmayabilir. Bu yüzden şema değişikliklerini geriye uyumlu yazın: önce sütun ekleyin, kullanımdan sonra silin.

**Veri kaybı / bozulma**
1. Uygulamayı durdurun (**Stop**).
2. Volume'daki `backups/app-YYYYMMDD.db` dosyasını `app.db` olarak kopyalayın:
   - konteynerin dışından `docker run --rm -v sinavkur-data:/d alpine cp /d/backups/app-20261117.db /d/app.db`
   - ya da S3'teki volume yedeğinden geri yükleyin.
3. **Start** → `/api/health` kontrolü.

---

## 8. Sorun giderme

| Belirti | Olası neden | Çözüm |
|---|---|---|
| Container açılır açılmaz kapanıyor, günlükte `AUTH_SECRET` | Değişken eksik / kısa | Bölüm 4 |
| Her dağıtımda veriler sıfırlanıyor | Volume bağlanmamış ya da `DATABASE_URL` göreli yol | 5.3; `file:/app/data/app.db` |
| Kesim görselleri dağıtımdan sonra kayboluyor | `STORAGE_DIR` volume dışında | `/app/data/storage` |
| HTTPS sertifikası alınamıyor | DNS henüz yayılmadı ya da 80 / 443 kapalı | A kaydını ve güvenlik duvarını kontrol edin; birkaç dakika bekleyin |
| `/api/mcp` 401 | Anahtar yanlış / iptal edilmiş | Yeni anahtar oluşturun ([MCP.md](MCP.md)) |
| MCP'deki onay bağlantıları `localhost`'a gidiyor | `MCP_APP_URL` eksik | Bölüm 4 |
| Saatler 3 saat kayık | Saat dilimi | `APP_TIME_ZONE=Europe/Istanbul`; uygulama sunucudan bağımsız olarak bu dilimi kullanır |
| Derleme sırasında sunucu donuyor | Bellek yetmiyor | Bölüm 9.2 |

---

## 9. Notlar

**9.1 Neden SQLite?**
- Tek kurum ya da birkaç kurum için yeterli; yedeklemesi ve taşıması kolay.
- Kurum sayısı ve eşzamanlı kullanım artarsa PostgreSQL'e geçiş: Prisma `provider` değişir, veriler taşınır, Dokploy'da ayrı bir PostgreSQL servisi kurulur ve Dokploy'un veritabanı yedekleri kullanılır.
- Dosyalar için o aşamada S3'e geçilebilir (`src/shared/storage.ts` tek giriş noktası).

**9.2 Derlemeyi sunucu dışında yapmak**
- Next derlemesi sunucuda yaklaşık 2 GB bellek ister.
- Küçük sunucuda imajı GitHub Actions'ta derleyip bir registry'ye (ör. GHCR) gönderin.
- Dokploy'da kaynağı **Docker image** yapın; Dokploy yalnızca çeker ([Going Production](https://docs.dokploy.com/docs/core/applications/going-production)).

**9.3 Öğrenci verisi**
- Uygulama öğrenci kişisel verisi (ad, numara, sonuç, yoklama) tutar.
- Sunucunun konumu, yedeklerin şifrelenmesi (S3 tarafında) ve erişimi kimlerin yöneteceği, kurumun KVKK yükümlülükleri açısından karara bağlanmalı.

---

Kaynaklar:
- [Dokploy: Build Type](https://docs.dokploy.com/docs/core/applications/build-type)
- [Dokploy: Domains](https://docs.dokploy.com/docs/core/domains)
- [Dokploy: Advanced (Volume Mount)](https://docs.dokploy.com/docs/core/applications/advanced)
- [Dokploy: Volume Backups](https://docs.dokploy.com/docs/core/volume-backups)
- [Dokploy: Going Production](https://docs.dokploy.com/docs/core/applications/going-production)
