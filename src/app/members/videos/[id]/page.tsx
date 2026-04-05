import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

import VideoPlayer from "@/components/members/VideoPlayer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MemberVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id, published: true },
  });

  if (!video) {
    notFound();
  }

  return (
      <div className="max-w-4xl mx-auto">
        <Link
          href="/members/videos"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-brand-accent transition mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Videos
        </Link>

        <VideoPlayer embedUrl={video.embedUrl} />

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs bg-brand-accent/20 text-brand-accent px-3 py-1 rounded-full font-medium">
              {video.classType}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(video.classDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            {video.title}
          </h1>

          {video.description && (
            <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
              <p className="text-gray-300 whitespace-pre-wrap">
                {video.description}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}
