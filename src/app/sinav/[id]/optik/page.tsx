import Link from "next/link";
import FormSvg from "@/shared/omr/FormSvg";
import OmrScanner from "@/shared/omr/OmrScanner";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { omrForm } from "@/modules/online-test/server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await omrForm(await requireOwner(), id);
  if (!form) notFound();
  const { info, key, skipped } = form;

  if (info.questions.length === 0) {
    return (
      <div className="card mt-6 p-12 text-center text-slate-500">
        Optik form için sınavda en az bir <b>tek cevaplı çoktan seçmeli</b> veya <b>doğru/yanlış</b> soru olmalı.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="card p-4">
          <h2 className="font-semibold">1. Formu yazdırın</h2>
          <p className="mt-1 text-sm text-slate-500">
            {info.questions.length} soruluk form. Öğrenciler kurşun kalemle baloncukları doldurur.
          </p>
          <FormSvg info={info} className="mt-3 w-full rounded ring-1 ring-slate-200" />
          <Link href={`/sinav/${id}/optik/yazdir`} target="_blank" className="btn-primary mt-3 w-full">🖨️ Formu yazdır</Link>
          {skipped > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              {skipped} soru (çok cevaplı / kısa cevaplı) formda yer almaz; bu sorular boş sayılır.
            </p>
          )}
        </div>
        <div className="card p-4 text-sm text-slate-600">
          <h3 className="font-semibold text-slate-800">İpuçları</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Formun dört köşesindeki siyah kareler fotoğrafta görünmeli.</li>
            <li>Düz bir zeminde, gölgesiz ve yukarıdan çekin.</li>
            <li>Tarayıcıdan (scanner) alınan JPG/PNG en iyi sonucu verir.</li>
            <li>Okunan cevapları kaydetmeden önce elle düzeltebilirsiniz.</li>
          </ul>
        </div>
      </aside>
      <OmrScanner spec={info} keys={{ A: key }} saveUrl={`/api/tests/${id}/omr`} resultsHref={`/sinav/${id}/sonuclar`} />
    </div>
  );
}
