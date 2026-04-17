export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

/**
 * In-app account deletion, required by Apple App Store Guideline 5.1.1(v).
 *
 * Hard-deletes the user's Student + all Member records, cascading any related
 * data. For gym owners (their first Member is role=admin), we currently block
 * deletion with a clear message instructing them to transfer ownership first,
 * since hard-deleting would orphan the gym and its students.
 *
 * Requires a two-step confirmation from the client: the request body must
 * contain `confirmation: "DELETE"` to guard against accidental taps.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation required. Type DELETE to confirm." },
      { status: 400 }
    );
  }

  // Gym owner guard: prevent orphaning a gym
  if (session.memberId && session.gymId) {
    const member = await prisma.member.findUnique({
      where: { id: session.memberId },
      include: { gym: { select: { name: true } } },
    });
    if (member) {
      const firstMember = await prisma.member.findFirst({
        where: { gymId: member.gymId },
        orderBy: { createdAt: "asc" },
      });
      if (firstMember?.id === member.id) {
        return NextResponse.json(
          {
            error: `You own ${member.gym.name}. Deleting your account would orphan the gym and its students. Please contact support@mymatflow.com to transfer ownership or close the gym first.`,
          },
          { status: 400 }
        );
      }
    }
  }

  try {
    // Delete Student (cascades Member records via studentId FK, plus
    // training sessions, nominations, group memberships, etc.)
    if (session.studentId) {
      await prisma.member.deleteMany({ where: { studentId: session.studentId } });
      await prisma.student.delete({ where: { id: session.studentId } });
    } else if (session.memberId) {
      // Edge case: Member record only (old gym owner path with no Student)
      await prisma.member.delete({ where: { id: session.memberId } });
    }
  } catch (err) {
    console.error("[account-delete] failed:", err);
    return NextResponse.json({ error: "Deletion failed. Please contact support." }, { status: 500 });
  }

  // Clear the session cookie so the user is signed out
  const c = await cookies();
  c.delete("matflow-session");

  return NextResponse.json({ success: true });
}
