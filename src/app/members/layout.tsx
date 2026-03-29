import { redirect } from "next/navigation";
import { getSession } from "@/lib/local-auth";
import MemberSidebar from "@/components/layout/MemberSidebar";
import MemberMobileNav from "@/components/layout/MemberMobileNav";

export default async function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="flex min-h-screen">
      <MemberSidebar />
      <div className="flex-1 lg:ml-64">
        <MemberMobileNav />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
