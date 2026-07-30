import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E_DATABASE_URL, FIXTURE } from "./env";

/**
 * Deterministic, idempotent E2E fixtures.
 *
 * Safety model:
 * - The database URL has already passed the localhost + approved-name gate.
 * - Every record carries an unmistakable fixture identity (e2e- slug prefix,
 *   @e2e.matflow.test emails).
 * - Child rows (schedules, attendance, products, ...) are wiped ONLY for the
 *   four fixture gyms, then recreated — repeated runs converge to the same
 *   state. Nothing outside the fixture gym ids / fixture emails is touched.
 * - No external service is ever called: this is pure local DB seeding.
 */

const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });

type GymPlan = "trial" | "basic" | "pro" | "locked";

function gymSeed(plan: GymPlan) {
  const g = FIXTURE.gyms[plan];
  const base = {
    name: g.name,
    slug: g.slug,
    clerkOrgId: `e2e-org-${plan}`,
    approved: true,
    hidden: false,
    timezone: "America/Chicago",
    city: "Houston",
    state: "TX",
    description: `${g.name} — deterministic E2E fixture academy.`,
    lat: FIXTURE.coords.lat,
    lng: FIXTURE.coords.lng,
    geofenceRadiusM: 200,
  };
  switch (plan) {
    case "trial":
      return { ...base, subscriptionStatus: "trialing", stripePriceId: null, trialEndsAt: daysFromNow(20) };
    case "basic":
      return { ...base, subscriptionStatus: "active", stripePriceId: "price_e2e_basic" };
    case "pro":
      return { ...base, subscriptionStatus: "active", stripePriceId: "price_e2e_pro" };
    case "locked":
      return { ...base, subscriptionStatus: "past_due", stripePriceId: "price_e2e_basic" };
  }
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Gym-local wall clock pieces for America/Chicago. */
function chicagoNow(): { dayOfWeek: number; minutes: number; midnightUtc: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dowMap[get("weekday")];
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  const midnightUtc = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
  return { dayOfWeek, minutes, midnightUtc };
}

function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

async function upsertGym(plan: GymPlan) {
  const data = gymSeed(plan);
  return prisma.gym.upsert({ where: { slug: data.slug }, update: data, create: data });
}

async function upsertMember(opts: {
  gymId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  studentId?: string | null;
  createdAt?: Date;
  beltRank?: string;
}) {
  const { gymId, email, ...rest } = opts;
  return prisma.member.upsert({
    where: { gymId_email: { gymId, email } },
    update: { ...rest, approved: true, active: true, status: "active" },
    create: {
      gymId,
      email,
      clerkUserId: `e2e-${email}`,
      approved: true,
      active: true,
      status: "active",
      ...rest,
    },
  });
}

export async function seed() {
  const passwordHash = await bcrypt.hash(FIXTURE.password, 10);

  // ---- Gyms (one per plan state) -------------------------------------------
  const trial = await upsertGym("trial");
  const basic = await upsertGym("basic");
  const pro = await upsertGym("pro");
  const locked = await upsertGym("locked");
  const gymIds = [trial.id, basic.id, pro.id, locked.id];

  // ---- Owners (must be the FIRST member of each gym => role admin) ---------
  // A fixed old createdAt keeps them first even after re-seeding adds members.
  const OLD = new Date("2026-01-01T00:00:00.000Z");
  const ownerTrial = await upsertMember({ gymId: trial.id, email: FIXTURE.emails.ownerTrial, firstName: "Tina", lastName: "Trial", passwordHash, createdAt: OLD, beltRank: "black" });
  const ownerBasic = await upsertMember({ gymId: basic.id, email: FIXTURE.emails.ownerBasic, firstName: "Boris", lastName: "Basic", passwordHash, createdAt: OLD, beltRank: "black" });
  const ownerPro = await upsertMember({ gymId: pro.id, email: FIXTURE.emails.ownerPro, firstName: "Paula", lastName: "Pro", passwordHash, createdAt: OLD, beltRank: "black" });
  await upsertMember({ gymId: locked.id, email: FIXTURE.emails.ownerLocked, firstName: "Lena", lastName: "Locked", passwordHash, createdAt: OLD, beltRank: "black" });

  // ---- Students -------------------------------------------------------------
  const studentMember = await prisma.student.upsert({
    where: { email: FIXTURE.emails.studentMember },
    update: { passwordHash },
    create: { email: FIXTURE.emails.studentMember, firstName: "Sam", lastName: "Member", passwordHash, beltRank: "blue", weeklyGoal: 3 },
  });
  const studentSolo = await prisma.student.upsert({
    where: { email: FIXTURE.emails.studentSolo },
    update: { passwordHash, homeGym: null },
    create: { email: FIXTURE.emails.studentSolo, firstName: "Iris", lastName: "Indie", passwordHash, beltRank: "white" },
  });

  // Approved membership linking Sam -> Basic gym (student self-check-in target)
  const samMembership = await upsertMember({
    gymId: basic.id,
    email: FIXTURE.emails.studentMember,
    firstName: "Sam",
    lastName: "Member",
    passwordHash: null, // logs in as Student, not Member
    studentId: studentMember.id,
    beltRank: "blue",
  });

  // Plain member (no student link) at the Basic gym
  const plainMember = await upsertMember({
    gymId: basic.id,
    email: FIXTURE.emails.member,
    firstName: "Mia",
    lastName: "Mat",
    passwordHash,
    beltRank: "purple",
  });
  // Extra roster members at Pro for cross-tenant + analytics volume
  const proMember = await upsertMember({
    gymId: pro.id,
    email: "member.pro@e2e.matflow.test",
    firstName: "Pete",
    lastName: "ProMat",
    passwordHash,
    beltRank: "brown",
  });

  // ---- Wipe fixture-scoped child rows so re-runs converge ------------------
  // Notifications are keyed by externalId (session userId); fixture ids are
  // unmistakable ("e2e-…@e2e.matflow.test" / "student-<fixture id>").
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { gymId: { in: gymIds } },
        { externalId: { contains: "e2e.matflow.test" } },
        { externalId: { in: [`student-${studentMember.id}`, `student-${studentSolo.id}`] } },
      ],
    },
  });
  await prisma.attendance.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.classSchedule.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.announcement.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.waiverSignature.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.waiverTemplate.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.dropIn.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { gymId: { in: gymIds } } } });
  await prisma.order.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.productVariant.deleteMany({ where: { product: { gymId: { in: gymIds } } } });
  await prisma.productImage.deleteMany({ where: { product: { gymId: { in: gymIds } } } });
  await prisma.product.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.category.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.instructor.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.joinRequest.deleteMany({ where: { gymId: { in: gymIds } } });
  await prisma.trainingSession.deleteMany({ where: { studentId: { in: [studentMember.id, studentSolo.id] } } });

  // ---- Schedules ------------------------------------------------------------
  const { dayOfWeek, minutes, midnightUtc } = chicagoNow();
  // A class open for check-in RIGHT NOW at the Basic gym (proximity flow).
  const openClass = await prisma.classSchedule.create({
    data: {
      gymId: basic.id,
      dayOfWeek,
      startTime: hhmm(minutes - 20),
      endTime: hhmm(minutes + 70),
      classType: "gi",
      instructor: "Prof. Fixture",
      locationSlug: "main",
    },
  });
  // A second concurrent class so the picker shows a real choice.
  await prisma.classSchedule.create({
    data: {
      gymId: basic.id,
      dayOfWeek,
      startTime: hhmm(minutes - 10),
      endTime: hhmm(minutes + 80),
      classType: "nogi",
      instructor: "Coach Fixture",
      locationSlug: "main",
    },
  });
  // A stable weekly grid (every day 18:00-19:00) for calendar rendering.
  for (const gym of [basic.id, pro.id, trial.id]) {
    for (let d = 0; d < 7; d++) {
      await prisma.classSchedule.create({
        data: { gymId: gym, dayOfWeek: d, startTime: "18:00", endTime: "19:00", classType: "fundamentals", instructor: "Prof. Fixture", locationSlug: "main" },
      });
    }
  }
  // A live class at the PRO gym for cross-tenant check-in rejection tests.
  const proOpenClass = await prisma.classSchedule.create({
    data: { gymId: pro.id, dayOfWeek, startTime: hhmm(minutes - 20), endTime: hhmm(minutes + 70), classType: "gi", instructor: "Prof. Fixture", locationSlug: "main" },
  });

  // ---- Attendance history (drives analytics deterministically) -------------
  const DAY = 24 * 60 * 60 * 1000;
  for (let i = 1; i <= 8; i++) {
    await prisma.attendance.create({
      data: {
        gymId: basic.id,
        memberId: plainMember.id,
        classDate: new Date(midnightUtc.getTime() - i * DAY),
        classType: "fundamentals",
        locationSlug: "main",
      },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.attendance.create({
      data: {
        gymId: basic.id,
        memberId: samMembership.id,
        classDate: new Date(midnightUtc.getTime() - i * DAY),
        classType: "fundamentals",
        locationSlug: "main",
      },
    });
    await prisma.attendance.create({
      data: {
        gymId: pro.id,
        memberId: proMember.id,
        classDate: new Date(midnightUtc.getTime() - i * DAY),
        classType: "fundamentals",
        locationSlug: "main",
      },
    });
  }

  // ---- Operational content --------------------------------------------------
  await prisma.instructor.create({ data: { gymId: basic.id, name: "Prof. Fixture", beltRank: "black", active: true } });
  await prisma.announcement.create({ data: { gymId: basic.id, title: "E2E Fixture Announcement", content: "Deterministic announcement body for E2E.", pinned: true } });
  await prisma.waiverTemplate.create({ data: { gymId: basic.id, title: "E2E Liability Waiver", content: "Deterministic waiver body.", active: true } });
  await prisma.waiverTemplate.create({ data: { gymId: pro.id, title: "E2E Liability Waiver (Pro)", content: "Deterministic waiver body.", active: true } });
  await prisma.dropIn.create({ data: { gymId: basic.id, firstName: "Devon", lastName: "DropIn", email: "dropin@e2e.matflow.test", classType: "gi" } });

  const cat = await prisma.category.create({ data: { gymId: basic.id, name: "E2E Apparel", slug: "e2e-apparel" } });
  const product = await prisma.product.create({
    data: { gymId: basic.id, name: "E2E Academy Gi", slug: "e2e-academy-gi", description: "Deterministic fixture gi.", price: 120, categoryId: cat.id, active: true },
  });
  const variant = await prisma.productVariant.create({
    data: { productId: product.id, size: "A2", sku: "E2E-GI-A2", stock: 10 },
  });
  const order = await prisma.order.create({
    data: { gymId: basic.id, status: "pending", customerName: "Carla Customer", customerEmail: "customer@e2e.matflow.test", subtotal: 120, total: 120 },
  });
  await prisma.orderItem.create({ data: { orderId: order.id, productId: product.id, variantId: variant.id, quantity: 1, unitPrice: 120 } });

  // ---- Student-side content -------------------------------------------------
  await prisma.joinRequest.upsert({
    where: { studentId_gymId: { studentId: studentSolo.id, gymId: pro.id } },
    update: { status: "pending" },
    create: { studentId: studentSolo.id, gymId: pro.id, status: "pending", message: "E2E join request" },
  });
  for (let i = 1; i <= 3; i++) {
    await prisma.trainingSession.create({
      data: { studentId: studentMember.id, date: new Date(midnightUtc.getTime() - i * DAY), sessionType: "gi", duration: 60, rollsWon: 2, rollsLost: 1 },
    });
  }

  return {
    gyms: { trial: trial.id, basic: basic.id, pro: pro.id, locked: locked.id },
    owners: { trial: ownerTrial.id, basic: ownerBasic.id, pro: ownerPro.id },
    members: { plain: plainMember.id, sam: samMembership.id, pro: proMember.id },
    students: { member: studentMember.id, solo: studentSolo.id },
    openClassId: openClass.id,
    proOpenClassId: proOpenClass.id,
  };
}

export async function disconnect() {
  await prisma.$disconnect();
}
