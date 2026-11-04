/** Veli karnesi paylaşımı için istemci yardımcıları. */
import { waPhone } from "@/shared/phone";

export type ShareStudent = {
  id: string;
  name: string;
  studentNo: string;
  className: string;
  parentName: string;
  parentPhone: string;
  token: string | null;
  sharedAt: string | null;
  viewedAt: string | null;
  note: string;
};

export function reportUrl(token: string, from: string, to: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/veli/${token}?bas=${from}&bit=${to}`;
}

const trDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

export function shareMessage(s: ShareStudent, url: string, from: string, to: string, institution: string) {
  const hello = s.parentName ? `Sayın ${s.parentName},` : "Sayın Velimiz,";
  return `${hello} ${s.name} için ${trDate(from)} – ${trDate(to)} dönemine ait deneme, ödev ve devam bilgilerini içeren karneye aşağıdaki bağlantıdan ulaşabilirsiniz:\n${url}\n\n${institution}`;
}

export function whatsappUrl(s: ShareStudent, message: string) {
  const p = waPhone(s.parentPhone);
  const text = encodeURIComponent(message);
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}

export async function manageLinks(action: "share" | "renew" | "revoke", studentIds: string[]) {
  const res = await fetch("/api/kurum/veli", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, studentIds }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "İşlem başarısız.");
  return (await res.json()).students as Record<string, { token: string | null; sharedAt: string | null }>;
}

export async function saveNote(studentId: string, note: string) {
  const res = await fetch("/api/kurum/veli/not", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, note }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Kaydedilemedi.");
}
