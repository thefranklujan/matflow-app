/**
 * Platform (MatFlow staff) authorization. The ONLY source of platform admin is
 * Member.isPlatformAdmin on the Member row the signed session names. The
 * session email is never consulted for authority: anyone can register an
 * account with any email (audit C1, 2026-11-08).
 *
 * Impersonation (gym, student, demo) writes the platform admin's member id
 * into the signed session as `impersonatorId`. Exit restores that member by id
 * and re-derives their role (audit C2). No cookie is an authority source.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, getSession, type SessionUser } from "@/lib/local-auth";
import { isGymOwner } from "@/lib/gym-owner";

/** True when `session` is a platform admin's own (non-impersonated) session. */
export async function isPlatformAdminSession(session: SessionUser | null): Promise<boolean> {
  if (!session || session.impersonatorId) return false;
  // Only sessions minted by member login (or by restoreImpersonator) carry
  // userType "member". The pre-hotfix exit and impersonate routes minted
  // tokens with no userType for any email a cookie named; they must never
  // become platform sessions once the flag is backfilled (review finding 1).
  if (session.userType !== "member" || !session.memberId) return false;
  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: { isPlatformAdmin: true, email: true },
  });
  return (
    !!member?.isPlatformAdmin &&
    member.email.trim().toLowerCase() === (session.email ?? "").trim().toLowerCase()
  );
}

/** The current session when it belongs to a platform admin, otherwise null. */
export async function getPlatformAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  return (await isPlatformAdminSession(session)) ? session : null;
}

export class PlatformAdminError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "PlatformAdminError";
  }
}

/** Throws PlatformAdminError unless the caller is a platform admin. */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const session = await getPlatformAdminSession();
  if (!session) throw new PlatformAdminError();
  return session;
}

/**
 * For /platform server pages that read data. The layout checks too, but a
 * layout check alone is not a boundary in the App Router (a page segment can
 * render without its parent layout), so every data page checks for itself.
 */
export async function requirePlatformAdminPage(): Promise<SessionUser> {
  const session = await getPlatformAdminSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Legacy origin cookies. Deleted on exit; never read. */
export const LEGACY_ORIGIN_COOKIES = ["view_gym_origin", "view_student_origin", "demo_mode_origin"] as const;

export type ExitResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 403; error: string };

/**
 * End an impersonation: requires a valid session that carries
 * `impersonatorId`, restores that Member by id only when it is still a
 * platform admin, and re-derives the role instead of forcing "admin".
 */
export async function restoreImpersonator(): Promise<ExitResult> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "Not signed in" };
  if (!session.impersonatorId) return { ok: false, status: 400, error: "Not impersonating" };

  const admin = await prisma.member.findUnique({ where: { id: session.impersonatorId } });
  if (!admin || !admin.isPlatformAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  await createSession({
    userId: admin.clerkUserId,
    email: admin.email,
    name: `${admin.firstName} ${admin.lastName}`,
    role: (await isGymOwner(admin)) ? "admin" : "member",
    gymId: admin.gymId,
    memberId: admin.id,
    userType: "member",
  });
  return { ok: true };
}
