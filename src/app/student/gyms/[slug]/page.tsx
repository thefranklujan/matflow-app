export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/local-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RequestJoinForm from "./RequestJoinForm";

export default async function GymProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const gym = await prisma.gym.findUnique({
    where: { slug },
    include: {
      members: { take: 1, orderBy: { createdAt: "asc" }, select: { firstName: true, lastName: true } },
      classSchedules: { where: { active: true }, orderBy: { startTime: "asc" } },
      _count: { select: { members: true } },
    },
  });

  if (!gym) notFound();

  const existingRequest = await prisma.joinRequest.findFirst({
    where: { studentId: session.studentId, gymId: gym.id },
  });
  const existingMembership = await prisma.member.findFirst({
    where: { studentId: session.studentId, gymId: gym.id },
  });

  return (
    <div className="max-w-3xl">
      <Link href="/student/gyms" className="text-gray-500 text-sm hover:text-white mb-4 inline-block">&larr; Back to Gyms</Link>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 mb-6">
        <div className="flex items-start gap-5 mb-6">
          <div className="h-16 w-16 rounded-xl bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] text-xl font-bold flex-shrink-0">
            {gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{gym.name}</h1>
            {(gym.city || gym.state) && (
              <p className="text-gray-400 text-sm">{gym.city}{gym.city && gym.state ? ", " : ""}{gym.state}</p>
            )}
            <p className="text-gray-600 text-xs mt-1">{gym._count.members} member{gym._count.members !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {gym.description && <p className="text-gray-300 mb-6">{gym.description}</p>}

        {gym.website && (
          <p className="text-sm mb-2">
            <span className="text-gray-500">Website: </span>
            <a href={gym.website} target="_blank" className="text-[#dc2626] hover:underline">{gym.website}</a>
          </p>
        )}
        {gym.phone && (
          <p className="text-sm mb-4">
            <span className="text-gray-500">Phone: </span>
            <span className="text-gray-300">{gym.phone}</span>
          </p>
        )}

        {existingMembership ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
            <p className="text-green-400 font-medium">You are a member of {gym.name}</p>
            <form action={`/api/student/switch-gym/${gym.id}`} method="POST" className="mt-3">
              <button type="submit" className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-6 py-2 rounded-lg">
                Open Gym
              </button>
            </form>
          </div>
        ) : existingRequest ? (
          <div className={`border rounded-lg p-4 text-center ${
            existingRequest.status === "pending" ? "bg-yellow-500/10 border-yellow-500/30" :
            existingRequest.status === "approved" ? "bg-green-500/10 border-green-500/30" :
            "bg-red-500/10 border-red-500/30"
          }`}>
            <p className={`font-medium ${
              existingRequest.status === "pending" ? "text-yellow-400" :
              existingRequest.status === "approved" ? "text-green-400" :
              "text-red-400"
            }`}>
              {existingRequest.status === "pending" && "Your request is awaiting approval"}
              {existingRequest.status === "approved" && "Your request was approved"}
              {existingRequest.status === "rejected" && "Your request was not approved"}
            </p>
          </div>
        ) : (
          <RequestJoinForm gymId={gym.id} gymName={gym.name} />
        )}
      </div>

      {gym.classSchedules.length > 0 && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Class Schedule</h2>
          <div className="space-y-2">
            {gym.classSchedules.slice(0, 8).map((cls) => {
              const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              return (
                <div key={cls.id} className="flex items-center justify-between text-sm">
                  <span className="text-white">{days[cls.dayOfWeek]} . {cls.classType}</span>
                  <span className="text-gray-500">{cls.startTime} to {cls.endTime}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
