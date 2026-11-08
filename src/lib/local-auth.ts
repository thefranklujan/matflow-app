/**
 * Auth system using JWT + bcrypt with Prisma/Postgres.
 * Supports gym owner registration, member sign-up, and login.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { lockMemberCapacity, assertSeatAvailable } from "@/lib/member-capacity";
import { isGymOwner } from "@/lib/gym-owner";

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
  /**
   * Set only while a platform admin impersonates a gym, a student or the demo
   * gym: the platform admin's Member id. Exit restores that member by id.
   */
  impersonatorId?: string;
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

/** Duplicate email or academy URL — carries the field for a stable 409. */
export class DuplicateRegistrationError extends Error {
  constructor(public readonly field: "email" | "gymSlug", message: string) {
    super(message);
    this.name = "DuplicateRegistrationError";
  }
}

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
  const emailLower = data.email.trim().toLowerCase();

  // Check if email already exists (case-insensitive)
  const existing = await prisma.member.findFirst({
    where: { email: { equals: emailLower, mode: "insensitive" } },
  });
  if (existing) throw new DuplicateRegistrationError("email", "An account with this email already exists");

  // Check if slug is taken
  const slugTaken = await prisma.gym.findUnique({ where: { slug: data.gymSlug } });
  if (slugTaken) throw new DuplicateRegistrationError("gymSlug", "This gym URL is already taken");

  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create gym + admin member in a transaction
  let result: { gym: { id: string; name: string; slug: string }; member: { id: string } };
  try {
    result = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          // Legacy compatibility column. randomUUID is collision-safe; Date.now()
          // collided when two academies registered in the same millisecond.
          clerkOrgId: `owner-${randomUUID()}`,
          name: data.gymName,
          slug: data.gymSlug,
          timezone: data.timezone || "America/Chicago",
          subscriptionStatus: "trialing",
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          // Auto-approve self-serve owner signups. The 30-day trial already gates
          // monetization, so a manual approval wall only froze cold prospects out
          // of their own gym and hid new gyms from the student directory.
          approved: true,
        },
      });

      const member = await tx.member.create({
        data: {
          gymId: gym.id,
          clerkUserId: `owner-${randomUUID()}`,
          email: emailLower,
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

      // The audit record is part of the SAME transaction: an academy that
      // exists always has its gym_created row, and a failure of any of the
      // three writes rolls back all of them. (logActivity() is deliberately
      // fire-and-forget and returns void, so it cannot be awaited here.)
      await tx.activityLog.create({
        data: {
          gymId: gym.id,
          action: "gym_created",
          actorName: `${data.firstName} ${data.lastName}`,
          targetName: data.gymName,
        },
      });

      return { gym, member };
    });
  } catch (err) {
    // The pre-checks above are advisory: two concurrent submissions can pass
    // both and race to INSERT. The unique constraints are the real guard, so a
    // P2002 becomes the same stable duplicate error instead of a raw DB error,
    // and the transaction leaves no partial academy behind.
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      const target = String((err as { meta?: { target?: unknown } })?.meta?.target ?? "");
      if (target.includes("slug")) {
        throw new DuplicateRegistrationError("gymSlug", "This gym URL is already taken");
      }
      throw new DuplicateRegistrationError("email", "An account with this email already exists");
    }
    throw err;
  }

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

/**
 * The email already belongs to an account. The join link is unauthenticated,
 * so it must never modify an existing identity (audit C3: it used to overwrite
 * the Student's password and reactivate deactivated members). The caller gets
 * one generic answer: sign in, then use the link again (join-session).
 */
export class ExistingAccountError extends Error {
  readonly code = "SIGN_IN_TO_JOIN";
  constructor() {
    super("An account with this email already exists. Sign in, then open this invite link again to join.");
    this.name = "ExistingAccountError";
  }
}

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

  const emailLower = data.email.trim().toLowerCase();
  const insensitive = { equals: emailLower, mode: "insensitive" as const };

  // Any existing Student or Member (any gym) with this email: refuse without
  // touching it. One response for every case, so it reveals nothing about
  // which gym, if any, the address belongs to.
  const [existingStudent, existingMember] = await Promise.all([
    prisma.student.findFirst({ where: { email: insensitive }, select: { id: true } }),
    prisma.member.findFirst({ where: { email: insensitive }, select: { id: true } }),
  ]);
  if (existingStudent || existingMember) throw new ExistingAccountError();

  const passwordHash = await bcrypt.hash(data.password, 10);

  // A brand-new identity: the Student and its Member row are created together
  // under the gym's capacity lock (count re-read inside the lock), so a full
  // gym leaves no orphan Student behind.
  try {
    return await prisma.$transaction(async (tx) => {
      await lockMemberCapacity(tx, gym.id);
      await assertSeatAvailable(tx, gym.id);

      const student = await tx.student.create({
        data: {
          email: emailLower,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          passwordHash,
        },
      });
      const member = await tx.member.create({
        data: {
          gymId: gym.id,
          clerkUserId: `member-${randomUUID()}`,
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
      return { member: { id: member.id, gymId: gym.id }, studentId: student.id };
    });
  } catch (err) {
    // Two concurrent joins with the same new email race to INSERT; the unique
    // constraint is the real guard and gets the same generic answer.
    if ((err as { code?: string })?.code === "P2002") throw new ExistingAccountError();
    throw err;
  }
}

// ── Join a gym as an already-signed-in student ───────
// Used by the member link when the visitor is already logged in, so they don't
// have to retype email/password. Reuses the existing Student identity.
export async function joinGymAsStudent(
  studentId: string,
  gymSlug: string
): Promise<{ member: { id: string; gymId: string }; gymName: string }> {
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) throw new Error("Gym not found");

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Student not found");

  // One gym, one student: block if they already belong to a different gym.
  const otherGymMember = await prisma.member.findFirst({
    where: { studentId, gymId: { not: gym.id } },
    include: { gym: { select: { name: true } } },
  });
  if (otherGymMember) {
    throw new Error(
      `You're already a member of ${otherGymMember.gym.name}. Contact them to transfer.`
    );
  }

  // Activation/creation consumes a seat, so it happens under the gym's
  // capacity lock with the count re-read inside the transaction. An
  // already-active membership returns without touching capacity.
  const member = await prisma.$transaction(async (tx) => {
    await lockMemberCapacity(tx, gym.id);

    const existing = await tx.member.findFirst({
      where: { gymId: gym.id, studentId },
    });
    if (existing && existing.active && existing.approved) {
      return existing;
    }
    // A membership the owner deactivated or un-approved stays that way: only
    // the owner can change it (PUT /api/admin/members/[id]).
    if (existing) {
      throw new Error("Your membership at this academy is inactive. Contact the academy to reactivate it.");
    }

    await assertSeatAvailable(tx, gym.id);

    return tx.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: `member-${Date.now()}`,
        email: student.email,
        phone: student.phone,
        firstName: student.firstName,
        lastName: student.lastName,
        approved: true,
        active: true,
        beltRank: "white",
        stripes: 0,
        studentId: student.id,
      },
    });
  });

  return { member: { id: member.id, gymId: gym.id }, gymName: gym.name };
}

// ── Register Student ─────────────────────────────────

export async function registerStudent(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
  const emailLower = data.email.trim().toLowerCase();
  const insensitive = { equals: emailLower, mode: "insensitive" as const };
  // A Member-only identity (owners, staff, platform admins) also blocks a new
  // Student with the same email: otherwise anyone could register an owner's
  // or a platform admin's address as their own (audit C1).
  const [existing, existingMember] = await Promise.all([
    prisma.student.findFirst({ where: { email: insensitive }, select: { id: true } }),
    prisma.member.findFirst({ where: { email: insensitive }, select: { id: true } }),
  ]);
  if (existing || existingMember) throw new Error("An account with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const student = await prisma.student.create({
    data: {
      email: emailLower,
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

  // Find member by email (could be in any gym). Case-insensitive — older
  // records were stored with whatever case the user typed at signup, and the
  // login form may pass either. authenticateStudent already lowercases.
  // Member.email is unique only per gym, so one address can match several
  // rows. Try every row in a fixed order (platform admin first, then oldest)
  // and sign in to the first whose password matches: a stray row with the
  // same email (for example one created through the old join-link takeover)
  // can neither win the lookup nor lock the real owner out.
  const emailLower = email.trim().toLowerCase();
  const candidates = await prisma.member.findMany({
    where: { email: { equals: emailLower, mode: "insensitive" }, passwordHash: { not: null } },
    orderBy: [{ isPlatformAdmin: "desc" }, { createdAt: "asc" }],
    take: 20,
  });

  let member: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (c.passwordHash && (await bcrypt.compare(password, c.passwordHash))) {
      member = c;
      break;
    }
  }
  if (!member) return null;

  // Role: the gym's owner (registration marker, not row age) is admin.
  const isAdmin = await isGymOwner(member);

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
