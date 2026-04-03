export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const { gymId } = await requireAdmin();

  const leads = await prisma.lead.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  });

  return <LeadsClient leads={JSON.parse(JSON.stringify(leads))} />;
}
