import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import StudentShell from "./StudentShell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/sign-in");

  // Only true student accounts may enter the student portal
  if (session.userType !== "student") redirect("/app");

  return <StudentShell name={session.name}>{children}</StudentShell>;
}
