import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLASS_TYPES } from "@/lib/constants";
import AdminAttendanceClient from "./AdminAttendanceClient";

export const dynamic = "force-dynamic";

function classLabel(value: string) {
  return CLASS_TYPES.find((c) => c.value === value)?.label ?? value;
}

export default async function AttendancePage() {
  const { gymId, memberId, orgRole } = await requireMember();
  const isAdmin = orgRole === "org:admin";

  if (isAdmin) {
    return <AdminAttendanceClient />;
  }

  const records = await prisma.attendance.findMany({
    where: { gymId, memberId },
    orderBy: { classDate: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Attendance</h1>
        <span className="text-gray-500 text-sm">{records.length} classes</span>
      </div>

      {records.length === 0 ? (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-10 text-center">
          <p className="text-white font-semibold mb-1">No classes attended yet</p>
          <p className="text-gray-500 text-sm">Your check-ins will show up here.</p>
        </div>
      ) : (
        <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-gray text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Day</th>
                <th className="text-left px-4 py-3">Class</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const d = new Date(r.classDate);
                return (
                  <tr key={r.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {d.toLocaleDateString("en-US", { weekday: "long" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{classLabel(r.classType)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
