import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AuthProvider } from "@/lib/auth-context";
import { BillingGuard } from "@/components/layout/BillingGuard";
import ViewAsStudentBanner from "@/components/layout/ViewAsStudentBanner";
import ViewingGymBanner from "@/components/layout/ViewingGymBanner";
import DemoModeBanner from "@/components/layout/DemoModeBanner";
import UnreadBanner from "@/components/UnreadBanner";
import OwnerNativeGuard from "@/components/OwnerNativeGuard";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  // Students never access the gym-owner dashboard. One gym, one student.
  if (session.userType === "student") redirect("/student");

  const c = await cookies();

  // Native iOS shell never renders the gym owner dashboard. Apple App
  // Store 3.1.1 requires that paid functionality not be reachable in
  // the iOS app. Server side redirect happens before any owner UI is
  // generated, so there is zero flash of dashboard HTML.
  if (c.get("matflow-native")?.value === "1") {
    redirect("/native-web-only");
  }

  const viewAsStudent = c.get("view_as_student")?.value === "1";
  const demoMode = c.get("demo_mode")?.value === "1";
  const viewingGym = c.get("viewing_gym")?.value === "1";
  const viewGymName = c.get("view_gym_name")?.value || session.name;
  return (
    <AuthProvider>
      <OwnerNativeGuard />
      <BillingGuard>
        {/* Desktop layout */}
        <div className="hidden md:flex md:flex-col h-[100dvh] overflow-hidden">
          {demoMode && <DemoModeBanner />}
          {viewingGym && <ViewingGymBanner gymName={viewGymName} />}
          {viewAsStudent && <ViewAsStudentBanner />}
          <UnreadBanner variant="app" />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 min-h-0 overflow-y-auto bg-[#111] p-6">{children}</main>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden flex flex-col h-[100dvh] overflow-hidden">
          {demoMode && <DemoModeBanner />}
          {viewingGym && <ViewingGymBanner gymName={viewGymName} />}
          {viewAsStudent && <ViewAsStudentBanner />}
          <UnreadBanner variant="app" />
          <MobileLayout>
            <div className="bg-[#111] p-4">{children}</div>
          </MobileLayout>
        </div>
      </BillingGuard>
    </AuthProvider>
  );
}
