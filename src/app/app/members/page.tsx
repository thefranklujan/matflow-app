import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

import { BELT_RANKS } from "@/lib/constants";

// TODO: Locations will come from the Gym model
const LOCATIONS: { value: string; label: string }[] = [];
import MemberActions from "./MemberActions";
import MiniBelt from "@/components/members/MiniBelt";

export const dynamic = "force-dynamic";

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",").map(e => e.trim().toLowerCase());

export default async function AdminMembersPage() {
  const { gymId } = await requireAdmin();
  const allMembers = await prisma.member.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  });
  const members = allMembers.filter((m) => !PLATFORM_ADMIN_EMAILS.includes(m.email.trim().toLowerCase()));

  function beltLabel(value: string) {
    return BELT_RANKS.find((b) => b.value === value)?.label ?? value;
  }

  function locationLabel(slug: string | null) {
    if (!slug) return "-";
    return LOCATIONS.find((l) => l.value === slug)?.label ?? slug;
  }

  return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-8">Members</h1>

        <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-gray">
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Belt</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Location</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Approved</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Active</th>
                <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{member.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {beltLabel(member.beltRank)}
                    <MiniBelt beltRank={member.beltRank} stripes={member.stripes} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{locationLabel(member.locationSlug)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${member.approved ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {member.approved ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${member.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {member.active ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/app/members/${member.id}`}
                        className="text-sm text-gray-400 hover:text-brand-accent transition"
                      >
                        View
                      </Link>
                      <MemberActions
                        memberId={member.id}
                        approved={member.approved}
                        active={member.active}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="text-center py-8 text-gray-500">No members yet.</div>
          )}
        </div>
      </div>
  );
}
