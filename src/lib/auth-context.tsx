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

interface AuthContextValue {
  user: AuthUser | null;
  gym: GymInfo | null;
  billing: BillingInfo | null;
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.gym) setGym(data.gym);
          if (data.billing) setBilling(data.billing);
          if (data.isPlatformAdmin) setIsPlatformAdmin(true);
        }
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
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setGym(null);
    window.location.href = "/sign-in";
  }, []);

  const isTrialExpired = billing?.subscriptionStatus === "trialing"
    && !!billing.trialEndsAt
    && new Date(billing.trialEndsAt) < new Date();

  const isPendingApproval = billing ? !billing.approved : false;

  const isLockedOut = isPendingApproval
    || isTrialExpired
    || billing?.subscriptionStatus === "canceled"
    || billing?.subscriptionStatus === "past_due";

  return (
    <AuthContext.Provider
      value={{
        user,
        gym,
        billing,
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
