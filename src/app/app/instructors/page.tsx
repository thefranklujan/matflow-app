import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import InstructorsClient from "./InstructorsClient";

export const dynamic = "force-dynamic";

export default async function InstructorsPage() {
  const { gymId } = await requireAdmin();
  const instructors = await prisma.instructor.findMany({
    where: { gymId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const initial = instructors.map((i) => ({
    id: i.id,
    name: i.name,
    beltRank: i.beltRank,
    bio: i.bio,
    active: i.active,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Instructors</h1>
      <p className="text-sm text-gray-400 mb-8">
        Add the professors and coaches who teach at your gym. They become selectable
        when you build your class schedule and events.
      </p>
      <InstructorsClient initial={initial} />
    </div>
  );
}
