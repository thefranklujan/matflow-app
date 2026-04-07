import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

import { CLASS_TYPES } from "@/lib/constants";
import DeleteVideoButton from "./DeleteVideoButton";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const { gymId } = await requireAdmin();
  const videos = await prisma.video.findMany({
    where: { gymId },
    orderBy: { classDate: "desc" },
  });

  function classLabel(value: string) {
    return CLASS_TYPES.find((c) => c.value === value)?.label ?? value;
  }

  return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Videos</h1>
          <Link
            href="/app/videos/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            + Add Video
          </Link>
        </div>

        <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-gray">
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Title</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Class Type</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Published</th>
                <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                  <td className="px-4 py-3 text-sm text-white font-medium">{video.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{classLabel(video.classType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(video.classDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${video.published ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                      {video.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/videos/${video.id}/edit`}
                        className="text-sm text-gray-400 hover:text-brand-accent transition"
                      >
                        Edit
                      </Link>
                      <DeleteVideoButton videoId={video.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {videos.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No videos yet. Click &quot;Add Video&quot; to get started.
            </div>
          )}
        </div>
      </div>
  );
}
