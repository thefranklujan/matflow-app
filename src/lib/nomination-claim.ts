import { prisma } from "@/lib/prisma";

/**
 * Nomination → academy claiming.
 *
 * A student-created community (GymGroup) and an academy (Gym) that share a
 * name are NOT proof that one owns the other. This module therefore never
 * deletes, moves, or merges community content. It only:
 *
 * - reports read-only "possible matches" so the founder can review them
 *   (findNominationReviewMatches), and
 * - turns founder-selected nominations into pending join requests in one
 *   transaction (claimNominationsForGym).
 *
 * A durable group-to-academy link needs a schema change (proposed in the
 * readiness handoff, not applied). Until then the community stays exactly as
 * its members left it.
 */

const HIDDEN_GYM_IDS = ["platform-owner-gym", "platform-admin-gym"];

export type LocationAgreement = "match" | "unknown" | "conflict";

export interface ReviewMatch {
  gymId: string;
  gymName: string;
  city: string | null;
  state: string | null;
  location: LocationAgreement;
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** City/state can disambiguate but never verify ownership. */
export function compareLocation(
  a: { city: string | null; state: string | null },
  b: { city: string | null; state: string | null },
): LocationAgreement {
  const pairs: Array<[string, string]> = [
    [norm(a.city), norm(b.city)],
    [norm(a.state), norm(b.state)],
  ];
  const comparable = pairs.filter(([x, y]) => x && y);
  if (comparable.some(([x, y]) => x !== y)) return "conflict";
  return comparable.length === 2 ? "match" : "unknown";
}

/** Read-only: active academies whose name equals each nomination's name. */
export async function findNominationReviewMatches(
  nominations: Array<{ id: string; gymName: string; city: string | null; state: string | null }>,
): Promise<Map<string, ReviewMatch[]>> {
  const out = new Map<string, ReviewMatch[]>();
  const names = Array.from(new Set(nominations.map((n) => n.gymName.trim()).filter(Boolean)));
  if (names.length === 0) return out;

  const gyms = await prisma.gym.findMany({
    where: {
      id: { notIn: HIDDEN_GYM_IDS },
      subscriptionStatus: { not: "canceled" },
      OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
    },
    select: { id: true, name: true, city: true, state: true },
  });

  for (const n of nominations) {
    const hits = gyms
      .filter((g) => norm(g.name) === norm(n.gymName))
      .map((g) => ({
        gymId: g.id,
        gymName: g.name,
        city: g.city,
        state: g.state,
        location: compareLocation(n, g),
      }));
    if (hits.length) out.set(n.id, hits);
  }
  return out;
}

export class ClaimError extends Error {
  constructor(
    public readonly code: "TARGET_NOT_FOUND" | "NO_NOMINATIONS" | "LOCATION_MISMATCH",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export interface ClaimResult {
  joinRequestsCreated: number;
  claimedNominations: number;
  alreadyClaimed: number;
  alreadyMembers: number;
  skippedRejected: number;
  targetGymName: string;
}

/**
 * Claim the EXPLICITLY selected nominations for one academy.
 *
 * - All-or-nothing: one transaction, so a failure leaves nominations open and
 *   creates no join request (never a false success).
 * - Idempotent and race-safe: each nomination flips to "claimed" with a
 *   conditional update, so a retry or a concurrent claim of the same
 *   nomination is a no-op; join requests rely on the (studentId, gymId)
 *   unique constraint and skip duplicates.
 * - Never resurrects a rejected join request and never deletes or moves
 *   community groups, members, posts, comments, likes or reports.
 */
export async function claimNominationsForGym(input: {
  targetGymId: string;
  nominationIds: string[];
  allowLocationMismatch?: boolean;
  /** Test seam for rollback proofs; never set in production code. */
  afterEachForTest?: () => void;
}): Promise<ClaimResult> {
  const gym = await prisma.gym.findUnique({
    where: { id: input.targetGymId },
    select: { id: true, name: true, city: true, state: true },
  });
  if (!gym || HIDDEN_GYM_IDS.includes(gym.id)) {
    throw new ClaimError("TARGET_NOT_FOUND", "Target gym not found", 404);
  }

  const ids = Array.from(new Set(input.nominationIds));
  const nominations = await prisma.gymNomination.findMany({ where: { id: { in: ids } } });
  if (nominations.length === 0) {
    throw new ClaimError("NO_NOMINATIONS", "No nominations found for those ids", 404);
  }

  const conflicts = nominations.filter((n) => compareLocation(n, gym) === "conflict");
  if (conflicts.length && !input.allowLocationMismatch) {
    throw new ClaimError(
      "LOCATION_MISMATCH",
      `${conflicts.length} nomination${conflicts.length === 1 ? "" : "s"} list a different city or state than ${gym.name}. Review before claiming.`,
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const result: ClaimResult = {
      joinRequestsCreated: 0,
      claimedNominations: 0,
      alreadyClaimed: 0,
      alreadyMembers: 0,
      skippedRejected: 0,
      targetGymName: gym.name,
    };

    for (const n of nominations) {
      // Conditional flip: the row lock makes concurrent claims of the same
      // nomination serialize, and only one of them sees count === 1.
      const flipped = await tx.gymNomination.updateMany({
        where: { id: n.id, status: { not: "claimed" } },
        data: { status: "claimed" },
      });
      if (flipped.count === 0) {
        result.alreadyClaimed++;
        continue;
      }
      result.claimedNominations++;

      const member = await tx.member.findFirst({
        where: { gymId: gym.id, studentId: n.studentId },
        select: { id: true },
      });
      if (member) {
        result.alreadyMembers++;
      } else {
        const existing = await tx.joinRequest.findUnique({
          where: { studentId_gymId: { studentId: n.studentId, gymId: gym.id } },
          select: { status: true },
        });
        if (existing?.status === "rejected") {
          result.skippedRejected++;
        } else if (!existing) {
          const created = await tx.joinRequest.createMany({
            data: [{
              studentId: n.studentId,
              gymId: gym.id,
              status: "pending",
              message: `Requested via nomination of ${n.gymName}`,
            }],
            skipDuplicates: true,
          });
          result.joinRequestsCreated += created.count;
        }
      }
      input.afterEachForTest?.();
    }
    return result;
  });
}
