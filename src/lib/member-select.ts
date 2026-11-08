import type { Prisma } from "@prisma/client";

/**
 * Member fields that may be serialized to a browser. Deliberately excludes
 * passwordHash, checkinCode, clerkUserId and isPlatformAdmin: owner APIs used
 * to return whole rows, password hashes included (audit 2026-11-08).
 */
export const MEMBER_SAFE_SELECT = {
  id: true,
  gymId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  studentId: true,
  status: true,
  beltRank: true,
  stripes: true,
  approved: true,
  active: true,
  isAmbassador: true,
  locationSlug: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MemberSelect;
