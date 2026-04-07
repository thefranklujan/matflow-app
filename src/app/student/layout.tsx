import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentShell from "./StudentShell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/sign-in");

  // Only true student accounts may enter the student portal
  if (session.userType !== "student") redirect("/app");

  const student = session.studentId
    ? await prisma.student.findUnique({
        where: { id: session.studentId },
        select: { beltRank: true, stripes: true },
      })
    : null;

  return (
    <StudentShell
      name={session.name}
      beltRank={student?.beltRank || "white"}
      stripes={student?.stripes || 0}
    >
      {children}
    </StudentShell>
  );
}
