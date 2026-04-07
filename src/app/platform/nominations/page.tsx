export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function NominationsPage() {
  const nominations = await prisma.gymNomination.findMany({
    orderBy: { createdAt: "desc" },
    include: { student: { select: { firstName: true, lastName: true, email: true } } },
  });

  // Group by gym name
  const grouped = new Map<string, typeof nominations>();
  for (const n of nominations) {
    const key = n.gymName.trim().toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
  }

  const sortedGroups = Array.from(grouped.entries())
    .map(([, list]) => list)
    .sort((a, b) => b.length - a.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Gym Nominations</h1>
        <span className="text-gray-500 text-sm">{nominations.length} total</span>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center text-gray-500">
          No gym nominations yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group) => {
            const first = group[0];
            const count = group.length;
            return (
              <div key={first.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-white text-lg font-bold">{first.gymName}</h2>
                      {count >= 3 && (
                        <span className="bg-orange-500/20 text-orange-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded">
                          🔥 Hot · {count} students
                        </span>
                      )}
                      {count < 3 && (
                        <span className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded">
                          {count} student{count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {(first.city || first.state) && (
                      <p className="text-gray-500 text-xs mt-1">{[first.city, first.state].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {group.map((n) => (
                    <div key={n.id} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">
                          {n.student.firstName} {n.student.lastName}
                        </p>
                        <p className="text-gray-500 text-xs">{n.student.email}</p>
                        {n.notes && <p className="text-gray-400 text-xs mt-1 italic">"{n.notes}"</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {n.ownerEmail && (
                          <a href={`mailto:${n.ownerEmail}`} className="block text-orange-400 text-xs hover:underline">{n.ownerEmail}</a>
                        )}
                        {n.ownerPhone && (
                          <a href={`tel:${n.ownerPhone}`} className="block text-gray-400 text-xs hover:underline">{n.ownerPhone}</a>
                        )}
                        <p className="text-gray-600 text-[10px] mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
