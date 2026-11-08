/**
 * Phase 0, item 5 (owner-features finding 4, security M6): the owner could
 * delete or deactivate their own row, and "admin" meant "the oldest Member of
 * the gym", so the next-oldest member inherited the academy. The owner is now
 * the row carrying the registration marker (clerkUserId "owner-...").
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import {
  db, dbConfigured, jar, req, params, sessionClaims, cleanupFixtures, makeGym, makeOwner,
  makeStudentMember, email, fixtureHash, emailMock, PASSWORD,
} from "@/test/integration";
import { createSession } from "@/lib/local-auth";
import { PUT as updateMember, DELETE as deleteMember } from "@/app/api/admin/members/[id]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as accountDelete } from "@/app/api/auth/account-delete/route";
import { POST as impersonateGym } from "@/app/api/platform/impersonate/[gymId]/route";
import { PATCH as approveGyms } from "@/app/api/admin/approve-gyms/route";
import { GET as trialExpiring } from "@/app/api/cron/trial-expiring/route";
import MemberActions from "@/app/app/members/MemberActions";
import AdminMembersPage from "@/app/app/members/page";

type M = { id: string; gymId: string; clerkUserId: string; email: string; firstName: string; lastName: string };
async function signIn(m: M, role: "admin" | "member") {
  await createSession({
    userId: m.clerkUserId, email: m.email, name: `${m.firstName} ${m.lastName}`,
    role, gymId: m.gymId, memberId: m.id, userType: "member",
  });
}

function findAll(node: ReactNode, type: unknown, out: ReactElement<Record<string, unknown>>[] = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => findAll(n, type, out));
    return out;
  }
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === type) out.push(el as ReactElement<Record<string, unknown>>);
  findAll(el.props?.children, type, out);
  return out;
}

describe.skipIf(!dbConfigured)("Owner protection and owner identity", () => {
  let gymId: string;
  let owner: M;
  let elder: M; // a self-joined member whose row is OLDER than the owner's
  let other: M;
  let staff: M;

  beforeAll(async () => {
    const gym = await makeGym({ approved: false, trialEndsAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) });
    gymId = gym.id;
    elder = await db().member.create({
      data: {
        gymId, clerkUserId: `member-${Date.now()}`, email: email("elder"), firstName: "Eld", lastName: "Er",
        passwordHash: await fixtureHash(), createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    });
    owner = await makeOwner(gymId);
    other = (await makeStudentMember(gymId)).member;
    const staffGym = await makeGym();
    await makeOwner(staffGym.id);
    staff = await db().member.create({
      data: {
        gymId: staffGym.id, clerkUserId: `staff-${Date.now()}`, email: email("staff"), firstName: "Fran",
        lastName: "Staff", passwordHash: await fixtureHash(), isPlatformAdmin: true,
      },
    });
  });
  afterAll(cleanupFixtures);
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
  });

  it("the owner cannot delete their own row", async () => {
    await signIn(owner, "admin");
    const res = await deleteMember(req(`/api/admin/members/${owner.id}`, { method: "DELETE" }), params({ id: owner.id }));
    expect(res.status).toBe(400);
    expect(await db().member.findUnique({ where: { id: owner.id } })).not.toBeNull();
  });

  it("the owner cannot deactivate their own row", async () => {
    await signIn(owner, "admin");
    const res = await updateMember(req(`/api/admin/members/${owner.id}`, { method: "PUT", body: { active: false } }), params({ id: owner.id }));
    expect(res.status).toBe(400);
    expect((await db().member.findUnique({ where: { id: owner.id } }))?.active).toBe(true);
  });

  it("the owner can still deactivate someone else (positive control)", async () => {
    await signIn(owner, "admin");
    const res = await updateMember(req(`/api/admin/members/${other.id}`, { method: "PUT", body: { active: false } }), params({ id: other.id }));
    expect(res.status).toBe(200);
    await db().member.update({ where: { id: other.id }, data: { active: true } });
  });

  it("login makes the marked owner admin and the older self-joined member a plain member", async () => {
    await login(req("/api/auth/login", { body: { email: owner.email, password: PASSWORD } }));
    expect(sessionClaims()).toMatchObject({ memberId: owner.id, role: "admin" });
    jar.clear();
    await login(req("/api/auth/login", { body: { email: elder.email, password: PASSWORD } }));
    expect(sessionClaims()).toMatchObject({ memberId: elder.id, role: "member" });
  });

  it("account-delete refuses the marked owner even when their row is not the oldest", async () => {
    await signIn(owner, "admin");
    const res = await accountDelete(req("/api/auth/account-delete", { body: { confirmation: "DELETE" } }));
    expect(res.status).toBe(400);
    expect(await db().member.findUnique({ where: { id: owner.id } })).not.toBeNull();
  });

  it("platform impersonation of a gym signs in as the marked owner", async () => {
    await signIn(staff, "member");
    const res = await impersonateGym(req(`/api/platform/impersonate/${gymId}`, { method: "POST" }), params({ gymId }));
    expect(res.status).toBe(200);
    expect(sessionClaims()?.memberId).toBe(owner.id);
  });

  it("gym approval emails the marked owner", async () => {
    await signIn(staff, "member");
    const res = await approveGyms(req("/api/admin/approve-gyms", { method: "PATCH", body: { gymId, action: "approve" } }));
    expect(res.status).toBe(200);
    expect(emailMock.sendGymApprovedEmail).toHaveBeenCalledWith(owner.email, expect.any(String), expect.any(String));
    expect(emailMock.sendGymApprovedEmail).not.toHaveBeenCalledWith(elder.email, expect.anything(), expect.anything());
  });

  it("the trial-expiring cron emails the marked owner", async () => {
    process.env.CRON_SECRET = "p0-cron-secret";
    const res = await trialExpiring(req("/api/cron/trial-expiring", { headers: { authorization: "Bearer p0-cron-secret" } }));
    expect(res.status).toBe(200);
    const recipients = emailMock.sendTrialExpiring.mock.calls.map((c) => c[0]);
    expect(recipients).toContain(owner.email);
    expect(recipients).not.toContain(elder.email);
    delete process.env.CRON_SECRET;
  });

  it("the roster hides Deactivate and Remove on the owner's row only", async () => {
    const ownerRow = renderToStaticMarkup(createElement(MemberActions, { memberId: owner.id, approved: true, active: true, isOwner: true } as never));
    expect(ownerRow).not.toContain("Deactivate");
    expect(ownerRow).not.toContain("Remove");
    const otherRow = renderToStaticMarkup(createElement(MemberActions, { memberId: other.id, approved: true, active: true } as never));
    expect(otherRow).toContain("Deactivate");

    await signIn(owner, "admin");
    const tree = await AdminMembersPage();
    const actions = findAll(tree, MemberActions);
    const byId = new Map(actions.map((a) => [a.props.memberId as string, a.props]));
    expect(byId.get(owner.id)?.isOwner).toBe(true);
    expect(byId.get(elder.id)?.isOwner).toBeFalsy();
    expect(byId.get(other.id)?.isOwner).toBeFalsy();
  });
});
