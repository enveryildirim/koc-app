import { Suspense } from "react";
import Link from "next/link";
import AuthForm from "@/modules/identity/ui/AuthForm";
import { allowRegistration } from "@/modules/identity/server";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!allowRegistration()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Hesap açma kapalı</h1>
          <p className="mt-3 text-sm text-lead">Yeni kurum hesabı açmak için yöneticiyle iletişime geçin.</p>
          <Link href="/giris" className="btn-primary mt-6 w-full">Giriş yap</Link>
        </div>
      </div>
    );
  }
  return (
    <Suspense>
      <AuthForm mode="register" demo={false} registration />
    </Suspense>
  );
}
