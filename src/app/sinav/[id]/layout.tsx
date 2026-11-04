import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedTest, requireUser } from "@/lib/auth";
import TestTabs from "@/components/TestTabs";

export default async function TestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const test = await getOwnedTest(id, user.id);
  if (!test) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="no-print">
        <Link href="/panel" className="text-sm text-slate-500 hover:text-slate-800">← Sınavlarım</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Paylaşım kodu</span>
            <span className="rounded bg-slate-900 px-2 py-1 font-mono font-bold text-white">{test.shareCode}</span>
            {test.isPublished && (
              <Link href={`/s/${test.shareCode}`} target="_blank" className="btn-secondary py-1">Sınavı aç ↗</Link>
            )}
          </div>
        </div>
        <TestTabs id={test.id} />
      </div>
      {children}
    </div>
  );
}
