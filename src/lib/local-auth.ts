/**
 * Auth system using JWT + bcrypt with Prisma/Postgres.
 * Supports gym owner registration, member sign-up, and login.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "matflow-dev-secret-change-in-production"
);
const COOKIE_NAME = "matflow-session";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "member";
  gymId: string;
  memberId: string;
  userType?: "student" | "member";
  studentId?: string;
}

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

// ── Register gym owner ───────────────────────────────

export async function registerGymOwner(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gymName: string;
  gymSlug: string;
  timezone?: string;
}): Promise<{ gym: { id: string; name: string; slug: string }; member: { id: string } }> {
  // Check if email already exists
  const existing = await prisma.member.findFirst({ where: { email: data.email } });
  if (existing) throw new Error("An account with this email already exists");

  // Check if slug is taken
  const slugTaken = await prisma.gym.findUnique({ where: { slug: data.gymSlug } });
  if (slugTaken) throw new Error("This gym URL is already taken");

  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create gym + admin member in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const gym = await tx.gym.create({
      data: {
        clerkOrgId: `owner-${Date.now()}`,
        name: data.gymName,
        slug: data.gymSlug,
        timezone: data.timezone || "America/Chicago",
        // Free forever for gyms under 15 members. They upgrade only when they grow.
        subscriptionStatus: "free",
        trialEndsAt: null,
      },
    });

    const member = await tx.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: `owner-${Date.now()}`,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        approved: true,
        active: true,
        beltRank: "black",
        stripes: 0,
      },
    });

    return { gym, member };
  });

  return {
    gym: { id: result.gym.id, name: result.gym.name, slug: result.gym.slug },
    member: { id: result.member.id },
  };
}

// ── Register member (joins existing gym) ─────────────

export async function registerMember(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gymSlug: string;
}): Promise<{ member: { id: string; gymId: string } }> {
  const gym = await prisma.gym.findUnique({ where: { slug: data.gymSlug } });
  if (!gym) throw new Error("Gym not found");

  const existing = await prisma.member.findFirst({
    where: { email: data.email, gymId: gym.id },
  });
  if (existing) throw new Error("An account with this email already exists at this gym");

  const passwordHash = await bcrypt.hash(data.password, 10);

  const member = await prisma.member.create({
    data: {
      gymId: gym.id,
      clerkUserId: `member-${Date.now()}`,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      approved: true,
      active: true,
      beltRank: "white",
      stripes: 0,
    },
  });

  return { member: { id: member.id, gymId: gym.id } };
}

// ── Register Student ─────────────────────────────────

export async function registerStudent(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
  const existing = await prisma.student.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("An account with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const student = await prisma.student.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      passwordHash,
    },
  });

  return { id: student.id, email: student.email, firstName: student.firstName, lastName: student.lastName };
}

// ── Authenticate Student ─────────────────────────────

export async function authenticateStudent(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const student = await prisma.student.findUnique({ where: { email } });
  if (!student) return null;

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return null;

  return {
    userId: `student-${student.id}`,
    email: student.email,
    name: `${student.firstName} ${student.lastName}`,
    role: "member",
    gymId: "",
    memberId: "",
    userType: "student",
    studentId: student.id,
  };
}

// ── Login handler ─────────────────────────────────────

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  // Try Student first (direct sign-ups go here)
  const studentSession = await authenticateStudent(email, password);
  if (studentSession) return studentSession;

  // Find member by email (could be in any gym)
  const member = await prisma.member.findFirst({
    where: { email },
    include: { gym: true },
  });

  if (!member) return null;

  // Check password
  if (!member.passwordHash) return null;
  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) return null;

  // Determine role: first member created for a gym is admin
  const firstMember = await prisma.member.findFirst({
    where: { gymId: member.gymId },
    orderBy: { createdAt: "asc" },
  });
  const isAdmin = firstMember?.id === member.id;

  return {
    userId: member.clerkUserId,
    email: member.email,
    name: `${member.firstName} ${member.lastName}`,
    role: isAdmin ? "admin" : "member",
    gymId: member.gymId,
    memberId: member.id,
    userType: "member",
  };
}

// ── Legacy: ensure defaults (for backward compat) ────

export async function ensureDefaults() {
  let gym = await prisma.gym.findFirst();
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        clerkOrgId: "default-gym",
        name: "Demo Gym",
        slug: "demo-gym",
        timezone: "America/Chicago",
      },
    });
  }
  return gym;
}
