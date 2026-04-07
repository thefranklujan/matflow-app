export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GymsListPage() {
  const gyms = await prisma.gym.findMany({
    include: {
      _count: { select: { members: true, products: true, orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">All Gyms</h1>
        <span className="text-gray-500 text-sm">{gyms.length} total</span>
      </div>

      <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-6 py-3">Gym</th>
              <th className="text-left px-6 py-3">Slug</th>
              <th className="text-center px-6 py-3">Members</th>
              <th className="text-center px-6 py-3">Products</th>
              <th className="text-center px-6 py-3">Orders</th>
              <th className="text-center px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Trial Ends</th>
              <th className="text-right px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {gyms.map((gym) => {
              const statusColor =
                gym.subscriptionStatus === "active" ? "bg-green-500/20 text-green-400"
                : gym.subscriptionStatus === "trialing" ? "bg-yellow-500/20 text-yellow-400"
                : "bg-gray-500/20 text-gray-400";
              return (
                <tr key={gym.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-[#c4b5a0]/10 flex items-center justify-center text-[#c4b5a0] text-xs font-bold">
                        {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{gym.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm font-mono">{gym.slug}</td>
                  <td className="px-6 py-4 text-center text-white">{gym._count.members}</td>
                  <td className="px-6 py-4 text-center text-white">{gym._count.products}</td>
                  <td className="px-6 py-4 text-center text-white">{gym._count.orders}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                      {gym.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {gym.trialEndsAt ? new Date(gym.trialEndsAt).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/platform/gyms/${gym.id}`}
                      className="text-orange-400 hover:text-orange-300 text-sm font-medium"
                    >
                      View &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
