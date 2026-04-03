export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WaiversClient from "./WaiversClient";

export default async function WaiversPage() {
  const { gymId } = await requireAdmin();

  const templates = await prisma.waiverTemplate.findMany({
    where: { gymId },
    include: {
      signatures: {
        include: { member: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { signedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalMembers = await prisma.member.count({ where: { gymId, active: true } });

  return (
    <WaiversClient
      templates={JSON.parse(JSON.stringify(templates))}
      totalMembers={totalMembers}
    />
  );
}
