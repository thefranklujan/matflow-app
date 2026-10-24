export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WaiversClient from "./WaiversClient";
import { countCurrentSignatures } from "@/lib/waiver";

export default async function WaiversPage() {
  const { gymId } = await requireAdmin();

  const templates = await prisma.waiverTemplate.findMany({
    where: { gymId },
    include: {
      signatures: {
        include: {
          member: { select: { firstName: true, lastName: true, email: true } },
          dropIn: { select: { firstName: true, lastName: true } },
        },
        orderBy: { signedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Counts follow the current-version contract (src/lib/waiver.ts): only a
  // signature of the active template's CURRENT version counts as signed, and
  // only active, approved members are expected to sign.
  const activeMembers = await prisma.member.findMany({
    where: { gymId, active: true, approved: true },
    select: { id: true },
  });
  const activeMemberIds = new Set(activeMembers.map((m) => m.id));
  const active = templates.find((t) => t.active);
  const counts = active ? countCurrentSignatures(active, activeMemberIds) : null;

  return (
    <WaiversClient
      templates={JSON.parse(JSON.stringify(templates))}
      totalMembers={activeMemberIds.size}
      counts={counts}
    />
  );
}
