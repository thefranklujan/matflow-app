import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MemberShell from "@/components/members/MemberShell";
import BeltDisplay from "@/components/members/BeltDisplay";
import TechniqueCurriculum from "./TechniqueCurriculum";
import { getTechniquesUpTo, CURRICULUM } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export default async function MemberProgressPage() {
  const session = await getServerSession(authOptions);
  const memberId = session?.user?.memberId;

  const [member, beltHistory, techniqueProgress] = await Promise.all([
    memberId
      ? prisma.member.findUnique({
          where: { id: memberId },
          select: { beltRank: true, stripes: true, firstName: true },
        })
      : null,
    memberId
      ? prisma.beltProgress.findMany({
          where: { memberId },
          orderBy: { awardedAt: "desc" },
        })
      : [],
    memberId
      ? prisma.techniqueProgress.findMany({
          where: { memberId },
          select: { techniqueId: true, completedAt: true, verifiedBy: true },
        })
      : [],
  ]);

  const beltRank = member?.beltRank || "white";
  const stripes = member?.stripes || 0;

  // Calculate overall progress
  const allTechniquesUpTo = getTechniquesUpTo(beltRank, stripes);
  const completedIds = new Set(techniqueProgress.map((t) => t.techniqueId));
  const completedUpTo = allTechniquesUpTo.filter((t) => completedIds.has(t.id)).length;
  const totalUpTo = allTechniquesUpTo.length;
  const totalAll = CURRICULUM.reduce((s, b) => s + b.techniques.length, 0);

  const BELT_TIMELINE_COLORS: Record<string, string> = {
    white: "bg-white border border-gray-400",
    blue: "bg-blue-600",
    purple: "bg-purple-600",
    brown: "bg-amber-800",
    black: "bg-gray-800 border border-gray-500",
  };

  return (
    <MemberShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-6">
          Progress
        </h1>

        {/* ── Current Rank Summary ───────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 flex flex-col items-center justify-center">
            <BeltDisplay beltRank={beltRank} stripes={stripes} size="lg" />
            <p className="mt-3 text-gray-400 text-sm">Current Rank</p>
          </div>

          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-brand-teal">{techniqueProgress.length}</p>
            <p className="text-gray-400 text-sm mt-1">Techniques Learned</p>
            <p className="text-[10px] text-gray-500 mt-0.5">of {totalAll} total</p>
          </div>

          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-brand-teal">
              {totalUpTo > 0 ? Math.round((completedUpTo / totalUpTo) * 100) : 0}%
            </p>
            <p className="text-gray-400 text-sm mt-1">Current Level Mastery</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {completedUpTo}/{totalUpTo} through {beltRank} stripe {stripes}
            </p>
          </div>
        </div>

        {/* ── Technique Curriculum ───────────────────────── */}
        <TechniqueCurriculum
          completedTechniques={JSON.parse(JSON.stringify(techniqueProgress))}
          currentBelt={beltRank}
          currentStripes={stripes}
        />

        {/* ── Belt Promotion History ────────────────────── */}
        {beltHistory.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-4">
              Promotion History
            </h3>
            <div className="relative pl-8">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-brand-gray" />
              <div className="space-y-6">
                {beltHistory.map((entry) => (
                  <div key={entry.id} className="relative">
                    <div
                      className={`absolute -left-5 top-1 w-4 h-4 rounded-full ${
                        BELT_TIMELINE_COLORS[entry.beltRank] || "bg-white"
                      }`}
                    >
                      {entry.stripes > 0 && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-px">
                          {Array.from({ length: entry.stripes }).map((_, i) => (
                            <span key={i} className="w-0.5 h-2 rounded-sm bg-black" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {entry.beltRank.charAt(0).toUpperCase() + entry.beltRank.slice(1)} Belt
                        {entry.stripes > 0 ? ` — ${entry.stripes} Stripe${entry.stripes > 1 ? "s" : ""}` : ""}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {new Date(entry.awardedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        {entry.awardedBy && ` · ${entry.awardedBy}`}
                      </p>
                      {entry.note && (
                        <p className="text-gray-400 text-xs mt-1 italic">&quot;{entry.note}&quot;</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MemberShell>
  );
}
