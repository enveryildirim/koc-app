import { notFound } from "next/navigation";
import { publicTestByCode } from "@/modules/online-test/server";
import TakeTest from "@/modules/online-test/ui/TakeTest";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Doğru cevaplar istemciye gönderilmez (publicTestByCode anahtarı içermez).
  const test = await publicTestByCode(code);
  if (!test) notFound();
  return <TakeTest test={test} />;
}
