import { prisma } from "@/lib/prisma";

/**
 * Academy data export (pilot portability). Read-only, single-academy scope.
 *
 * Format: one JSON document, `format: "matflow-academy-export"`,
 * `schemaVersion: 1`. Every record carries its own `id`; relationships are
 * plain id references described in `manifest.relationships`, and
 * `manifest.counts` lets the recipient check completeness. Documented for
 * humans in docs/ACADEMY-EXPORT.md.
 *
 * Included: academy profile, roster (members), instructors, class schedule,
 * attendance, academy belt history, waiver templates (every version's current
 * text) and waiver signatures with their immutable signed snapshot, and the
 * drop-in visitors those signatures reference.
 *
 * Excluded by construction (explicit `select`, never `include`): password
 * hashes, auth/legacy identity ids (clerkUserId), kiosk check-in codes,
 * Stripe ids, the link to a student's independent account (only a boolean),
 * students' private training journals/plans, community posts, other
 * academies' data, and founder prospect/campaign records.
 *
 * Bounded: each table is capped; an academy over the cap gets an explicit
 * ExportTooLargeError (support-assisted export) instead of a silently
 * truncated file that claims to be complete.
 */

export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_ROW_LIMIT = 50_000;

export class ExportTooLargeError extends Error {
  constructor(public readonly table: string) {
    super(`Export exceeds ${EXPORT_ROW_LIMIT} ${table} rows`);
    this.name = "ExportTooLargeError";
  }
}

async function bounded<T>(table: string, rows: Promise<T[]>): Promise<T[]> {
  const r = await rows;
  if (r.length > EXPORT_ROW_LIMIT) throw new ExportTooLargeError(table);
  return r;
}

const take = EXPORT_ROW_LIMIT + 1;

export async function buildAcademyExport(gymId: string, now = new Date()) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true, name: true, slug: true, description: true, city: true, state: true,
      address: true, phone: true, website: true, timezone: true, createdAt: true,
    },
  });
  if (!gym) return null;

  const where = { gymId };
  const [members, instructors, classSchedules, attendance, beltProgress, waiverTemplates, waiverSignatures, dropIns] =
    await Promise.all([
      bounded("members", prisma.member.findMany({
        where, take, orderBy: { createdAt: "asc" },
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          beltRank: true, stripes: true, status: true, active: true, approved: true,
          locationSlug: true, createdAt: true, studentId: true,
        },
      })),
      bounded("instructors", prisma.instructor.findMany({
        where, take, orderBy: { createdAt: "asc" },
        select: { id: true, name: true, beltRank: true, bio: true, memberId: true, active: true, createdAt: true },
      })),
      bounded("classSchedules", prisma.classSchedule.findMany({
        where, take, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: {
          id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true,
          instructor: true, instructorId: true, locationSlug: true, topic: true, active: true,
        },
      })),
      bounded("attendance", prisma.attendance.findMany({
        where, take, orderBy: { checkedInAt: "asc" },
        select: { id: true, memberId: true, classDate: true, classType: true, locationSlug: true, checkedInAt: true },
      })),
      bounded("beltProgress", prisma.beltProgress.findMany({
        where, take, orderBy: { awardedAt: "asc" },
        select: { id: true, memberId: true, beltRank: true, stripes: true, note: true, awardedAt: true, awardedBy: true },
      })),
      bounded("waiverTemplates", prisma.waiverTemplate.findMany({
        where, take, orderBy: { createdAt: "asc" },
        select: { id: true, title: true, content: true, version: true, active: true, createdAt: true },
      })),
      bounded("waiverSignatures", prisma.waiverSignature.findMany({
        where, take, orderBy: { signedAt: "asc" },
        select: {
          id: true, templateId: true, memberId: true, dropInId: true, version: true,
          signedName: true, signedAt: true, waiverContentSnapshot: true,
        },
      })),
      bounded("dropIns", prisma.dropIn.findMany({
        where, take, orderBy: { visitDate: "asc" },
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          visitDate: true, classType: true, convertedMemberId: true,
        },
      })),
    ]);

  const roster = members.map(({ studentId, ...m }) => ({ ...m, hasStudentAccount: studentId !== null }));

  return {
    format: "matflow-academy-export",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    academy: gym,
    manifest: {
      counts: {
        members: roster.length,
        instructors: instructors.length,
        classSchedules: classSchedules.length,
        attendance: attendance.length,
        beltProgress: beltProgress.length,
        waiverTemplates: waiverTemplates.length,
        waiverSignatures: waiverSignatures.length,
        dropIns: dropIns.length,
      },
      relationships: [
        "attendance.memberId -> members.id",
        "beltProgress.memberId -> members.id",
        "waiverSignatures.templateId -> waiverTemplates.id",
        "waiverSignatures.memberId -> members.id (null for drop-in signatures)",
        "waiverSignatures.dropInId -> dropIns.id (null for member signatures)",
        "instructors.memberId -> members.id (optional)",
        "classSchedules.instructorId -> instructors.id (optional)",
        "dropIns.convertedMemberId -> members.id (optional)",
      ],
      notes: [
        "waiverTemplates.content is the CURRENT text of each template; the text a person actually signed is waiverSignatures.waiverContentSnapshot at waiverSignatures.version.",
        "Commitments (planned attendance) are not attendance and are not included.",
        "This is an export only. MatFlow does not offer a restore/import from this file.",
      ],
    },
    members: roster,
    instructors,
    classSchedules,
    attendance,
    beltProgress,
    waiverTemplates,
    waiverSignatures,
    dropIns,
  };
}

export type AcademyExport = NonNullable<Awaited<ReturnType<typeof buildAcademyExport>>>;

export function exportFilename(slug: string, now = new Date()) {
  return `matflow-${slug.replace(/[^a-z0-9-]/gi, "")}-export-${now.toISOString().slice(0, 10)}.json`;
}
