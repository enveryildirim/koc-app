import { Suspense } from "react";
import AuthForm from "@/modules/identity/ui/AuthForm";

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
