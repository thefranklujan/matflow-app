export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GymDiscoveryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = q?.trim() || "";

  // Hide internal/platform-only gyms from the discovery list
  const HIDDEN_GYM_IDS = ["platform-owner-gym", "platform-admin-gym"];

  const [activeGyms, nominationGroups] = await Promise.all([
    prisma.gym.findMany({
      where: {
        id: { notIn: HIDDEN_GYM_IDS },
        subscriptionStatus: { not: "cancelled" },
        approved: true,
        hidden: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { state: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.gymGroup.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { state: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { memberCount: "desc" },
      take: 50,
    }),
  ]);

  // Build a unified list. Active gyms (real Gym rows) take priority.
  // Nomination groups whose name doesn't match an active gym get the "Not Active" badge.
  const activeNames = new Set(activeGyms.map((g) => g.name.toLowerCase().trim()));
  type Card = {
    key: string;
    name: string;
    city: string | null;
    state: string | null;
    description?: string | null;
    isActive: boolean;
    href: string | null;
    memberCount?: number;
  };
  const cards: Card[] = [
    ...activeGyms.map((g) => ({
      key: `gym-${g.id}`,
      name: g.name,
      city: g.city,
      state: g.state,
      description: g.description,
      isActive: true,
      href: `/student/gyms/${g.slug}`,
    })),
    ...nominationGroups
      .filter((n) => !activeNames.has(n.name.toLowerCase().trim()))
      .map((n) => ({
        key: `nom-${n.id}`,
        name: n.name,
        city: n.city,
        state: n.state,
        isActive: false,
        href: null,
        memberCount: n.memberCount,
      })),
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Find Your Gym</h1>
      <p className="text-gray-500 mb-8">
        Browse Jiu Jitsu academies on MatFlow. Request to join the one you train at, or nominate
        yours if it isn&apos;t here yet.
      </p>

      <form action="/student/gyms" method="GET" className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by name, city, or state..."
          className="w-full max-w-md px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626]"
        />
      </form>

      {cards.length === 0 ? (
        <div className="text-gray-500">
          <p>No gyms found.{" "}
            <Link href="/student/nominate" className="text-[#dc2626] hover:underline">Nominate yours</Link>{" "}
            and we&apos;ll get them on MatFlow.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active gyms section */}
          {cards.filter((c) => c.isActive).length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Gyms on MatFlow</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  These academies are active. Tap to view and request to join.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.filter((c) => c.isActive).map((card) => {
                  const initials = card.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={card.key}
                      href={card.href || "#"}
                      className="bg-[#0a0a0a] border border-white/10 hover:border-[#dc2626] rounded-xl p-5 transition h-full"
                    >
                      <div className="flex items-center gap-3 min-w-0 mb-3">
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-base font-bold bg-[#dc2626]/10 text-[#dc2626] shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-semibold truncate">{card.name}</p>
                          {(card.city || card.state) && (
                            <p className="text-gray-500 text-xs">
                              {card.city}{card.city && card.state ? ", " : ""}{card.state}
                            </p>
                          )}
                        </div>
                      </div>
                      {card.description && (
                        <p className="text-gray-400 text-xs line-clamp-2">{card.description}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Nominated — not yet live */}
          {cards.filter((c) => !c.isActive).length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Not Yet on MatFlow</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Students nominated these gyms. Nominate yours too to grow the group, we&apos;ll reach out to the owner.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.filter((c) => !c.isActive).map((card) => {
                  const initials = card.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={card.key}
                      href="/student/nominate"
                      className="bg-[#0a0a0a] border border-yellow-500/20 hover:border-yellow-500/50 rounded-xl p-5 transition h-full"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-lg flex items-center justify-center text-base font-bold bg-yellow-500/10 text-yellow-400 shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold truncate">{card.name}</p>
                            {(card.city || card.state) && (
                              <p className="text-gray-500 text-xs">
                                {card.city}{card.city && card.state ? ", " : ""}{card.state}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="bg-yellow-500/20 text-yellow-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded shrink-0">
                          Not Active
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">
                        {card.memberCount ?? 0} student{(card.memberCount ?? 0) === 1 ? "" : "s"} nominating.
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
