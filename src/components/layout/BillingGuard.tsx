"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export function BillingGuard({ children }: { children: React.ReactNode }) {
  const { isLockedOut, isAdmin, isLoading, billing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isBillingPage = pathname === "/app/billing";
  const isSettingsPage = pathname === "/app/settings";

  useEffect(() => {
    if (isLoading) return;
    if (!isLockedOut) return;
    if (isBillingPage || isSettingsPage) return;

    if (isAdmin) {
      router.replace("/app/billing");
    }
  }, [isLockedOut, isAdmin, isLoading, isBillingPage, isSettingsPage, router]);

  if (isLoading) return <>{children}</>;

  // Members see a message instead of being redirected
  if (isLockedOut && !isAdmin && !isBillingPage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Subscription Required</h2>
          <p className="text-gray-400">
            {billing?.subscriptionStatus === "past_due"
              ? "Your gym's payment is past due. Please ask your gym admin to update their payment method."
              : billing?.subscriptionStatus === "canceled"
              ? "Your gym's subscription has been canceled. Please contact your gym admin."
              : "Your gym's free trial has ended. Please contact your gym admin to subscribe."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
