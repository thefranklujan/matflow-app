import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the effective Student id for the current session.
 * Works for both Student-only sessions and Member sessions linked to a Student.
 */
export async function effectiveStudentId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.studentId) return session.studentId;
  if (session.memberId) {
    const m = await prisma.member.findUnique({
      where: { id: session.memberId },
      select: { studentId: true },
    });
    return m?.studentId || null;
  }
  return null;
}

export async function isGroupMod(groupId: string, studentId: string): Promise<boolean> {
  const m = await prisma.gymGroupMember.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
    select: { role: true, status: true },
  });
  return m?.role === "mod" && m?.status === "active";
}
