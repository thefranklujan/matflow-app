import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CampaignDetailClient from "./CampaignDetailClient";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  return (
    <CampaignDetailClient
      campaign={{
        id: campaign.id,
        subject: campaign.subject,
        html: campaign.html,
        audience: campaign.audience,
        status: campaign.status,
        sentCount: campaign.sentCount,
        sentAt: campaign.sentAt ? campaign.sentAt.toISOString() : null,
        createdAt: campaign.createdAt.toISOString(),
      }}
    />
  );
}
