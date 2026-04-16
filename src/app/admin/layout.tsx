import { redirect } from "next/navigation";
import { getSession } from "@/lib/local-auth";
import AdminSidebar from "@/components/layout/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.userType === "student") redirect("/student");
  if (session.role !== "admin") redirect("/app");

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64">{children}</div>
    </div>
  );
}
