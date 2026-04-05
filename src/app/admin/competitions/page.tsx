import { prisma } from "@/lib/prisma";
import Link from "next/link";

import DeleteCompetitionButton from "./DeleteCompetitionButton";

export const dynamic = "force-dynamic";

const placementColors: Record<string, string> = {
  gold: "bg-yellow-500/20 text-yellow-400",
  silver: "bg-gray-400/20 text-gray-300",
  bronze: "bg-orange-500/20 text-orange-400",
  participant: "bg-blue-500/20 text-blue-400",
};

export default async function AdminCompetitionsPage() {
  const results = await prisma.competitionResult.findMany({
    include: { member: true },
    orderBy: { date: "desc" },
  });

  return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Competitions</h1>
          <Link
            href="/admin/competitions/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            + Record Result
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-brand-gray text-gray-400 text-xs uppercase tracking-wider">
                <th className="pb-3 pr-4">Member</th>
                <th className="pb-3 pr-4">Competition</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Placement</th>
                <th className="pb-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray">
              {results.map((result) => (
                <tr key={result.id} className="hover:bg-brand-gray/30 transition">
                  <td className="py-3 pr-4 text-white font-medium">
                    {result.member.firstName} {result.member.lastName}
                  </td>
                  <td className="py-3 pr-4 text-gray-300">
                    {result.competitionName}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">
                    {new Date(result.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        placementColors[result.placement] || "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {result.placement}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <DeleteCompetitionButton competitionId={result.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No competition results yet. Click &quot;Record Result&quot; to get started.
            </div>
          )}
        </div>
      </div>
  );
}
