import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

import DeleteAnnouncementButton from "./DeleteAnnouncementButton";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const { gymId } = await requireAdmin();
  const announcements = await prisma.announcement.findMany({
    where: { gymId },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
  });

  return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <Link
            href="/admin/announcements/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            + New Announcement
          </Link>
        </div>

        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="bg-brand-dark border border-brand-gray rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium text-sm truncate">{a.title}</h3>
                  {a.pinned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent flex-shrink-0">
                      Pinned
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs line-clamp-2">{a.content}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(a.publishedAt).toLocaleDateString()}
                </p>
              </div>
              <DeleteAnnouncementButton announcementId={a.id} />
            </div>
          ))}
          {announcements.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No announcements yet. Click &quot;New Announcement&quot; to get started.
            </div>
          )}
        </div>
      </div>
  );
}
