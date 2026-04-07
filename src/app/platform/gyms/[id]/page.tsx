export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ImpersonateButton from "./ImpersonateButton";

export default async function GymDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const gym = await prisma.gym.findUnique({
    where: { id },
    include: {
      members: { orderBy: { createdAt: "asc" } },
      _count: { select: { products: true, orders: true, classSchedules: true } },
    },
  });

  if (!gym) notFound();

  const owner = gym.members[0];
  const totalRevenue = await prisma.order.aggregate({
    where: { gymId: gym.id },
    _sum: { total: true },
  });

  const recentAttendance = await prisma.attendance.count({
    where: { gymId: gym.id, classDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });

  const beltDistribution = await prisma.member.groupBy({
    by: ["beltRank"],
    where: { gymId: gym.id, active: true },
    _count: true,
  });

  return (
    <div>
      <Link href="/platform/gyms" className="text-gray-500 text-sm hover:text-white mb-4 inline-block">
        &larr; Back to Gyms
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg bg-[#c4b5a0]/10 flex items-center justify-center text-[#c4b5a0] text-2xl font-bold">
            {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{gym.name}</h1>
            <p className="text-gray-500 font-mono text-sm">{gym.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/join/${gym.slug}`}
            target="_blank"
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/10"
          >
            View Join Page
          </Link>
          <Link
            href={`/kiosk/${gym.slug}`}
            target="_blank"
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/10"
          >
            View Kiosk
          </Link>
          {owner && <ImpersonateButton gymId={gym.id} ownerEmail={owner.email} />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Members" value={gym.members.length} />
        <Stat label="Products" value={gym._count.products} />
        <Stat label="Orders" value={gym._count.orders} sub={`$${(totalRevenue._sum.total || 0).toFixed(0)} revenue`} />
        <Stat label="Check-ins (30d)" value={recentAttendance} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Owner Info */}
        <div className="bg-[#111] border border-white/10 rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Gym Owner</h2>
          {owner ? (
            <div className="space-y-2">
              <div>
                <p className="text-gray-500 text-xs uppercase">Name</p>
                <p className="text-white font-medium">{owner.firstName} {owner.lastName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase">Email</p>
                <p className="text-white">{owner.email}</p>
              </div>
              {owner.phone && (
                <div>
                  <p className="text-gray-500 text-xs uppercase">Phone</p>
                  <p className="text-white">{owner.phone}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500 text-xs uppercase">Joined</p>
                <p className="text-white">{new Date(owner.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No owner found</p>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-[#111] border border-white/10 rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Subscription</h2>
          <div className="space-y-2">
            <div>
              <p className="text-gray-500 text-xs uppercase">Status</p>
              <p className="text-white capitalize">{gym.subscriptionStatus}</p>
            </div>
            {gym.trialEndsAt && (
              <div>
                <p className="text-gray-500 text-xs uppercase">Trial Ends</p>
                <p className="text-white">{new Date(gym.trialEndsAt).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs uppercase">Stripe Customer</p>
              <p className="text-white text-sm font-mono">{gym.stripeCustomerId || "Not set"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">Created</p>
              <p className="text-white">{new Date(gym.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-[#111] border border-white/10 rounded-lg p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Members ({gym.members.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {gym.members.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-white text-sm">{m.firstName} {m.lastName} {i === 0 && <span className="text-xs text-orange-400 ml-2">(Owner)</span>}</p>
                  <p className="text-gray-500 text-xs">{m.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm capitalize">{m.beltRank} {m.stripes > 0 && `(${m.stripes})`}</p>
                  <p className="text-gray-600 text-xs">{m.active ? "Active" : "Inactive"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Belt distribution */}
        {beltDistribution.length > 0 && (
          <div className="bg-[#111] border border-white/10 rounded-lg p-6 lg:col-span-2">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Belt Distribution</h2>
            <div className="space-y-2">
              {["white", "blue", "purple", "brown", "black"].map((belt) => {
                const count = beltDistribution.find(b => b.beltRank === belt)?._count || 0;
                const max = Math.max(...beltDistribution.map(b => b._count), 1);
                return (
                  <div key={belt} className="flex items-center gap-3">
                    <span className="text-gray-300 capitalize w-16 text-sm">{belt}</span>
                    <div className="flex-1 bg-black/40 rounded h-5">
                      <div className="h-full bg-orange-500/40 rounded flex items-center pl-2" style={{ width: `${Math.max((count/max)*100, 5)}%` }}>
                        <span className="text-orange-400 text-xs font-bold">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-5">
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
