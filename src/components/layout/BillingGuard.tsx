"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, Clock } from "lucide-react";

export function BillingGuard({ children }: { children: React.ReactNode }) {
  const { isLockedOut, isPendingApproval, isAdmin, isLoading, billing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isBillingPage = pathname === "/app/billing";
  const isSettingsPage = pathname === "/app/settings";

  useEffect(() => {
    if (isLoading) return;
    if (!isLockedOut) return;
    if (isPendingApproval) return;
    if (isBillingPage || isSettingsPage) return;

    if (isAdmin) {
      router.replace("/app/billing");
    }
  }, [isLockedOut, isPendingApproval, isAdmin, isLoading, isBillingPage, isSettingsPage, router]);

  if (isLoading) return <>{children}</>;

  if (isPendingApproval) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111]">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl max-w-md text-center" style={{ padding: "48px 40px" }}>
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-[#c4b5a0]/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-[#c4b5a0]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white" style={{ marginBottom: "12px" }}>Pending Approval</h2>
          <p className="text-gray-400" style={{ marginBottom: "24px", lineHeight: "1.6" }}>
            Your gym account has been created and is waiting for approval.
            You will receive access once your account has been reviewed and approved by the MatFlow team.
          </p>
          <div className="bg-[#c4b5a0]/5 border border-[#c4b5a0]/20 rounded-lg" style={{ padding: "16px" }}>
            <p className="text-[#c4b5a0] text-sm font-medium">
              This usually takes less than 24 hours
            </p>
          </div>
        </div>
      </div>
    );
  }

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
