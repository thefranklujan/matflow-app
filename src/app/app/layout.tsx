import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AuthProvider } from "@/lib/auth-context";
import { BillingGuard } from "@/components/layout/BillingGuard";
import ViewAsStudentBanner from "@/components/layout/ViewAsStudentBanner";
import ViewingGymBanner from "@/components/layout/ViewingGymBanner";
import DemoModeBanner from "@/components/layout/DemoModeBanner";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  // Students never access the gym-owner dashboard. One gym, one student.
  if (session.userType === "student") redirect("/student");

  const c = await cookies();
  const viewAsStudent = c.get("view_as_student")?.value === "1";
  const demoMode = c.get("demo_mode")?.value === "1";
  const viewingGym = c.get("viewing_gym")?.value === "1";
  const viewGymName = c.get("view_gym_name")?.value || session.name;
  return (
    <AuthProvider>
      <BillingGuard>
        {/* Desktop layout */}
        <div className="hidden md:flex md:flex-col h-screen overflow-hidden">
          {demoMode && <DemoModeBanner />}
          {viewingGym && <ViewingGymBanner gymName={viewGymName} />}
          {viewAsStudent && <ViewAsStudentBanner />}
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto bg-[#111] p-6">{children}</main>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden flex flex-col h-screen overflow-hidden">
          {demoMode && <DemoModeBanner />}
          {viewingGym && <ViewingGymBanner gymName={viewGymName} />}
          {viewAsStudent && <ViewAsStudentBanner />}
          <MobileLayout>
            <div className="bg-[#111] p-4">{children}</div>
          </MobileLayout>
        </div>
      </BillingGuard>
    </AuthProvider>
  );
}
