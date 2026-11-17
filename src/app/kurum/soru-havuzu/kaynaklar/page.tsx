import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { listSources } from "@/modules/question-bank/server";
import DeleteSource from "@/modules/question-bank/ui/DeleteSource";
import SourceUpload from "@/modules/question-bank/ui/SourceUpload";
import { Empty, PageHeader, td, th } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

export default async function Page() {
  const ownerId = await requireOwner();
  const sources = await listSources(ownerId);

  return (
    <div>
      <PageHeader
        title="Kaynaktan soru kes"
        sub="Kitap PDF'i ya da sayfa fotoğrafı yükleyin; sorular otomatik bulunur, siz düzeltip havuza eklersiniz."
        back={{ href: "/kurum/soru-havuzu", label: "Soru havuzu" }}
      />
      <SourceUpload />

      {sources.length === 0 ? (
        <Empty>Henüz kaynak yok.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-rule">
              <tr>
                <th className={th}>Kaynak</th>
                <th className={th}>Tür</th>
                <th className={`${th} text-right`}>Sayfa</th>
                <th className={`${th} text-right`}>Kesilen soru</th>
                <th className={th}>Yüklenme</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={`${td} text-lead`}>{s.kind === "PDF" ? "PDF" : "Fotoğraf"}</td>
                  <td className={`${td} num text-right`}>{s.kind === "PDF" ? "—" : s.pages}</td>
                  <td className={`${td} num text-right`}>
                    {s.questions ? <Link href={`/kurum/soru-havuzu?kaynak=${s.id}`} className="underline">{s.questions}</Link> : 0}
                  </td>
                  <td className={`${td} text-lead`}>{fmt(s.createdAt)}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <Link href={`/kurum/soru-havuzu/kes/${s.id}`} className="btn-secondary mr-3 py-1">Soru kes</Link>
                    <DeleteSource id={s.id} name={s.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
