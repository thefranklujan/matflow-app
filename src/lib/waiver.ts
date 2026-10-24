import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Waiver revision + signature contract (single source for every surface).
 *
 * - A template's `version` changes only when its CONTENT changes; a title-only
 *   edit keeps the version and therefore keeps everyone's signed state.
 * - "Signed" always means: a signature by this member for the gym's CURRENT
 *   required template at its CURRENT version. Older signatures are history:
 *   they are never rewritten and never count as current.
 * - Signing and editing both take the same per-template advisory lock, so the
 *   stored snapshot always equals the content of the version recorded with
 *   it, and a duplicate/concurrent submission cannot insert twice.
 * - A submission must name the version the signer was shown. If the template
 *   moved on (or was deactivated) the request is refused with a conflict and
 *   the current waiver, instead of recording a signature for unseen text.
 *
 * Status reports facts about records only; it never states legal coverage.
 */

type Tx = Prisma.TransactionClient;

export type WaiverStatus =
  | "none_required"
  | "unsigned"
  | "previous_version_signed"
  | "current_signed";

export interface CurrentWaiver {
  id: string;
  title: string;
  content: string;
  version: number;
}

export interface WaiverStatusResult {
  status: WaiverStatus;
  template: CurrentWaiver | null;
  /** Kept for older clients: true only for the current version. */
  signed: boolean;
  signedAt: string | null;
  previous: { version: number; signedAt: string } | null;
}

async function lockTemplate(tx: Tx, templateId: string) {
  const key = `waiver-template:${templateId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/** The gym's current required waiver: the newest ACTIVE template. */
export async function currentWaiver(gymId: string, db: Tx | typeof prisma = prisma): Promise<CurrentWaiver | null> {
  const t = await db.waiverTemplate.findFirst({
    where: { gymId, active: true },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: { id: true, title: true, content: true, version: true },
  });
  return t;
}

export async function waiverStatusFor(gymId: string, memberId: string): Promise<WaiverStatusResult> {
  const template = await currentWaiver(gymId);
  if (!template) {
    return { status: "none_required", template: null, signed: false, signedAt: null, previous: null };
  }

  const [current, previous] = await Promise.all([
    prisma.waiverSignature.findFirst({
      where: { gymId, memberId, templateId: template.id, version: template.version },
      orderBy: { signedAt: "asc" },
      select: { signedAt: true },
    }),
    prisma.waiverSignature.findFirst({
      where: {
        gymId,
        memberId,
        NOT: { templateId: template.id, version: template.version },
      },
      orderBy: { signedAt: "desc" },
      select: { version: true, signedAt: true },
    }),
  ]);

  if (current) {
    return {
      status: "current_signed",
      template,
      signed: true,
      signedAt: current.signedAt.toISOString(),
      previous: null,
    };
  }
  return {
    status: previous ? "previous_version_signed" : "unsigned",
    template,
    signed: false,
    signedAt: null,
    previous: previous ? { version: previous.version, signedAt: previous.signedAt.toISOString() } : null,
  };
}

export class WaiverError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "WAIVER_UPDATED"
      | "WAIVER_INACTIVE"
      | "MEMBERSHIP_INACTIVE",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WaiverError";
  }
}

export interface SignResult {
  signedAt: string;
  version: number;
  /** True when this member had already signed this exact version. */
  alreadySigned: boolean;
}

export async function signCurrentWaiver(input: {
  gymId: string;
  memberId: string;
  templateId: unknown;
  version: unknown;
  signedName: unknown;
}): Promise<SignResult> {
  const signedName = typeof input.signedName === "string" ? input.signedName.trim() : "";
  const templateId = typeof input.templateId === "string" ? input.templateId : "";
  if (!templateId || !signedName || signedName.length > 200) {
    throw new WaiverError("INVALID_INPUT", "Template ID and signed name required", 400);
  }
  const shownVersion = typeof input.version === "number" && Number.isInteger(input.version) ? input.version : null;

  return prisma.$transaction(async (tx) => {
    await lockTemplate(tx, templateId);

    // Re-read under the lock: membership may have been revoked since the
    // session was issued, and the template may have changed since display.
    const member = await tx.member.findFirst({
      where: { id: input.memberId, gymId: input.gymId },
      select: { active: true, approved: true },
    });
    if (!member || !member.active || !member.approved) {
      throw new WaiverError("MEMBERSHIP_INACTIVE", "Your membership at this academy is not active.", 403);
    }

    const template = await tx.waiverTemplate.findFirst({
      where: { id: templateId, gymId: input.gymId },
      select: { id: true, title: true, content: true, version: true, active: true },
    });
    if (!template) throw new WaiverError("NOT_FOUND", "Waiver not found", 404);

    const current = await currentWaiver(input.gymId, tx);
    if (!template.active || current?.id !== template.id) {
      throw new WaiverError("WAIVER_INACTIVE", "This waiver is no longer the academy's current waiver.", 409);
    }
    if (shownVersion === null || shownVersion !== template.version) {
      throw new WaiverError(
        "WAIVER_UPDATED",
        "This waiver was updated after you opened it. Review the new version before signing.",
        409,
      );
    }

    const existing = await tx.waiverSignature.findFirst({
      where: { gymId: input.gymId, memberId: input.memberId, templateId, version: template.version },
      orderBy: { signedAt: "asc" },
      select: { signedAt: true },
    });
    if (existing) {
      return { signedAt: existing.signedAt.toISOString(), version: template.version, alreadySigned: true };
    }

    const signature = await tx.waiverSignature.create({
      data: {
        gymId: input.gymId,
        memberId: input.memberId,
        templateId,
        version: template.version,
        signedName,
        waiverContentSnapshot: template.content,
      },
      select: { signedAt: true },
    });
    return { signedAt: signature.signedAt.toISOString(), version: template.version, alreadySigned: false };
  });
}

/**
 * Edit a template under the signing lock. Content changes take the next
 * version for the gym; title-only edits keep the version.
 */
export async function editWaiverTemplate(input: {
  gymId: string;
  id: string;
  title: string;
  content: string;
}): Promise<{ template: CurrentWaiver & { active: boolean }; contentChanged: boolean } | null> {
  return prisma.$transaction(async (tx) => {
    await lockTemplate(tx, input.id);
    const existing = await tx.waiverTemplate.findFirst({ where: { id: input.id, gymId: input.gymId } });
    if (!existing) return null;

    const contentChanged = input.content !== existing.content;
    const data: { title: string; content: string; version?: number } = {
      title: input.title,
      content: input.content,
    };
    if (contentChanged) {
      const latest = await tx.waiverTemplate.findFirst({
        where: { gymId: input.gymId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      data.version = Math.max(latest?.version ?? 0, existing.version) + 1;
    }
    const template = await tx.waiverTemplate.update({
      where: { id: input.id },
      data,
      select: { id: true, title: true, content: true, version: true, active: true },
    });
    return { template, contentChanged };
  });
}

/** Student deep link for a gym's waiver (lands in the academy context). */
export function studentWaiverUrl(gymId: string) {
  return `/student/academy?gym=${encodeURIComponent(gymId)}#waiver`;
}

/** Owner counts on the current-version contract (active, approved members only). */
export function countCurrentSignatures(
  template: { version: number; signatures: Array<{ memberId: string | null; version: number }> },
  activeMemberIds: Set<string>,
) {
  const current = new Set<string>();
  const older = new Set<string>();
  for (const s of template.signatures) {
    if (!s.memberId || !activeMemberIds.has(s.memberId)) continue;
    if (s.version === template.version) current.add(s.memberId);
    else older.add(s.memberId);
  }
  const previousOnly = Array.from(older).filter((id) => !current.has(id)).length;
  return {
    signed: current.size,
    previousVersionOnly: previousOnly,
    pending: Math.max(activeMemberIds.size - current.size, 0),
  };
}
