import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MATFLOW } from "@/lib/constants";
import DropInForm from "./DropInForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function DropInPage({ params }: Props) {
  const { slug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!gym) notFound();

  const waiver = await prisma.waiverTemplate.findFirst({
    where: { gymId: gym.id, active: true },
    select: { id: true, title: true, content: true, version: true },
  });

  return (
    <div className="min-h-screen bg-brand-black px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Drop in at {gym.name}</h1>
          <p className="text-gray-400 text-sm">
            Quick check-in for visitors. Fill this out{waiver ? " and sign the waiver" : ""} before class.
          </p>
        </div>

        <DropInForm gymSlug={gym.slug} waiver={waiver} />

        <p className="text-gray-600 text-sm mt-8 text-center">Powered by {MATFLOW.name}</p>
      </div>
    </div>
  );
}
