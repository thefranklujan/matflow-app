#!/usr/bin/env node
/**
 * One-off backfill for the Phase 0 security hotfix (audit C1, 2026-11-08):
 * grant Member.isPlatformAdmin to the Member rows of the addresses currently
 * listed in PLATFORM_ADMIN_EMAILS. After this runs, platform access comes ONLY
 * from the flag; the env list no longer grants anything.
 *
 * PRODUCTION: run only on Frank's go, recorded in the Lane B rollout record
 * (work/reviews/2026-11-08-release-matflow-phase0-hotfix.md in the spine).
 * Order: SQL migration (prisma/PENDING_MIGRATION_2026-11-08_PLATFORM_ADMIN.sql)
 * -> this script (dry run, review, --apply) -> deploy.
 *
 * Usage (DATABASE_URL and PLATFORM_ADMIN_EMAILS supplied by blind relay, never
 * typed into a transcript):
 *   node scripts/backfill-platform-admins.mjs                        # dry run: report only
 *   node scripts/backfill-platform-admins.mjs --apply --ids=<id,id>  # flag exactly these rows
 *   node scripts/backfill-platform-admins.mjs --apply --owner-ids=<id,id>  # mark legacy owners
 * (--ids and --owner-ids may be combined in one --apply run.)
 *
 * --apply never flags by email. It writes only the Member ids passed in --ids,
 * and only when each one is a candidate in this run's report (a listed address,
 * not self-joined). Frank and Codex choose the ids from the dry run: under C1 an
 * attacker could also have registered a GYM with an unused admin address,
 * producing an "owner-" row, so a gym the dry run lists that Frank did not create
 * must not be flagged (and should be reported).
 *
 * What it reports, per listed address (this doubles as the C1 forensic check):
 *   - every Member row with that email (gym, clerkUserId prefix, createdAt);
 *   - which rows it would flag: rows NOT created by a self-join path
 *     ("member-", "student-", "dropin-"), because a self-joined row with an
 *     admin address may have been created by an attacker through C3;
 *   - any Student row with the same email. Under C1 anyone could register one;
 *     a Student row also makes login land in /student instead of /platform.
 * It also lists every gym with NO owner (no "owner-"/"demo-owner-" marker and
 * no Member.isOwner). Ownership is never derived from row age, so such a gym
 * has no admin after the deploy until --owner-ids names its owner from this
 * report (Codex round 1, finding 1). Candidates exclude self-join rows.
 *
 * Writes nothing without --apply. Never prints password hashes.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const IDS = idsArg ? idsArg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean) : [];
const ownerArg = process.argv.find((a) => a.startsWith("--owner-ids="));
const OWNER_IDS = ownerArg ? ownerArg.slice("--owner-ids=".length).split(",").map((s) => s.trim()).filter(Boolean) : [];
const SELF_JOIN = ["member-", "student-", "dropin-"];

/** Customer emails are masked: this report is read in agent transcripts. */
function mask(email) {
  const [local, domain] = String(email).split("@");
  return `${(local || "").slice(0, 2)}***@${domain || "?"}`;
}

function fail(msg) {
  console.error(`backfill-platform-admins: ${msg}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set");
const raw = process.env.PLATFORM_ADMIN_EMAILS;
if (!raw || !raw.trim()) fail("PLATFORM_ADMIN_EMAILS is not set (no fallback list on purpose)");
if (APPLY && IDS.length === 0 && OWNER_IDS.length === 0) {
  fail("--apply needs --ids=<memberId,...> and/or --owner-ids=<memberId,...> chosen from a dry run; it never flags by email or age");
}

let target;
try {
  const u = new URL(url);
  target = `${u.hostname}:${u.port || "5432"}${u.pathname}`;
} catch {
  fail("DATABASE_URL is not a parseable URL");
}

const emails = [...new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))];
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  console.log(`Target: ${target}   Mode: ${APPLY ? "APPLY" : "dry run"}   Addresses: ${emails.length}`);
  const toFlag = [];

  for (const email of emails) {
    const members = await prisma.member.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, gymId: true, clerkUserId: true, createdAt: true, isPlatformAdmin: true, gym: { select: { name: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    const student = await prisma.student.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, createdAt: true },
    });

    console.log(`\n${email}`);
    if (members.length === 0) console.log("  WARNING: no Member row. This address will have NO platform access after the deploy.");
    for (const m of members) {
      const prefix = (m.clerkUserId.match(/^[a-z-]+?-/) || [m.clerkUserId.slice(0, 8)])[0];
      const selfJoined = SELF_JOIN.some((p) => m.clerkUserId.startsWith(p));
      const action = m.isPlatformAdmin ? "already flagged" : selfJoined ? "SKIP (self-join row: review by hand)" : "flag";
      console.log(`  member ${m.id}  gym "${m.gym.name}" (${m.gymId}, gym created ${m.gym.createdAt.toISOString()})  ${prefix}…  row created ${m.createdAt.toISOString()}  -> ${action}`);
      if (!m.isPlatformAdmin && !selfJoined) toFlag.push(m.id);
    }
    if (student) {
      console.log(`  WARNING: Student row ${student.id} created ${student.createdAt.toISOString()} uses this address.`);
      console.log("           Login checks Students first, so this address lands in /student, not /platform.");
      console.log("           If Frank did not create it, treat it as evidence that C1 was exploited.");
    }
  }

  const gyms = await prisma.gym.findMany({ select: { id: true, name: true, createdAt: true } });
  const ownerCandidates = [];
  const ownerless = [];
  for (const g of gyms) {
    const owned = await prisma.member.count({
      where: {
        gymId: g.id,
        OR: [{ isOwner: true }, { clerkUserId: { startsWith: "owner-" } }, { clerkUserId: { startsWith: "demo-owner-" } }],
      },
    });
    if (owned > 0) continue;
    ownerless.push(g);
    const rows = await prisma.member.findMany({
      where: { gymId: g.id, NOT: SELF_JOIN.map((p) => ({ clerkUserId: { startsWith: p } })) },
      select: { id: true, email: true, clerkUserId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    console.log(`\nGym WITHOUT an owner: "${g.name}" (${g.id}, created ${g.createdAt.toISOString()})`);
    if (rows.length === 0) console.log("  no non-self-join rows: nobody can be named owner from this data");
    for (const r of rows) {
      console.log(`  candidate ${r.id}  ${mask(r.email)}  ${r.clerkUserId.slice(0, 8)}…  row created ${r.createdAt.toISOString()}`);
      ownerCandidates.push(r.id);
    }
  }
  console.log(`\nGyms without an owner: ${ownerless.length} of ${gyms.length}. They have no admin after the deploy until --owner-ids names one.`);

  if (!APPLY) {
    console.log(`\nDry run: ${toFlag.length} platform-admin candidate row(s): ${toFlag.join(",") || "none"}`);
    console.log("Confirm each gym above is Frank's, then: --apply --ids=<the confirmed ids>");
    console.log("For each ownerless gym, confirm its owner, then: --apply --owner-ids=<one id per gym>");
    return;
  }
  const notCandidates = IDS.filter((id) => !toFlag.includes(id));
  if (notCandidates.length) fail(`refusing: not platform-admin candidates in this run: ${notCandidates.join(",")}`);
  const notOwnerCandidates = OWNER_IDS.filter((id) => !ownerCandidates.includes(id));
  if (notOwnerCandidates.length) fail(`refusing: not owner candidates in this run: ${notOwnerCandidates.join(",")}`);
  if (IDS.length) {
    const res = await prisma.member.updateMany({ where: { id: { in: IDS } }, data: { isPlatformAdmin: true } });
    console.log(`\nFlagged ${res.count} Member row(s) as platform admin.`);
  }
  if (OWNER_IDS.length) {
    const res = await prisma.member.updateMany({ where: { id: { in: OWNER_IDS } }, data: { isOwner: true } });
    console.log(`Marked ${res.count} Member row(s) as academy owner.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
