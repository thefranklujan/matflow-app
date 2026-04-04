import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "frank@craftedsystems.io,marcus@ironlion.com").split(",").map(e => e.trim());

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || !PLATFORM_ADMINS.includes(session.email)) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="h-14 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">MatFlow</span>
          <span className="bg-orange-500/20 text-orange-400 text-xs font-semibold px-2 py-0.5 rounded">Platform Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/app" className="text-gray-400 text-sm hover:text-white transition">Back to App</a>
          <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {session.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
