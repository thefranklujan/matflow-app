export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GymDiscoveryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = q?.trim() || "";

  const [activeGyms, nominationGroups] = await Promise.all([
    prisma.gym.findMany({
      where: {
        subscriptionStatus: { not: "cancelled" },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const initials = card.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const inner = (
              <div
                className={`bg-[#0a0a0a] border rounded-xl p-5 transition h-full ${
                  card.isActive ? "border-white/10 hover:border-[#dc2626]" : "border-yellow-500/20 hover:border-yellow-500/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-12 w-12 rounded-lg flex items-center justify-center text-base font-bold ${
                        card.isActive ? "bg-[#dc2626]/10 text-[#dc2626]" : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{card.name}</p>
                      {(card.city || card.state) && (
                        <p className="text-gray-500 text-xs">
                          {card.city}
                          {card.city && card.state ? ", " : ""}
                          {card.state}
                        </p>
                      )}
                    </div>
                  </div>
                  {!card.isActive && (
                    <span className="bg-yellow-500/20 text-yellow-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded shrink-0">
                      Not Active
                    </span>
                  )}
                </div>
                {card.isActive && card.description && (
                  <p className="text-gray-400 text-xs line-clamp-2">{card.description}</p>
                )}
                {!card.isActive && (
                  <p className="text-gray-500 text-xs">
                    {card.memberCount ?? 0} student{(card.memberCount ?? 0) === 1 ? "" : "s"} have nominated this gym.
                    Nominate it too to grow the group — we&apos;ll reach out to the owner.
                  </p>
                )}
              </div>
            );
            return card.href ? (
              <Link key={card.key} href={card.href}>
                {inner}
              </Link>
            ) : (
              <Link key={card.key} href="/student/nominate">
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
