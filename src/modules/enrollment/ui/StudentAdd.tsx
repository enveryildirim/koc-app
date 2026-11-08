"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Drawer, { enterSubmits } from "@/shared/ui/Drawer";
import { EMPTY_STUDENT, StudentFields, type StudentValues } from "./StudentForm";

/**
 * Öğrenciler sayfasındaki "+ Öğrenci ekle" paneli (`?yeni=1`).
 * Kaydet → panel kapanır, eklenenler listede vurgulanır (`?eklendi=<id,…>`).
 * Kaydet ve yenisini ekle → panel açık kalır; sınıf korunur, numara bir sonrakine geçer.
 */
export default function StudentAdd({
  open,
  classes,
  nextNo,
  defaultClassId = "",
}: {
  open: boolean;
  classes: { id: string; name: string }[];
  /** Önerilen numara (kurumdaki en büyük numara + 1) */
  nextNo: string;
  /** Liste bir sınıfa süzülmüşse o sınıf */
  defaultClassId?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const fresh = (classroomId: string, no: string): StudentValues => ({ ...EMPTY_STUDENT, classroomId, studentNo: no });
  const [v, setV] = useState<StudentValues>(() => fresh(defaultClassId, nextNo));
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** Paneli kapatır; bu oturumda eklenenler listede vurgulanır. */
  const close = (ids = added.map((a) => a.id)) => {
    const p = new URLSearchParams(params);
    p.delete("yeni");
    if (ids.length) p.set("eklendi", ids.slice(-50).join(","));
    setAdded([]);
    setError("");
    router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  async function save(again: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/kurum/ogrenciler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Kaydedilemedi.");
    const list = [...added, { id: json.id as string, name: `${v.firstName} ${v.lastName}` }];
    // Sıradaki numara: önerilen numaradan küçük elle bir numara girildiyse öneriye döner
    const following = Math.max(Number(nextNo) || 0, Number(v.studentNo) + 1);
    const no = following <= 999_999 ? String(following) : "";
    if (again) {
      setAdded(list);
      setV(fresh(v.classroomId, no));
      router.refresh();
    } else {
      setV(fresh(v.classroomId, no));
      close(list.map((a) => a.id));
      router.refresh();
    }
  }

  const ready = v.studentNo.trim() && v.firstName.trim() && v.lastName.trim();
  return (
    <Drawer
      open={open}
      title="Öğrenci ekle"
      onClose={() => close()}
      footer={
        <>
          <button className="btn-primary" disabled={busy || !ready} onClick={() => save(false)}>Kaydet</button>
          <button className="btn-secondary" disabled={busy || !ready} onClick={() => save(true)}>Kaydet ve yenisini ekle</button>
          <button className="btn ml-auto text-lead" onClick={() => close()}>Vazgeç</button>
        </>
      }
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={enterSubmits(() => ready && save(true))}
        className="space-y-3"
      >
        <StudentFields v={v} onChange={setV} classes={classes} noHint="Sıradaki numara yazıldı; okul numarasını kullanıyorsanız değiştirin." />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {added.length > 0 && !error && (
          <p className="text-sm text-emerald-700">
            Eklendi: {added.map((a) => a.name).join(", ")}
          </p>
        )}
      </form>
    </Drawer>
  );
}
