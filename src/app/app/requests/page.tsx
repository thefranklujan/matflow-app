export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RequestsClient from "./RequestsClient";

export default async function AdminRequestsPage() {
  const { gymId } = await requireAdmin();

  const requests = await prisma.joinRequest.findMany({
    where: { gymId },
    include: {
      student: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <RequestsClient requests={JSON.parse(JSON.stringify(requests))} />;
}
