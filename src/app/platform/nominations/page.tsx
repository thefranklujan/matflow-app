export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import NominationsClient from "./NominationsClient";

export default async function NominationsPage() {
  const [nominations, activeGyms] = await Promise.all([
    prisma.gymNomination.findMany({
      orderBy: { createdAt: "desc" },
      include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.gym.findMany({
      where: {
        id: { notIn: ["platform-owner-gym", "platform-admin-gym"] },
        subscriptionStatus: { not: "cancelled" },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, state: true },
    }),
  ]);

  const rows = nominations.map((n) => ({
    id: n.id,
    gymName: n.gymName,
    city: n.city,
    state: n.state,
    ownerEmail: n.ownerEmail,
    ownerPhone: n.ownerPhone,
    notes: n.notes,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    student: {
      id: n.student.id,
      firstName: n.student.firstName,
      lastName: n.student.lastName,
      email: n.student.email,
    },
  }));

  return <NominationsClient rows={rows} activeGyms={activeGyms} />;
}
