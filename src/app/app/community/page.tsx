export const dynamic = "force-dynamic";

import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { fetchCommunityData } from "@/lib/community";
import CommunityClient from "@/components/community/CommunityClient";

export default async function MemberCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { memberId } = await requireMember();
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { studentId: true },
  });
  if (!member?.studentId) redirect("/app/nominate");
  const params = await searchParams;
  const data = await fetchCommunityData(member.studentId, params.group ?? null);
  return <CommunityClient {...data} />;
}
