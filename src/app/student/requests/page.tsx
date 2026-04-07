export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StudentRequestsPage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const requests = await prisma.joinRequest.findMany({
    where: { studentId: session.studentId },
    include: { gym: { select: { name: true, slug: true, city: true, state: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">My Requests</h1>
      <p className="text-gray-500 mb-8">All your join requests and their status.</p>

      {requests.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center">
          <p className="text-gray-500 mb-4">You have not requested to join any gyms yet.</p>
          <Link href="/student/gyms" className="text-[#dc2626] hover:underline">Find a gym &rarr;</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 flex items-center justify-between">
              <div>
                <Link href={`/student/gyms/${r.gym.slug}`} className="text-white font-semibold hover:underline">{r.gym.name}</Link>
                {(r.gym.city || r.gym.state) && (
                  <p className="text-gray-500 text-xs">{r.gym.city}{r.gym.city && r.gym.state ? ", " : ""}{r.gym.state}</p>
                )}
                <p className="text-gray-600 text-xs mt-1">Requested {new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded ${
                r.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                r.status === "approved" ? "bg-green-500/20 text-green-400" :
                "bg-red-500/20 text-red-400"
              }`}>
                {r.status === "pending" ? "Pending" : r.status === "approved" ? "Approved" : "Rejected"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
