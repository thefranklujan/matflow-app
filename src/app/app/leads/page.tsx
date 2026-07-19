export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { getGymEntitlement } from "@/lib/owner-access";
import { planSatisfies } from "@/lib/entitlements";
import { UpgradeRequired } from "@/components/UpgradeRequired";
import { prisma } from "@/lib/prisma";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const { gymId } = await requireAdmin();

  // Pro-only page: server pages query the DB directly, so the plan gate
  // lives here too (the API guards cover the mutation routes).
  const entitlement = await getGymEntitlement(gymId);
  if (!planSatisfies(entitlement, "pro")) return <UpgradeRequired feature="Lead pipeline" />;

  const leads = await prisma.lead.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  });

  return <LeadsClient leads={JSON.parse(JSON.stringify(leads))} />;
}
