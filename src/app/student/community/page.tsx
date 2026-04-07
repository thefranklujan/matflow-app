export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { fetchCommunityData } from "@/lib/community";
import CommunityClient from "@/components/community/CommunityClient";

export default async function StudentCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");
  const params = await searchParams;
  const data = await fetchCommunityData(session.studentId, params.group ?? null);
  return <CommunityClient {...data} />;
}
