import { redirect } from "next/navigation";

/** Eski adres: öğretmenler ve etüt mesulleri artık Personel sayfasında. */
export default async function Page({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const { yeni } = await searchParams;
  redirect(yeni === "1" ? "/kurum/personel?yeni=1" : "/kurum/personel");
}
