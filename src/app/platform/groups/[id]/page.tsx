export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export default async function PlatformGroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.gymGroup.findUnique({
    where: { id },
    include: {
      members: {
        include: { student: { select: { firstName: true, lastName: true, email: true, beltRank: true, createdAt: true } } },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
      },
      posts: {
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!group) notFound();

  const activeMembers = group.members.filter((m) => m.status === "active");
  const pendingMembers = group.members.filter((m) => m.status === "pending");
  const mods = activeMembers.filter((m) => m.role === "mod");

  // Nomination history (who nominated this gym, with optional owner contact)
  const nominations = await prisma.gymNomination.findMany({
    where: { gymName: { equals: group.name, mode: "insensitive" } },
    include: { student: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link href="/platform/nominations" className="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to nominations
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{group.name}</h1>
          {(group.city || group.state) && (
            <p className="text-gray-500 mt-1">{group.city}{group.city && group.state ? ", " : ""}{group.state}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Active Members</p>
          <p className="text-3xl font-bold text-cyan-400">{activeMembers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI label="Total Members" value={group.members.length} />
        <KPI label="Active" value={activeMembers.length} color="text-green-400" />
        <KPI label="Pending Vouch" value={pendingMembers.length} color="text-yellow-400" />
        <KPI label="Posts" value={group.posts.length} color="text-cyan-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Members */}
        <div className="lg:col-span-2">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mb-4">
            <h2 className="text-white font-semibold mb-3">Members ({activeMembers.length})</h2>
            <div className="divide-y divide-white/5">
              {activeMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                      {(m.student?.firstName?.[0] || "?")}{(m.student?.lastName?.[0] || "")}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-1.5">
                        {m.student?.firstName} {m.student?.lastName}
                        {m.role === "mod" && (
                          <span title="Moderator" className="inline-flex">
                            <Shield className="h-3 w-3 text-yellow-400" />
                          </span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {m.student?.email} . joined {new Date(m.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs capitalize">{m.student?.beltRank || "white"}</span>
                </div>
              ))}
            </div>
          </div>

          {pendingMembers.length > 0 && (
            <div className="bg-[#0a0a0a] border border-yellow-500/30 rounded-xl p-5 mb-4">
              <h2 className="text-yellow-400 font-semibold mb-3">Pending Vouches ({pendingMembers.length})</h2>
              <div className="divide-y divide-white/5">
                {pendingMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2">
                    <p className="text-white text-sm">{m.student?.firstName} {m.student?.lastName}</p>
                    <span className="text-yellow-400 text-xs">{new Date(m.joinedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">Recent Posts ({group.posts.length})</h2>
            {group.posts.length === 0 ? (
              <p className="text-gray-600 text-sm">No posts yet.</p>
            ) : (
              <div className="space-y-3">
                {group.posts.map((p) => (
                  <div key={p.id} className={`border-l-2 pl-3 py-1 ${p.hidden ? "border-yellow-500/50 opacity-60" : "border-cyan-500/40"}`}>
                    <p className="text-white text-sm font-medium">
                      {p.student?.firstName} {p.student?.lastName}
                      <span className="text-gray-600 text-xs ml-2">{new Date(p.createdAt).toLocaleDateString()}</span>
                      {p.hidden && <span className="ml-2 text-yellow-400 text-[10px] uppercase">Hidden</span>}
                    </p>
                    <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{p.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#0a0a0a] border border-yellow-500/20 rounded-xl p-5">
            <h2 className="text-yellow-400 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Moderators ({mods.length})
            </h2>
            {mods.length === 0 ? (
              <p className="text-gray-600 text-sm">No mods.</p>
            ) : (
              <div className="space-y-2">
                {mods.map((m) => (
                  <div key={m.id} className="text-white text-sm">
                    {m.student?.firstName} {m.student?.lastName}
                    <p className="text-gray-500 text-xs">{m.student?.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0a0a0a] border border-orange-500/20 rounded-xl p-5">
            <h2 className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-3">Nominations ({nominations.length})</h2>
            {nominations.length === 0 ? (
              <p className="text-gray-600 text-sm">No nomination records.</p>
            ) : (
              <div className="space-y-3">
                {nominations.map((n) => (
                  <div key={n.id} className="text-sm">
                    <p className="text-white">{n.student?.firstName} {n.student?.lastName}</p>
                    <p className="text-gray-500 text-xs">{n.student?.email}</p>
                    {(n.ownerEmail || n.ownerPhone) && (
                      <div className="text-orange-400 text-xs mt-1">
                        {n.ownerEmail && <a href={`mailto:${n.ownerEmail}`} className="block hover:underline">{n.ownerEmail}</a>}
                        {n.ownerPhone && <a href={`tel:${n.ownerPhone}`} className="block hover:underline">{n.ownerPhone}</a>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
