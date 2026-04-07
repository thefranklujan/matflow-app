import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

import { BELT_RANKS } from "@/lib/constants";

// TODO: Locations will come from the Gym model
const LOCATIONS: { value: string; label: string }[] = [];
import Link from "next/link";
import BeltPromotionForm from "./BeltPromotionForm";
import AmbassadorToggle from "./AmbassadorToggle";
import MiniBelt from "@/components/members/MiniBelt";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      beltHistory: { orderBy: { awardedAt: "desc" } },
    },
  });

  if (!member) notFound();

  const attendanceCount = await prisma.attendance.count({
    where: { memberId: id },
  });

  const beltLabel =
    BELT_RANKS.find((b) => b.value === member.beltRank)?.label ?? member.beltRank;
  const locationLabel =
    LOCATIONS.find((l) => l.value === member.locationSlug)?.label ?? member.locationSlug ?? "-";

  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/app/members"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Members
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Member Info */}
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Member Info</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase">Name</dt>
                <dd className="text-white">{member.firstName} {member.lastName}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Email</dt>
                <dd className="text-gray-300">{member.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Phone</dt>
                <dd className="text-gray-300">{member.phone || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Location</dt>
                <dd className="text-gray-300">{locationLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Current Belt</dt>
                <dd className="text-white font-medium">
                  {beltLabel}
                  <MiniBelt beltRank={member.beltRank} stripes={member.stripes} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Approved</dt>
                <dd>
                  <span className={`text-xs px-2 py-1 rounded-full ${member.approved ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {member.approved ? "Yes" : "No"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Active</dt>
                <dd>
                  <span className={`text-xs px-2 py-1 rounded-full ${member.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {member.active ? "Yes" : "No"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Attendance Count</dt>
                <dd className="text-brand-accent font-bold text-lg">{attendanceCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Joined</dt>
                <dd className="text-gray-300">{new Date(member.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          <AmbassadorToggle memberId={member.id} initial={!!member.isAmbassador} />

          {/* Belt Promotion */}
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Belt Promotion</h2>
            <BeltPromotionForm
              memberId={member.id}
              currentBelt={member.beltRank}
              currentStripes={member.stripes}
            />

            <h3 className="text-sm font-bold text-white mt-6 mb-3">Belt History</h3>
            {member.beltHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No belt history yet.</p>
            ) : (
              <div className="space-y-2">
                {member.beltHistory.map((bp) => {
                  const label = BELT_RANKS.find((b) => b.value === bp.beltRank)?.label ?? bp.beltRank;
                  return (
                    <div key={bp.id} className="flex items-center justify-between bg-brand-gray/30 rounded px-3 py-2">
                      <div>
                        <span className="text-white text-sm font-medium">{label}</span>
                        <MiniBelt beltRank={bp.beltRank} stripes={bp.stripes} />
                        {bp.note && <p className="text-gray-400 text-xs mt-0.5">{bp.note}</p>}
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(bp.awardedAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
