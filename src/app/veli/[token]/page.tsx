import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { buildParentReport, normalizePeriod } from "@/lib/parentReport";
import VeliKarne from "@/components/kurum/veli/VeliKarne";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Veli Karnesi", robots: { index: false, follow: false } };

type SP = Promise<{ bas?: string; bit?: string }>;

/** Giriş gerektirmeyen veli karnesi. Erişim yalnızca tahmin edilemez paylaşım anahtarıyla. */
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SP }) {
  const { token } = await params;
  const sp = await searchParams;
  const student = token.length >= 20 ? await prisma.student.findUnique({ where: { parentToken: token } }) : null;
  if (!student) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-xl font-bold">Bağlantı geçersiz</h1>
        <p className="mt-2 text-sm text-slate-500">Bu karne bağlantısı hatalı ya da kurum tarafından iptal edilmiş. Güncel bağlantı için kurumla iletişime geçin.</p>
      </div>
    );
  }

  // Kurum yetkilisinin kendi önizlemesi "veli gördü" sayılmaz.
  const viewer = await getUser();
  if (viewer?.id !== student.ownerId) {
    await prisma.student.update({ where: { id: student.id }, data: { parentViewedAt: new Date() } });
  }

  const { from, to } = normalizePeriod(sp.bas, sp.bit);
  const report = await buildParentReport(student.id, from, to);
  return (
    <div className="px-2 py-6 sm:px-4">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] justify-end">
        <PrintButton label="🖨️ Yazdır / PDF olarak kaydet" />
      </div>
      <VeliKarne r={report} />
    </div>
  );
}
