/**
 * Local auth system for development.
 * Uses JWT stored in cookies — no external services needed.
 * Replace with Clerk when going to production.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "matflow-dev-secret-change-in-production"
);
const COOKIE_NAME = "matflow-session";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "member";
  gymId: string;
  memberId: string;
}

// ── Default credentials (dev) ─────────────────────────
const DEFAULT_ADMIN = {
  email: "admin@matflow.dev",
  password: "matflow123",
  firstName: "Admin",
  lastName: "User",
};

const DEFAULT_MEMBER = {
  email: "member@matflow.dev",
  password: "matflow123",
  firstName: "Test",
  lastName: "Member",
};

// ── JWT helpers ───────────────────────────────────────

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ── Ensure default gym + users exist ──────────────────

export async function ensureDefaults() {
  // Create default gym if none exists
  let gym = await prisma.gym.findFirst();
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        clerkOrgId: "local-dev-org",
        name: "Demo Gym",
        slug: "demo-gym",
        timezone: "America/Chicago",
      },
    });
  }

  // Create admin member if not exists
  const adminExists = await prisma.member.findFirst({
    where: { email: DEFAULT_ADMIN.email, gymId: gym.id },
  });
  if (!adminExists) {
    const _hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    await prisma.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: "local-admin",
        email: DEFAULT_ADMIN.email,
        firstName: DEFAULT_ADMIN.firstName,
        lastName: DEFAULT_ADMIN.lastName,
        approved: true,
        active: true,
        beltRank: "black",
        stripes: 4,
        // Store password hash in a field we'll add
      },
    });
    // Store password hash separately since Member model doesn't have it
    // We'll use a simple approach: store in a local file or env
    console.log(`[MatFlow] Admin created: ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`);
  }

  // Create test member if not exists
  const memberExists = await prisma.member.findFirst({
    where: { email: DEFAULT_MEMBER.email, gymId: gym.id },
  });
  if (!memberExists) {
    await prisma.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: "local-member",
        email: DEFAULT_MEMBER.email,
        firstName: DEFAULT_MEMBER.firstName,
        lastName: DEFAULT_MEMBER.lastName,
        approved: true,
        active: true,
        beltRank: "blue",
        stripes: 2,
      },
    });
    console.log(`[MatFlow] Member created: ${DEFAULT_MEMBER.email} / ${DEFAULT_MEMBER.password}`);
  }

  return gym;
}

// ── Login handler ─────────────────────────────────────

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  // Check hardcoded dev credentials
  const gym = await prisma.gym.findFirst();
  if (!gym) return null;

  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    const member = await prisma.member.findFirst({
      where: { email, gymId: gym.id },
    });
    return {
      userId: "local-admin",
      email,
      name: `${DEFAULT_ADMIN.firstName} ${DEFAULT_ADMIN.lastName}`,
      role: "admin",
      gymId: gym.id,
      memberId: member?.id || "admin",
    };
  }

  if (email === DEFAULT_MEMBER.email && password === DEFAULT_MEMBER.password) {
    const member = await prisma.member.findFirst({
      where: { email, gymId: gym.id },
    });
    if (!member) return null;
    return {
      userId: "local-member",
      email,
      name: `${DEFAULT_MEMBER.firstName} ${DEFAULT_MEMBER.lastName}`,
      role: "member",
      gymId: gym.id,
      memberId: member.id,
    };
  }

  // Check database members (for any manually created accounts)
  // Note: Member model no longer has passwordHash — skip DB auth for now
  return null;
}
