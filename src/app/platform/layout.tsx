import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import PlatformNav from "./PlatformNav";
import PlatformUserMenu from "./PlatformUserMenu";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map(e => e.trim().toLowerCase());

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="h-14 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">MatFlow</span>
          <span className="bg-orange-500/20 text-orange-400 text-xs font-semibold px-2 py-0.5 rounded">Platform Admin</span>
        </div>
        <PlatformUserMenu name={session.name} email={session.email} />
      </header>
      <PlatformNav />
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
