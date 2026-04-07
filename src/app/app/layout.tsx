import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AuthProvider } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* Desktop layout */}
      <div className="hidden md:flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-[#111] p-6">{children}</main>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <MobileLayout>
          <div className="bg-[#111] p-4">{children}</div>
        </MobileLayout>
      </div>
    </AuthProvider>
  );
}
