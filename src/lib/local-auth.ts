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
  phone?: string;
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
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const member = await tx.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: `owner-${Date.now()}`,
        email: data.email,
        phone: data.phone || null,
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

  // Auto-claim any matching nominations so the new owner lands on pre-warmed
  // pipeline instead of an empty pending list. Match on case-insensitive name
  // equality with their newly-created Gym name. Students who nominated get
  // pending JoinRequest records against the real gym; the nominations flip
  // to status "claimed" so they drop off the Find-Your-Gym suggested list.
  try {
    const nominations = await prisma.gymNomination.findMany({
      where: {
        gymName: { equals: result.gym.name, mode: "insensitive" },
        status: { not: "claimed" },
      },
    });

    if (nominations.length > 0) {
      for (const n of nominations) {
        const existingMember = await prisma.member.findFirst({
          where: { gymId: result.gym.id, studentId: n.studentId },
        });
        if (existingMember) continue;

        const existingReq = await prisma.joinRequest.findUnique({
          where: { studentId_gymId: { studentId: n.studentId, gymId: result.gym.id } },
        });
        if (!existingReq) {
          await prisma.joinRequest.create({
            data: {
              studentId: n.studentId,
              gymId: result.gym.id,
              status: "pending",
              message: `Auto-created from nomination when ${result.gym.name} joined MatFlow`,
            },
          });
        }
      }

      await prisma.gymNomination.updateMany({
        where: { gymName: { equals: result.gym.name, mode: "insensitive" } },
        data: { status: "claimed" },
      });

      // Drop the matching GymGroup(s) so the "Not Active" card disappears
      await prisma.gymGroup.deleteMany({
        where: { name: { equals: result.gym.name, mode: "insensitive" } },
      });
    }
  } catch (err) {
    // Never block gym creation on nomination cleanup
    console.error("[registerGymOwner] auto-claim failed:", err);
  }

  return {
    gym: { id: result.gym.id, name: result.gym.name, slug: result.gym.slug },
    member: { id: result.member.id },
  };
}

// ── Register member (joins existing gym) ─────────────

export async function registerMember(data: {
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  gymSlug: string;
}): Promise<{ member: { id: string; gymId: string }; studentId: string }> {
  const gym = await prisma.gym.findUnique({ where: { slug: data.gymSlug } });
  if (!gym) throw new Error("Gym not found");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const emailLower = data.email.trim().toLowerCase();

  // Check if the person has a Member record at ANOTHER gym (one gym, one student rule)
  const otherGymMember = await prisma.member.findFirst({
    where: { email: emailLower, gymId: { not: gym.id } },
    include: { gym: { select: { name: true } } },
  });
  if (otherGymMember) {
    throw new Error(
      `You're already a member of ${otherGymMember.gym.name}. Contact them to transfer.`
    );
  }

  // Find or create the underlying Student identity
  let student = await prisma.student.findUnique({ where: { email: emailLower } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        email: emailLower,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        passwordHash,
      },
    });
  } else {
    // Update password + profile so this signup replaces any stale credentials
    student = await prisma.student.update({
      where: { id: student.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        passwordHash,
      },
    });
  }

  // Upsert Member for this gym (self-heal if a stale inactive record blocks re-signup)
  const existing = await prisma.member.findFirst({
    where: { email: emailLower, gymId: gym.id },
  });

  let member;
  if (existing) {
    if (existing.active && existing.approved) {
      throw new Error(
        "You already have an active account at this gym. Sign in instead."
      );
    }
    member = await prisma.member.update({
      where: { id: existing.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        passwordHash,
        approved: true,
        active: true,
        studentId: student.id,
      },
    });
  } else {
    member = await prisma.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: `member-${Date.now()}`,
        email: emailLower,
        phone: data.phone || null,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        approved: true,
        active: true,
        beltRank: "white",
        stripes: 0,
        studentId: student.id,
      },
    });
  }

  return { member: { id: member.id, gymId: gym.id }, studentId: student.id };
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
  const emailLower = email.trim().toLowerCase();
  const student = await prisma.student.findUnique({ where: { email: emailLower } });
  if (!student) return null;

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return null;

  // If the student has a linked, active gym membership, carry that context
  // in the session so gym features work. They still stay in the /student portal.
  const member = await prisma.member.findFirst({
    where: { studentId: student.id, approved: true, active: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    userId: `student-${student.id}`,
    email: student.email,
    name: `${student.firstName} ${student.lastName}`,
    role: "member",
    gymId: member?.gymId || "",
    memberId: member?.id || "",
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
