# Yapay zekâ bağlantısı (MCP)

Öğretmenin kullandığı yapay zekâ agent'ı (Claude Code, Claude Desktop, Cursor ve MCP destekleyen diğerleri) soru havuzuna bağlanır. Agent soruları:

- yazar,
- kaynaktan aktarır (PDF, fotoğraf, Word),
- kesilmiş soruları yazıya geçirir.

Soruyu agent'ın kendi modeli üretir; uygulamada model çağrısı ya da API ücreti yok. Agent'ın eklediği her soru, öğretmen onaylayana kadar havuzda ve sınav kurarken görünmez.

Bu belge iki okuyucu için: bağlantıyı kuran öğretmen / yönetici (1–5) ve geliştirici (6).

## 1. Bağlanma

### Uzaktan (önerilen)

Uygulama nerede çalışıyorsa agent oradan bağlanır: `https://<uygulama adresi>/api/mcp`.

1. **Soru havuzu → Yapay zekâ bağlantısı** sayfasını açın (`/kurum/soru-havuzu/baglanti`).
2. Anahtara bir ad verin (ör. "Ayşe hoca · Cursor") ve **Anahtar oluştur**'a basın.
3. Anahtarı hemen kopyalayın. Sayfadan ayrılınca bir daha gösterilmez; kaybolursa yenisini oluşturun.
4. Sayfadaki hazır komutu ya da ayarı kullanın (anahtar içine yazılmış gelir):

**Claude Code**

```bash
claude mcp add --transport http rea-question-bank https://<adres>/api/mcp --header "Authorization: Bearer rqb_…"
```

**Claude Desktop, Cursor ve JSON ayarı kullananlar**

```json
{
  "mcpServers": {
    "rea-question-bank": {
      "type": "http",
      "url": "https://<adres>/api/mcp",
      "headers": { "Authorization": "Bearer rqb_…" }
    }
  }
}
```

Uzaktan bağlantıda görseller dosya yolu olarak değil, base64 olarak gönderilir. Agent bunu kendisi yapar.

### Yerel (veritabanının olduğu bilgisayarda)

Anahtar gerekmez. Proje klasöründeki `.mcp.json` Claude Code'a sunucuyu tanıtır (`npm run mcp`). Başka bir araçta proje yolunu verin:

```json
{
  "mcpServers": {
    "rea-question-bank": { "command": "npm", "args": ["--prefix", "/proje/yolu", "run", "--silent", "mcp"] }
  }
}
```

Veritabanında birden fazla kurum hesabı varsa `MCP_OWNER_EMAIL=<hesap e-postası>` ortam değişkenini verin. İnceleme bağlantıları varsayılan olarak `http://localhost:3000`'e gider; değiştirmek için `MCP_APP_URL`.

Yerelde görsel, dosya yolu (`image.path`) ya da base64 olarak gönderilebilir.

## 2. Ne istenebilir

Agent'a doğal dille yazmanız yeterli. Örnekler:

- "10. sınıf matematik, *Trigonometrik oranlar* konusundan 5 çoktan seçmeli soru yaz."
- "Şu PDF'teki soruları havuza aktar: ~/Belgeler/deneme-3.pdf" (cevap anahtarıyla, şekiller kesilerek)
- "Bu soruların benzerini, sayıları değiştirerek 3'er tane üret."
- "Havuzdaki metinsiz (kesilmiş) soruları yazıya geçir."

Agent eksik bilgiyi tek mesajda sorar: ders, sınıf düzeyi; yeni yazmada konu, sayı ve tür. Seçenekleri havuzdan alır.

**Hazır tarifler.** Claude Code'da `/mcp__rea-question-bank__<ad>` ile çağrılır:

| Tarif | Ne yapar |
|---|---|
| `write_questions` | Yeni soru yazar: konu, sayı, tür, zorluk ve isteğe bağlı esinlenilecek kaynak |
| `import_questions` | Bir dosyadaki soruları olduğu gibi aktarır: cevap anahtarı, şekiller |
| `transcribe_questions` | Kesilmiş (yalnızca görsel) soruların metnini yazar |

## 3. Onay

Agent'ın eklediği sorular **Soru havuzu → Durum: Onay bekleyen** listesine düşer (`/kurum/soru-havuzu?durum=onay`). Liste gruplara ayrılmıştır:

| Grup | Anlamı | Ne yapılır |
|---|---|---|
| Havuzda aynısı var | Metni havuzdaki bir soruyla neredeyse aynı | "Karşılaştırın" ile iki soruyu yan yana açın; tekrarsa silin |
| Agent notu var | Agent bir noktadan emin değil (okunamayan yer, şüpheli anahtar, varsayım) | Notu okuyun, soruyu düzeltin |
| Anahtarsız, agent çözdü | Kaynakta cevap anahtarı yoktu; cevabı agent buldu | Cevabı kontrol edin |
| Cevabı eksik | Cevap girilmemiş | Karttan cevabı işaretleyin |
| Sorunsuz görünen | Yukarıdakilerin hiçbiri | "Listedeki n sorunun tümünü onayla" |

Kartta sorunun nasıl yapıldığı yazar: **YZ · Aktarıldı / Uyarlandı / Yeni yazıldı**. Kaynak ve sayfa, kaynak notunda görünür.

Onaylanmamış soru sınava eklenemez.

## 4. Kesilmiş soruların metni

PDF ya da fotoğraftan kesilen soru görsel olarak saklanır ve kitapçıkta görsel olarak basılır. Metni yoksa aramada çıkmaz ve benzer soru bulmada kullanılamaz. Kartta bu durum **Metinsiz** olarak görünür.

**Agent ile:** "Havuzdaki metinsiz soruları yazıya geçir" ya da `transcribe_questions` tarifi.

- Agent görseli okur, kökü ve şıkları olduğu gibi yazar.
- Formülleri düz metinle yazar (√2, x², π).
- Okuyamadığı soruyu atlar ve size söyler.
- Metin soruyu yeniden onaya düşürmez. Kartta **Metin · YZ** yazar, ayrıntı panelinde "yapay zekâ ile çıkarıldı · kontrol edin" uyarısı görünür.
- Öğretmenin elle yazdığı metnin üzerine yazmaz.

**Elle:** kartta **Metinsiz** rozetine tıklayın. Ayrıntı panelindeki "Soru metni" alanına yazın.

Metin yazılmasa da aynı görselin ikinci kez kesilmesi yakalanır: kesme ekranında "havuzda zaten var" uyarısı çıkar.

## 5. Güvenlik

- **Anahtar:** Anahtar kurumun bütün soru havuzuna erişir (okuma, soru ekleme, metin yazma). Kişiye özel anahtar oluşturun; kullanılmayanı **İptal et** ile kapatın. İptal edilen anahtarla bağlanılamaz. Listede son kullanım zamanı görünür.
- **Saklama:** Uygulama anahtarın kendisini saklamaz, yalnızca özetini tutar.
- **Paylaşılan veri:** Agent'a yalnızca soru havuzu ve müfredat bilgisi gider. Öğrenci ve sonuç verisi MCP'den paylaşılmaz.
- **Sizin sorumluluğunuzda olanlar:**
  - Uzaktan bağlantı yalnızca HTTPS ile yayına alınmalı.
  - İstek sınırı (rate limit) henüz yok.
  - Agent'ın kullandığı model sağlayıcısına (Anthropic, OpenAI…) gönderilen içerik o sağlayıcının koşullarına tabidir. Kitap sayfası aktarırken telif sorumluluğu kurumdadır; agent talimatı bu yüzden her soruda kaynak ve sayfa (kaynak notu) ister.

## 6. Geliştirici notları

| Dosya | İçerik |
|---|---|
| `src/mcp/bank-server.ts` | Araçlar ve tarifler (`createBankServer`); iki giriş noktası da bunu kullanır |
| `src/mcp/server.ts` | Yerel giriş (stdio, `npm run mcp`); kurum `MCP_OWNER_EMAIL` ya da tek hesap |
| `src/app/api/mcp/route.ts` | Uzak giriş (Streamable HTTP, durumsuz, JSON yanıt); kurum API anahtarından |
| `src/mcp/guide.ts` | Agent talimatları (İngilizce): sunucu talimatı ve tarif metinleri |
| `src/mcp/rules/institution.md` | Kuruma özel kurallar; her çağrıda okunur, sunucu yeniden başlatılmadan değişir |
| `src/modules/identity/internal/api-keys.ts` | Anahtar oluşturma / doğrulama / iptal (`ApiKey` tablosu, SHA-256 özeti) |

**Araçlar**

| Araç | İş |
|---|---|
| `get_bank_context` | Dersler, düzeyler, soru türü kuralları, müfredat konu / kazanımları, kurum kuralları |
| `search_questions` | Kelime araması ya da `similarTo` ile taslağın havuzdaki aynı / benzer soruları |
| `add_questions` | Soruları kaydeder: hepsi ya da hiçbiri. Onay bekler. Yanıtta `similar` (tekrar adayları) |
| `list_untranscribed` | Metinsiz kesilmiş soruları görselleriyle verir (en fazla 20) |
| `set_question_text` | Kesilmiş sorulara metin yazar (`transcriptBy = AI`; elle yazılanı ezmez) |

**Kayıttaki alanlar** (QuestionItem):

| Alan | Değer |
|---|---|
| `origin` | `AI` |
| `needsReview` | `true` |
| `basis` | `transcribed` / `adapted` / `original` |
| `answerBy` | `key` (kaynağın anahtarı) / `agent` (agent çözdü) |
| `agentNote` | Agent'ın şüpheleri |
| `transcript` + `transcriptBy` | Kesilmiş sorunun metni ve kimin yazdığı |
| `imageHash` | Kesilmiş görselin parmak izi |

Benzerlik hesabı: `src/modules/question-bank/similarity.ts`, görsel parmak izi: `internal/image-hash.ts`. Gerekçe ve ölçümler: `notes/soru-benzerligi.md`.

**Tuzak.** Modüllerdeki `import "server-only"` Next dışında hata verir. Yerel sunucu `tsconfig.mcp.json` ile bunu boş dosyaya yönlendirir.

**Deneme.** `@modelcontextprotocol/sdk` istemcisiyle:

- yerel için `StdioClientTransport` (`npm run mcp`, `DATABASE_URL` ile test veritabanı),
- uzak için `StreamableHTTPClientTransport` (`Authorization` başlığıyla).
