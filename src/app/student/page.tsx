export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, Inbox, Building2 } from "lucide-react";

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const [memberships, requests, suggestedGyms] = await Promise.all([
    prisma.member.findMany({
      where: { studentId: session.studentId },
      include: { gym: { select: { id: true, name: true, slug: true, city: true, state: true, logo: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.joinRequest.findMany({
      where: { studentId: session.studentId },
      include: { gym: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gym.findMany({
      take: 4,
      where: { subscriptionStatus: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Welcome, {session.name.split(" ")[0]}</h1>
      <p className="text-gray-500 mb-8">Your training, your gyms, your community.</p>

      {/* My Gyms */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">My Gyms</h2>
          <Link href="/student/gyms" className="text-[#dc2626] text-sm hover:underline">Find more</Link>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">You are not a member of any gym yet</p>
            <p className="text-gray-500 text-sm mb-6">Find your gym, request to join, and get full access to schedule, videos, attendance, and belt tracking.</p>
            <Link href="/student/gyms" className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-6 py-3 rounded-lg transition">
              <Search className="h-4 w-4" /> Find a Gym
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships.map((m) => (
              <form key={m.id} action={`/api/student/switch-gym/${m.gymId}`} method="POST">
                <button type="submit" className="w-full text-left bg-[#0a0a0a] border border-white/10 rounded-xl p-5 hover:border-[#dc2626] transition group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] text-sm font-bold">
                      {m.gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{m.gym.name}</p>
                      {m.gym.city && <p className="text-gray-500 text-xs">{m.gym.city}{m.gym.state ? `, ${m.gym.state}` : ""}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 capitalize">{m.beltRank} belt {m.stripes > 0 && `(${m.stripes})`}</p>
                  <p className="text-[#dc2626] text-xs font-medium mt-2 group-hover:underline">Open Gym &rarr;</p>
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Pending Requests */}
      {pendingCount > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pending Requests</h2>
            <Link href="/student/requests" className="text-[#dc2626] text-sm hover:underline">View all</Link>
          </div>
          <div className="bg-[#0a0a0a] border border-yellow-500/30 rounded-xl divide-y divide-white/5">
            {requests.filter((r) => r.status === "pending").slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Inbox className="h-4 w-4 text-yellow-400" />
                  <p className="text-white text-sm">{r.gym.name}</p>
                </div>
                <span className="text-xs text-yellow-400 font-medium">Awaiting approval</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested Gyms */}
      {memberships.length === 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Suggested Gyms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestedGyms.map((gym) => (
              <Link key={gym.id} href={`/student/gyms/${gym.slug}`} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 hover:border-[#dc2626] transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] text-sm font-bold">
                    {gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{gym.name}</p>
                    {gym.city && <p className="text-gray-500 text-xs">{gym.city}{gym.state ? `, ${gym.state}` : ""}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
