export const dynamic = "force-dynamic";

import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NominateForm from "../../student/nominate/NominateForm";

export default async function MemberNominatePage() {
  const { memberId } = await requireMember();
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { studentId: true },
  });
  if (!member?.studentId) redirect("/app");

  const mine = await prisma.gymNomination.findMany({
    where: { studentId: member.studentId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Nominate Your Gym</h1>
      <p className="text-gray-500 mb-6 text-sm max-w-xl">
        Know another gym that should be on MatFlow? Drop the academy here. When enough students from
        the same gym nominate, we&apos;ll reach out and activate it free for the owner.
      </p>

      <NominateForm />

      {mine.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Your Nominations</h2>
          <div className="space-y-2">
            {mine.map((n) => (
              <div key={n.id} className="bg-brand-dark border border-brand-gray rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{n.gymName}</p>
                  {(n.city || n.state) && (
                    <p className="text-gray-500 text-xs">{[n.city, n.state].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded ${
                  n.status === "converted" ? "bg-green-500/20 text-green-400"
                  : n.status === "contacted" ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-white/5 text-gray-400"
                }`}>
                  {n.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
