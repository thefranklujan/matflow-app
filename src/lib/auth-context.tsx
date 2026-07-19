"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthUser {
  email: string;
  name: string;
  role: "admin" | "member";
  gymId: string;
  memberId: string;
  studentId?: string;
  userType?: "student" | "member";
}

interface GymInfo {
  name: string;
  logo: string | null;
}

interface BillingInfo {
  approved: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripePriceId: string | null;
}

/** Server-derived entitlement summary (presentation only; server enforces). */
export interface EntitlementInfo {
  state: string;
  plan: "basic" | "pro" | null;
  hasOwnerAccess: boolean;
  memberLimit: number | null;
  unknownPrice: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  gym: GymInfo | null;
  billing: BillingInfo | null;
  entitlement: EntitlementInfo | null;
  isLoading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isPlatformAdmin: boolean;
  isTrialExpired: boolean;
  isPendingApproval: boolean;
  isLockedOut: boolean;
  role: "admin" | "member" | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  gym: null,
  billing: null,
  entitlement: null,
  isLoading: true,
  isAdmin: false,
  isMember: false,
  isPlatformAdmin: false,
  isTrialExpired: false,
  isPendingApproval: false,
  isLockedOut: false,
  role: null,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        // REPLACE every piece of state from this response. A refresh after
        // sign-out, gym switch, or billing change must never retain stale
        // truth (e.g. an old entitlement or platform-admin flag) from an
        // earlier response.
        setUser(data.user ?? null);
        setGym(data.user ? (data.gym ?? null) : null);
        setBilling(data.user ? (data.billing ?? null) : null);
        setEntitlement(data.user ? (data.entitlement ?? null) : null);
        setIsPlatformAdmin(data.user ? !!data.isPlatformAdmin : false);
      }
    } catch {
      // Session fetch failed silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signOut = useCallback(async () => {
    try { await (window as unknown as { __matflowClearNativeAuth?: () => Promise<void> }).__matflowClearNativeAuth?.(); } catch {}
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setGym(null);
    setBilling(null);
    setEntitlement(null);
    setIsPlatformAdmin(false);
    window.location.href = "/sign-in";
  }, []);

  const isTrialExpired = billing?.subscriptionStatus === "trialing"
    && !!billing.trialEndsAt
    && new Date(billing.trialEndsAt) < new Date();

  const isPendingApproval = billing ? !billing.approved : false;

  // Lockout PRESENTATION derives from the server entitlement — the same
  // domain the API guards enforce — so the client can never disagree with the
  // server about cancelled/unpaid/incomplete/paused/unknown states. The
  // legacy billing-string computation remains only as a fallback while an
  // older cached session response (without entitlement) is in flight.
  const isLockedOut = entitlement
    ? !entitlement.hasOwnerAccess
    : isPendingApproval
      || isTrialExpired
      || billing?.subscriptionStatus === "canceled"
      || billing?.subscriptionStatus === "past_due";

  return (
    <AuthContext.Provider
      value={{
        user,
        gym,
        billing,
        entitlement,
        isLoading,
        isAdmin: user?.role === "admin",
        isMember: user?.role === "member",
        isPlatformAdmin,
        isTrialExpired,
        isPendingApproval,
        isLockedOut: !!isLockedOut,
        role: user?.role || null,
        signOut,
        refresh: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
