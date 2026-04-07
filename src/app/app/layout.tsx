import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AuthProvider } from "@/lib/auth-context";
import ViewAsStudentBanner from "@/components/layout/ViewAsStudentBanner";
import { cookies } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const viewAsStudent = c.get("view_as_student")?.value === "1";
  return (
    <AuthProvider>
      {/* Desktop layout */}
      <div className="hidden md:flex md:flex-col h-screen overflow-hidden">
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
        {viewAsStudent && <ViewAsStudentBanner />}
        <MobileLayout>
          <div className="bg-[#111] p-4">{children}</div>
        </MobileLayout>
      </div>
    </AuthProvider>
  );
}
