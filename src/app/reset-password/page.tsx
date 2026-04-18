import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#080808]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
