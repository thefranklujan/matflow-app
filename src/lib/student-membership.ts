import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

/**
 * Deterministic current-membership resolver for student self-service features.
 *
 * The session issued at student login carries the SPECIFIC membership the
 * student signed in under (studentId + memberId + gymId). This resolver
 * re-reads that exact Member row and verifies every binding — it never picks
 * an arbitrary `findFirst` membership and never infers a gym from the
 * free-text Student.homeGym field, both of which can disagree with the
 * signed-in membership for multi-gym histories.
 */

export class StaleMembershipError extends Error {
  constructor(public code: "not_student" | "no_active_membership") {
    super(code);
    this.name = "StaleMembershipError";
  }
}

export interface StudentMembership {
  studentId: string;
  member: {
    id: string;
    gymId: string;
    firstName: string;
    lastName: string;
  };
  gym: {
    id: string;
    name: string;
    timezone: string;
    lat: number | null;
    lng: number | null;
    geofenceRadiusM: number;
  };
}

export async function requireStudentMembership(): Promise<StudentMembership> {
  const session = await getSession();
  if (!session || session.userType !== "student" || !session.studentId) {
    throw new StaleMembershipError("not_student");
  }
  if (!session.memberId || !session.gymId) {
    throw new StaleMembershipError("no_active_membership");
  }

  // Re-read using ALL identifiers so a stale cookie (membership transferred,
  // deactivated, or unapproved since login) fails closed.
  const member = await prisma.member.findFirst({
    where: {
      id: session.memberId,
      gymId: session.gymId,
      studentId: session.studentId,
      active: true,
      approved: true,
    },
    select: {
      id: true,
      gymId: true,
      firstName: true,
      lastName: true,
      gym: {
        select: {
          id: true,
          name: true,
          timezone: true,
          lat: true,
          lng: true,
          geofenceRadiusM: true,
        },
      },
    },
  });

  if (!member) {
    throw new StaleMembershipError("no_active_membership");
  }

  return {
    studentId: session.studentId,
    member: { id: member.id, gymId: member.gymId, firstName: member.firstName, lastName: member.lastName },
    gym: member.gym,
  };
}
