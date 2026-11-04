"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTestButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/tests", { method: "POST" });
        const { id } = await res.json();
        router.push(`/sinav/${id}/duzenle`);
      }}
    >
      + Yeni sınav
    </button>
  );
}
