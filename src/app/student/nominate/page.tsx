export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import NominateForm from "./NominateForm";

export default async function NominatePage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const [mine, existingGroups] = await Promise.all([
    prisma.gymNomination.findMany({
      where: { studentId: session.studentId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gymGroup.findMany({
      orderBy: [{ memberCount: "desc" }, { name: "asc" }],
      take: 100,
      select: { id: true, name: true, city: true, state: true, memberCount: true },
    }),
  ]);

  return (
    <div>
      <Link
        href="/student"
        className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4 -ml-1"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-3xl font-bold text-white mb-2">Nominate Your Gym</h1>
      <p className="text-gray-500 mb-6 text-sm max-w-xl">
        Want your gym on MatFlow? Drop your academy here and we&apos;ll reach out. When enough students from
        the same gym nominate, we&apos;ll activate it free for the owner.
      </p>

      <NominateForm existingGroups={existingGroups} />

      {mine.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Your Nominations</h2>
          <div className="space-y-2">
            {mine.map((n) => (
              <div key={n.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
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
