import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

import DeleteEventButton from "./DeleteEventButton";

export const dynamic = "force-dynamic";

const eventTypeColors: Record<string, string> = {
  seminar: "bg-purple-500/20 text-purple-400",
  "open-mat": "bg-blue-500/20 text-blue-400",
  promotion: "bg-yellow-500/20 text-yellow-400",
  closure: "bg-red-500/20 text-red-400",
  social: "bg-green-500/20 text-green-400",
  other: "bg-gray-500/20 text-gray-400",
};

const locationColors: Record<string, string> = {
  magnolia: "bg-brand-accent/20 text-brand-accent",
  cypress: "bg-orange-500/20 text-orange-400",
};

export default async function AdminEventsPage() {
  const { gymId } = await requireAdmin();
  const events = await prisma.event.findMany({
    where: { gymId },
    orderBy: { date: "desc" },
  });

  return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <Link
            href="/admin/events/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            + New Event
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-brand-gray text-gray-400 text-xs uppercase tracking-wider">
                <th className="pb-3 pr-4">Title</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Location</th>
                <th className="pb-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-brand-gray/30 transition">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="text-white hover:text-brand-accent transition font-medium"
                    >
                      {event.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">
                    {new Date(event.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        eventTypeColors[event.eventType] || eventTypeColors.other
                      }`}
                    >
                      {event.eventType}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        locationColors[event.locationSlug] || "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {event.locationSlug}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="text-sm text-gray-400 hover:text-white transition"
                    >
                      Edit
                    </Link>
                    <DeleteEventButton eventId={event.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No events yet. Click &quot;New Event&quot; to get started.
            </div>
          )}
        </div>
      </div>
  );
}
