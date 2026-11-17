import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { DEFAULT_SUBJECTS, DIFFICULTY, QUESTION_TYPES, TYPE_ORDER } from "@/modules/question-bank";
import { bankSummary, isReviewGroup, listItems, listSources, REVIEW_GROUPS, reviewQueue, similarForItems, tidyBank, type ReviewGroup } from "@/modules/question-bank/server";
import { mergeSubjectNames, mergeTopicSuggestions } from "@/modules/curriculum";
import { listCourses } from "@/modules/schedule/server";
import { curriculumTopicNames } from "@/modules/curriculum/server";
import { bankUsage } from "@/modules/exams/server";
import QuestionGrid from "@/modules/question-bank/ui/QuestionGrid";
import { Empty, Kpi, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

type Search = { ders?: string; konu?: string; zorluk?: string; tur?: string; kaynak?: string; eksik?: string; kullanim?: string; gormedi?: string; durum?: string; onay?: string; q?: string; s?: string };

/** Kullanım süzgeçleri: kullanım kayıtta değil, denemelerden hesaplanır (exams > bankUsage). */
function usageFilter(usage: Awaited<ReturnType<typeof bankUsage>>["usage"], sp: Search) {
  const used = Object.keys(usage);
  const f: { only?: string[]; except?: string[]; rank?: string[] } = {};
  if (sp.kullanim === "hic") f.except = used;
  if (sp.kullanim === "cok") {
    f.only = used;
    f.rank = [...used].sort((a, b) => usage[b].uses.length - usage[a].uses.length || (usage[b].last ?? "").localeCompare(usage[a].last ?? ""));
  }
  if (sp.kullanim === "sorunlu") f.only = used.filter((id) => usage[id].flag);
  if (sp.gormedi) f.except = [...(f.except ?? []), ...used.filter((id) => usage[id].classIds.includes(sp.gormedi!))];
  return f;
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.s) || 1);
  // Havuz toparlanır: ders / konu yazılışları birleşir, kazanım bağları ve arama anahtarı yenilenir (müfredat ya da Dersler değişmiş olabilir)
  const [usage] = await Promise.all([bankUsage(ownerId), tidyBank(ownerId)]);
  const archive = sp.durum === "arsiv";
  const review = sp.durum === "onay";
  const filter = { subject: sp.ders, topic: sp.konu, difficulty: sp.zorluk, type: sp.tur, sourceId: sp.kaynak, missing: sp.eksik, q: sp.q, archived: archive, review, ...usageFilter(usage.usage, sp) };
  // Onay kuyruğu: süzgece uyan bütün onay bekleyenler gruplara ayrılır; ?onay= ile bir grup gösterilir
  const queue = review ? await reviewQueue(ownerId, filter) : null;
  const group: ReviewGroup | null = review && isReviewGroup(sp.onay) ? sp.onay : null;
  if (queue && group) filter.only = filter.only ? queue.groups[group].filter((id) => filter.only!.includes(id)) : queue.groups[group];
  const [summary, sources, list, curTopics, courses] = await Promise.all([
    bankSummary(ownerId, Object.keys(usage.usage)),
    listSources(ownerId),
    listItems(ownerId, filter, page),
    curriculumTopicNames(ownerId),
    listCourses(ownerId),
  ]);
  // Sayfadaki soruların benzerleri (karttaki "Aynısı var" / "Benzeri var" rozeti; ayrıntı panelde açılır)
  const sim = await similarForItems(ownerId, list.items.map((i) => i.id));
  const similar = Object.fromEntries([...sim].map(([id, hs]) => [id, { same: hs.filter((h) => h.kind === "same").length, sibling: hs.filter((h) => h.kind === "sibling").length }]));
  const unused = summary.unused ?? 0;
  const pageUsage = Object.fromEntries(list.items.flatMap((i) => (usage.usage[i.id] ? [[i.id, usage.usage[i.id]]] : [])));
  // Düzenleme önerileri: müfredat konuları önce (havuzda olmasa da seçilebilsin)
  const suggestions = mergeTopicSuggestions(curTopics, summary.topics);
  const subjects = mergeSubjectNames(courses.filter((c) => c.kind !== "STUDY").map((c) => c.name), summary.subjects, Object.keys(curTopics), DEFAULT_SUBJECTS);
  const topicChoices = sp.ders ? summary.topics[sp.ders] ?? [] : [...new Set(Object.values(summary.topics).flat())].sort((a, b) => a.localeCompare(b, "tr"));
  const pages = Math.ceil(list.total / list.pageSize);
  const filtered = Object.entries(sp).some(([k, v]) => k !== "s" && v);
  const href = (s: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), s: String(s) })}`;

  return (
    <div>
      <PageHeader
        title="Soru havuzu"
        sub="Yazdığınız, yapıştırdığınız ya da PDF ve fotoğraftan kestiğiniz sorular."
        actions={
          <>
            <Link href="/kurum/denemeler/havuzdan" className="btn-secondary">Havuzdan sınav</Link>
            <Link href="/kurum/soru-havuzu/kaynaklar" className="btn-secondary">Kaynaktan soru kes</Link>
            <Link href="/kurum/soru-havuzu/yaz" className="btn-primary">+ Soru yaz</Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Kpi
          label="Soru"
          value={summary.total}
          hint={TYPE_ORDER.filter((t) => summary.byType[t]).map((t) => `${QUESTION_TYPES[t].short} ${summary.byType[t]}`).join(" · ") || `${summary.subjects.length} ders`}
        />
        <Kpi
          label="Cevabı girilmemiş"
          value={summary.noAnswer}
          hint={
            <>
              {summary.noAnswer ? <Link href="?eksik=cevap" className="underline">Listele</Link> : "Hepsi tamam"}
              {summary.noOutcome > 0 && <> · <Link href="?eksik=kazanim" className="underline">{summary.noOutcome} kazanımsız</Link></>}
            </>
          }
        />
        <Kpi label="Hiç kullanılmamış" value={unused} hint={unused ? <Link href="?kullanim=hic" className="underline">Listele</Link> : "Hepsi kullanıldı"} />
      </div>

      {summary.pending > 0 && !review && (
        <p className="mb-3 rounded-md bg-mist px-3 py-2 text-sm">
          Yapay zekâ ile eklenen <b className="num">{summary.pending}</b> soru onay bekliyor; onaylanana kadar havuzda ve sınav kurarken görünmez.{" "}
          <Link href="?durum=onay" className="font-semibold text-graphite underline">İncele ve onayla</Link>
        </p>
      )}

      {summary.total === 0 && !summary.archived && !summary.pending ? (
        <Empty>
          Havuz boş. <Link href="/kurum/soru-havuzu/yaz" className="font-semibold text-graphite underline">Soru yazın</Link>,{" "}
          <Link href="/kurum/soru-havuzu/yaz?mod=yapistir" className="font-semibold text-graphite underline">Word&apos;deki soruları yapıştırın</Link> ya da{" "}
          <Link href="/kurum/soru-havuzu/kaynaklar" className="font-semibold text-graphite underline">bir PDF / sayfa fotoğrafı yükleyin</Link>, sorular otomatik bulunsun.
        </Empty>
      ) : (
        <>
          <form className="no-print mb-3 flex flex-wrap items-center gap-2">
            <select name="ders" defaultValue={sp.ders ?? ""} className="input w-auto" aria-label="Ders">
              <option value="">Tüm dersler</option>
              {summary.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="konu" defaultValue={sp.konu ?? ""} className="input w-auto max-w-56" aria-label="Konu">
              <option value="">Tüm konular</option>
              {topicChoices.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select name="zorluk" defaultValue={sp.zorluk ?? ""} className="input w-auto" aria-label="Zorluk">
              <option value="">Her zorluk</option>
              {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="tur" defaultValue={sp.tur ?? ""} className="input w-auto" aria-label="Soru türü">
              <option value="">Her tür</option>
              {TYPE_ORDER.map((t) => <option key={t} value={t}>{QUESTION_TYPES[t].label}</option>)}
            </select>
            <select name="kaynak" defaultValue={sp.kaynak ?? ""} className="input w-auto max-w-56" aria-label="Kaynak">
              <option value="">Tüm kaynaklar</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select name="kullanim" defaultValue={sp.kullanim ?? ""} className="input w-auto" aria-label="Kullanım">
              <option value="">Kullanım: hepsi</option>
              <option value="hic">Hiç kullanılmamış</option>
              <option value="cok">En çok kullanılan</option>
              <option value="sorunlu">Sorunlu (sonuçlara göre)</option>
            </select>
            {usage.classes.length > 0 && (
              <select name="gormedi" defaultValue={sp.gormedi ?? ""} className="input w-auto" aria-label="Görmeyen sınıf">
                <option value="">Sınıf: hepsi</option>
                {usage.classes.map((c) => <option key={c.id} value={c.id}>{c.name} görmedi</option>)}
              </select>
            )}
            <select name="eksik" defaultValue={sp.eksik ?? ""} className="input w-auto" aria-label="Eksik bilgi">
              <option value="">Eksik bilgi: hepsi</option>
              <option value="cevap">Cevabı girilmemiş</option>
              <option value="konu">Konusu girilmemiş</option>
              <option value="kazanim">Kazanımı bağlı değil</option>
              <option value="cozum">Çözümü yazılmamış</option>
            </select>
            {(summary.archived > 0 || summary.pending > 0 || archive || review) && (
              <select name="durum" defaultValue={sp.durum ?? ""} className="input w-auto" aria-label="Durum">
                <option value="">Kullanımda</option>
                <option value="onay">Onay bekleyen ({summary.pending})</option>
                <option value="arsiv">Arşiv ({summary.archived})</option>
              </select>
            )}
            {group && <input type="hidden" name="onay" value={group} />}
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Ders, konu ya da metinde ara" className="input w-40" />
            <button className="btn-secondary">Filtrele</button>
            {filtered && <Link href="/kurum/soru-havuzu" className="text-[13px] text-lead hover:text-graphite">Temizle</Link>}
            <span className="ml-auto text-[13px] text-lead">{list.total} soru</span>
          </form>

          {queue && queue.total > 0 && (
            <nav className="no-print mb-3 flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Onay grupları">
              <span className="mr-1 text-lead">Onay bekleyen {queue.total} soru:</span>
              {([null, ...Object.keys(REVIEW_GROUPS)] as (ReviewGroup | null)[]).map((g) => {
                const n = g ? queue.groups[g].length : queue.total;
                const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "onay" && k !== "s")), ...(g ? { onay: g } : {}) });
                return (
                  <Link
                    key={g ?? "hepsi"}
                    href={`?${params}`}
                    aria-current={group === g ? "true" : undefined}
                    className={`rounded-md px-2.5 py-1 ${group === g ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"} ${!n && g ? "opacity-50" : ""}`}
                  >
                    {g ? REVIEW_GROUPS[g] : "Hepsi"} <span className="num">{n}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {list.items.length === 0 ? (
            <Empty>{archive ? "Arşivde bu filtreye uygun soru yok." : review ? "Onay bekleyen soru yok." : "Bu filtreye uygun soru yok."}</Empty>
          ) : (
            <QuestionGrid items={list.items} subjects={subjects} topics={suggestions} usage={pageUsage} similar={similar} archive={archive} review={review} reviewAll={queue ? { ids: group ? queue.groups[group] : queue.ids, group } : undefined} />
          )}

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="Sayfalar">
              {page > 1 && <Link href={href(page - 1)} className="btn-secondary">‹ Önceki</Link>}
              <span className="num text-lead">{page} / {pages}</span>
              {page < pages && <Link href={href(page + 1)} className="btn-secondary">Sonraki ›</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
