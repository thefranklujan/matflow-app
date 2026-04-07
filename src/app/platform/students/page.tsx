export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import StudentsClient from "./StudentsClient";

export default async function StudentsPage() {
  const students = await prisma.student.findMany({
    include: {
      memberships: { include: { gym: { select: { id: true, name: true } } } },
      joinRequests: { include: { gym: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = students.map((s) => {
    const approvedGyms = s.memberships.map((m) => m.gym?.name).filter(Boolean) as string[];
    const pendingCount = s.joinRequests.filter((r) => r.status === "pending").length;
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone || "",
      createdAt: s.createdAt.toISOString(),
      gyms: approvedGyms,
      gymCount: approvedGyms.length,
      pendingCount,
      status: approvedGyms.length > 0 ? "active" : pendingCount > 0 ? "pending" : "unaffiliated",
    };
  });

  return <StudentsClient rows={rows} />;
}
