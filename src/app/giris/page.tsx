import { Suspense } from "react";
import AuthForm from "@/modules/identity/ui/AuthForm";
import { allowRegistration, showDemoLogin } from "@/modules/identity/server";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="login" demo={showDemoLogin()} registration={allowRegistration()} />
    </Suspense>
  );
}
