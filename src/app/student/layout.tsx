import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import StudentShell from "./StudentShell";
import ViewAsStudentBanner from "@/components/layout/ViewAsStudentBanner";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/sign-in");

  const c = await cookies();
  const viewAsStudent = c.get("view_as_student")?.value === "1";

  // Allow admins into /student via "view as student" mode.
  // Otherwise, only true student accounts may enter.
  if (session.userType !== "student" && !viewAsStudent) redirect("/app");

  return (
    <>
      {viewAsStudent && <ViewAsStudentBanner />}
      <StudentShell name={session.name}>{children}</StudentShell>
    </>
  );
}
