import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth";
import Link from "next/link";
import { Play } from "lucide-react";

import { CLASS_TYPES } from "@/lib/constants";
import DeleteVideoButton from "./DeleteVideoButton";

export const dynamic = "force-dynamic";

function classLabel(value: string) {
  return CLASS_TYPES.find((c) => c.value === value)?.label ?? value;
}

// Try to extract a YouTube video id from common embed/watch URLs
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function thumbnailFor(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export default async function VideosPage() {
  const { gymId, orgRole } = await requireMember();
  const isAdmin = orgRole === "org:admin";
  const videos = await prisma.video.findMany({
    where: { gymId, ...(isAdmin ? {} : { published: true }) },
    orderBy: { classDate: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Videos</h1>
        {isAdmin && (
          <Link
            href="/app/videos/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            + Add Video
          </Link>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-12 text-center text-gray-500">
          No videos yet.{isAdmin ? " Click \"Add Video\" to get started." : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => {
            const thumb = thumbnailFor(video.embedUrl);
            return (
              <div key={video.id} className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden group">
                <a
                  href={video.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative aspect-video bg-black"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={video.title}
                      className="w-full h-full object-cover transition group-hover:opacity-90"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-gray to-black">
                      <Play className="h-10 w-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
                    <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                      <Play className="h-6 w-6 text-black ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  {!video.published && (
                    <span className="absolute top-2 left-2 bg-gray-700 text-white text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                      Draft
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                    {classLabel(video.classType)}
                  </span>
                </a>
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{video.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-gray-600 text-xs">
                      {new Date(video.classDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/app/videos/${video.id}/edit`}
                          className="text-xs text-gray-400 hover:text-brand-accent transition"
                        >
                          Edit
                        </Link>
                        <DeleteVideoButton videoId={video.id} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
