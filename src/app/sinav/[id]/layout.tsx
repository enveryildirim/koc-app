import Link from "next/link";
import { notFound } from "next/navigation";
import { findTest } from "@/modules/online-test/server";
import { requireOwner } from "@/modules/identity/server";
import TestTabs from "@/modules/online-test/ui/TestTabs";

export default async function TestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const test = await findTest(ownerId, id);
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
