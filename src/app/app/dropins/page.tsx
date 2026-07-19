import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getGymEntitlement } from "@/lib/owner-access";
import { planSatisfies } from "@/lib/entitlements";
import { UpgradeRequired } from "@/components/UpgradeRequired";
import DropInsClient from "./DropInsClient";

export const dynamic = "force-dynamic";

export default async function DropInsPage() {
  const { gymId } = await requireAdmin();

  // Pro-only page: server pages query the DB directly, so the plan gate
  // lives here too (the API guards cover the mutation routes).
  const entitlement = await getGymEntitlement(gymId);
  if (!planSatisfies(entitlement, "pro")) return <UpgradeRequired feature="Drop-ins" />;
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { slug: true } });

  const dropIns = await prisma.dropIn.findMany({
    where: { gymId },
    orderBy: { visitDate: "desc" },
    include: {
      signatures: { select: { id: true } },
      instructorRef: { select: { name: true } },
    },
  });

  const initial = dropIns.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone,
    emergencyName: d.emergencyName,
    emergencyPhone: d.emergencyPhone,
    classType: d.classType,
    instructorName: d.instructorRef?.name ?? null,
    visitDate: d.visitDate.toISOString(),
    waiverSigned: d.signatures.length > 0,
    converted: !!d.convertedMemberId,
  }));

  return <DropInsClient initial={initial} gymSlug={gym?.slug ?? null} />;
}
