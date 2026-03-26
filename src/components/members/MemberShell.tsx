import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MemberSidebar from "@/components/layout/MemberSidebar";
import MemberMobileNav from "@/components/layout/MemberMobileNav";
import AutoRefreshIndicator from "@/components/members/AutoRefreshIndicator";

export default async function MemberShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");
  if (orgRole !== "org:member" && orgRole !== "org:admin") {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)]">
      <MemberSidebar />
      <div className="flex-1 lg:ml-64">
        <MemberMobileNav />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
      <AutoRefreshIndicator />
    </div>
  );
}
