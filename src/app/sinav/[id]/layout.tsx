import Link from "next/link";
import { notFound } from "next/navigation";
import { findTest } from "@/modules/online-test/server";
import { requireOwner } from "@/modules/identity/server";
import TestTabs from "@/modules/online-test/ui/TestTabs";
import { PageHeader } from "@/shared/ui/kurum";

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
    <div>
      <PageHeader
        title={test.title}
        back={{ href: "/panel", label: "Online testler" }}
        actions={
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-lead">Paylaşım kodu</span>
            <span className="rounded bg-graphite px-2 py-1 font-mono font-bold text-white">{test.shareCode}</span>
            {test.isPublished && (
              <Link href={`/s/${test.shareCode}`} target="_blank" className="btn-secondary">Sınavı aç ↗</Link>
            )}
          </div>
        }
      />
      <TestTabs id={test.id} />
      {children}
    </div>
  );
}
