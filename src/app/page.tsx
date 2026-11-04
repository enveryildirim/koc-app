import Link from "next/link";

const FEATURES = [
  { icon: "📝", title: "Kolay sınav oluşturma", text: "Çoktan seçmeli, çok cevaplı, doğru/yanlış ve kısa cevaplı soruları dakikalar içinde hazırlayın." },
  { icon: "🔗", title: "Link ile paylaşın", text: "Her sınavın kısa bir kodu ve bağlantısı var. Katılımcılar üye olmadan sınava girebilir." },
  { icon: "⏱️", title: "Süre sınırı", text: "Sınava süre koyun; süre dolduğunda cevaplar otomatik olarak gönderilir." },
  { icon: "⚡", title: "Otomatik puanlama", text: "Sonuçlar anında hesaplanır. Katılımcı isterseniz doğru cevapları ve açıklamaları görür." },
  { icon: "📊", title: "Detaylı raporlar", text: "Ortalama, başarı oranı ve soru bazlı analizle hangi konularda eksik olduğunu görün. CSV olarak indirin." },
  { icon: "🖨️", title: "Optik okuyucuyla formları tarayın", text: "Sınavınız için optik form yazdırın, doldurulan formların fotoğrafını yükleyin; cevaplar otomatik okunup puanlansın." },
];

export default function Home() {
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-transparent">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="badge bg-brand-100 text-brand-700">Ücretsiz · Kurulum gerektirmez</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Online sınavlarınızı <span className="text-brand-600">dakikalar içinde</span> hazırlayın
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Soru ekleyin, bağlantıyı paylaşın, sonuçları anında görün. Kâğıt sınavlar için optik form yazdırıp
              telefonla tarayın.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/kayit" className="btn-primary px-6 py-3 text-base">Hemen sınav oluştur</Link>
              <Link href="/s/GENEL1" className="btn-secondary px-6 py-3 text-base">Örnek sınavı çöz</Link>
            </div>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold text-slate-500">Soru 3 / 8</div>
            <div className="mt-2 text-lg font-semibold">İstanbul hangi yılda fethedilmiştir?</div>
            <div className="mt-4 space-y-2">
              {["1071", "1299", "1453", "1517"].map((o, i) => (
                <div
                  key={o}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${i === 2 ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${i === 2 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {"ABCD"[i]}
                  </span>
                  {o}
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-3/8 bg-brand-500" style={{ width: "37%" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">İhtiyacınız olan her şey</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-center text-3xl font-bold">Nasıl çalışır?</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Sınavı oluşturun", "Soruları ekleyin, doğru cevapları işaretleyin, süre ve geçme notunu belirleyin."],
            ["Paylaşın veya yazdırın", "Bağlantıyı gönderin ya da optik formu yazdırıp sınıfta uygulayın."],
            ["Sonuçları inceleyin", "Online cevaplar ve taranan formlar aynı raporda toplanır."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-6">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</div>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl bg-brand-600 p-10 text-center text-white">
          <h2 className="text-2xl font-bold">Denemek için hesap açmanıza bile gerek yok</h2>
          <p className="mt-2 text-brand-100">Demo hesabıyla giriş yapıp hazır sınavları ve sonuçları inceleyin.</p>
          <Link href="/giris?demo=1" className="btn mt-6 bg-white px-6 py-3 text-brand-700 hover:bg-brand-50">Demo hesabıyla gir</Link>
        </div>
      </section>
    </div>
  );
}
