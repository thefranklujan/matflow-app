import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import StudentShell from "./StudentShell";
import ViewingStudentBanner from "@/components/layout/ViewingStudentBanner";

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

  const c = await cookies();
  const viewingStudent = c.get("viewing_student")?.value === "1";
  const viewedStudentName = c.get("view_student_name")?.value || session.name;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {viewingStudent && <ViewingStudentBanner studentName={viewedStudentName} />}
      <div className="flex-1 min-h-0">
        <StudentShell
          name={session.name}
          beltRank={student?.beltRank || "white"}
          stripes={student?.stripes || 0}
        >
          {children}
        </StudentShell>
      </div>
    </div>
  );
}
