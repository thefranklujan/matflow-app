/**
 * Regression test for Codex adversarial review round 3 (2026-11-08), finding 1:
 * an owner's deactivation committed BETWEEN leave-gym's eligibility read and
 * its delete must still win. Deterministic: the route's own Prisma client is
 * wrapped so that, right after leave-gym reads the membership (seeing it
 * active), the owner's real PUT commits the deactivation on the real local
 * Postgres. Only then does leave-gym reach its write.
 */
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

const hooks = vi.hoisted(() => ({ afterMemberRead: null as null | (() => Promise<void>) }));

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
vi.mock("@/lib/prisma", async () => {
  const { testPrisma } = await import("@/test/integration");
  if (!testPrisma) return { prisma: null };
  const member = new Proxy(testPrisma.member, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "findUnique") {
        return async (args: Parameters<typeof target.findUnique>[0]) => {
          const row = await target.findUnique(args);
          const hook = hooks.afterMemberRead;
          if (hook) {
            hooks.afterMemberRead = null; // fire once, for leave-gym's read
            await hook();
          }
          return row;
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const prisma = new Proxy(testPrisma, {
    get(target, prop, receiver) {
      if (prop === "member") return member;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { prisma };
});

import {
  db, dbConfigured, jar, req, params, cleanupFixtures, makeGym, makeOwner, makeStudentMember,
} from "@/test/integration";
import { createSession } from "@/lib/local-auth";
import { POST as leaveGym } from "@/app/api/student/leave-gym/route";
import { POST as joinSession } from "@/app/api/auth/join-session/route";
import { PUT as updateMember } from "@/app/api/admin/members/[id]/route";

describe.skipIf(!dbConfigured)("Codex round 3, finding 1: leave-gym enforces eligibility at the write", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => {
    jar.clear();
    hooks.afterMemberRead = null;
  });

  it("an owner deactivation committed between leave's read and delete still wins, and rejoin stays blocked", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    const { student, member } = await makeStudentMember(gym.id);
    const studentSession = {
      userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member" as const,
      gymId: gym.id, memberId: member.id, userType: "student" as const, studentId: student.id,
    };

    // While leave-gym is between its read and its write, the owner deactivates
    // the member through the real admin route (its own session and cookie).
    hooks.afterMemberRead = async () => {
      const studentCookie = jar.get("matflow-session")!;
      jar.clear();
      await createSession({
        userId: owner.clerkUserId, email: owner.email, name: "Olive Owner", role: "admin",
        gymId: gym.id, memberId: owner.id, userType: "member",
      });
      const put = await updateMember(req(`/api/admin/members/${member.id}`, { method: "PUT", body: { active: false } }), params({ id: member.id }));
      expect(put.status).toBe(200);
      jar.clear();
      jar.set("matflow-session", studentCookie);
    };

    await createSession(studentSession);
    const leave = await leaveGym();
    expect(hooks.afterMemberRead).toBeNull(); // the interleaving really happened
    expect(leave.status).toBe(400);
    const row = await db().member.findUnique({ where: { id: member.id } });
    expect(row).not.toBeNull();
    expect(row!.active).toBe(false);

    // The same student, signed in again, cannot rejoin around the deactivation.
    jar.clear();
    await createSession({ ...studentSession, gymId: "", memberId: "" });
    const rejoin = await joinSession(req("/api/auth/join-session", { body: { gymSlug: gym.slug } }));
    expect(rejoin.status).toBeGreaterThanOrEqual(400);
    const rows = await db().member.findMany({ where: { gymId: gym.id, studentId: student.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(false);
  });
});
