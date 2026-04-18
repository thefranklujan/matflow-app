import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import StudentShell from "./StudentShell";
import ViewingStudentBanner from "@/components/layout/ViewingStudentBanner";
import UnreadBanner from "@/components/UnreadBanner";
import ProximityPing from "@/components/student/ProximityPing";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/sign-in");

  // Only true student accounts may enter the student portal
  if (session.userType !== "student") redirect("/app");

  const student = session.studentId
    ? await prisma.student.findUnique({
        where: { id: session.studentId },
        select: { beltRank: true, stripes: true, avatarUrl: true, homeGym: true },
      })
    : null;

  const c = await cookies();
  const viewingStudent = c.get("viewing_student")?.value === "1";
  const viewedStudentName = c.get("view_student_name")?.value || session.name;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {viewingStudent && <ViewingStudentBanner studentName={viewedStudentName} />}
      <UnreadBanner variant="student" />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <StudentShell
          name={session.name}
          beltRank={student?.beltRank || "white"}
          stripes={student?.stripes || 0}
          avatarUrl={student?.avatarUrl || null}
          studentId={session.studentId || undefined}
          homeGym={student?.homeGym || null}
        >
          {children}
        </StudentShell>
        <ProximityPing />
      </div>
    </div>
  );
}
