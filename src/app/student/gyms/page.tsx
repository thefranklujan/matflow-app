export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GymDiscoveryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = q?.trim() || "";

  const gyms = await prisma.gym.findMany({
    where: {
      subscriptionStatus: { not: "cancelled" },
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Find Your Gym</h1>
      <p className="text-gray-500 mb-8">Browse Jiu Jitsu academies on MatFlow. Request to join the one you train at.</p>

      <form action="/student/gyms" method="GET" className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by name, city, or state..."
          className="w-full max-w-md px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626]"
        />
      </form>

      {gyms.length === 0 ? (
        <p className="text-gray-500">No gyms found. Try a different search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gyms.map((gym) => (
            <Link
              key={gym.id}
              href={`/student/gyms/${gym.slug}`}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 hover:border-[#dc2626] transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-lg bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] text-base font-bold">
                  {gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{gym.name}</p>
                  {(gym.city || gym.state) && (
                    <p className="text-gray-500 text-xs">{gym.city}{gym.city && gym.state ? ", " : ""}{gym.state}</p>
                  )}
                </div>
              </div>
              {gym.description && <p className="text-gray-400 text-xs line-clamp-2">{gym.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
