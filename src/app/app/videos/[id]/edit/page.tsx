import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

import Link from "next/link";
import VideoForm from "../../VideoForm";

export const dynamic = "force-dynamic";

export default async function AdminEditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) notFound();

  const serialized = {
    id: video.id,
    title: video.title,
    embedUrl: video.embedUrl,
    description: video.description,
    classType: video.classType,
    classDate: video.classDate.toISOString(),
    published: video.published,
  };

  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/app/videos"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Videos
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6">Edit Video</h1>
        <VideoForm video={serialized} />
      </div>
  );
}
