import { redirect } from "next/navigation";
import { getSession } from "@/lib/local-auth";

/**
 * Compatibility redirect for the retired standalone onboarding form.
 * Academies are created during sign-up now (see /sign-up), so this route only
 * routes whoever lands on an old link to where they actually belong.
 */
export default async function OnboardingRedirectPage() {
  const session = await getSession();

  if (!session) redirect("/sign-up");
  if (session.userType === "student") redirect("/student");
  redirect("/app");
}
