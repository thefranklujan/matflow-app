import { prisma } from "@/lib/prisma";

import Link from "next/link";
import Image from "next/image";

function getYouTubeThumbnail(embedUrl: string): string | null {
  const match = embedUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export const dynamic = "force-dynamic";

const CLASS_TYPES = [
  "All",
  "Fundamentals",
  "Advanced",
  "No-Gi",
  "Competition",
  "Kids",
  "Open Mat",
];

export default async function MemberVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ classType?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = params.classType || "";

  const where: Record<string, unknown> = { published: true };
  if (activeFilter) {
    where.classType = activeFilter;
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { classDate: "desc" },
  });

  return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-6">
          Class Videos
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CLASS_TYPES.map((type) => {
            const value = type === "All" ? "" : type;
            const isActive = activeFilter === value;
            return (
              <Link
                key={type}
                href={
                  value
                    ? `/members/videos?classType=${encodeURIComponent(value)}`
                    : "/members/videos"
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-teal text-brand-black"
                    : "bg-brand-dark border border-brand-gray text-gray-300 hover:border-brand-teal hover:text-white"
                }`}
              >
                {type}
              </Link>
            );
          })}
        </div>

        {/* Video Grid */}
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/members/videos/${video.id}`}
                className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden hover:border-brand-teal transition group"
              >
                {/* YouTube Thumbnail */}
                <div className="aspect-video bg-brand-gray/50 relative overflow-hidden">
                  {getYouTubeThumbnail(video.embedUrl) ? (
                    <Image
                      src={getYouTubeThumbnail(video.embedUrl)!}
                      alt={video.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition">
                    <div className="w-14 h-14 rounded-full bg-brand-teal/80 flex items-center justify-center group-hover:bg-brand-teal transition group-hover:scale-110">
                      <svg
                        className="w-7 h-7 text-white ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-brand-teal/20 text-brand-teal px-2 py-0.5 rounded-full">
                      {video.classType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(video.classDate).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-white font-medium text-sm line-clamp-2">
                    {video.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-12 text-center">
            <p className="text-gray-500">No videos found.</p>
          </div>
        )}
      </div>
  );
}
