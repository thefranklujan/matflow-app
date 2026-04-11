import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Mail, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      events: {
        select: { event: true, email: true },
      },
    },
  });

  const campaignsWithStats = campaigns.map((c) => {
    const opened = new Set(c.events.filter(e => e.event === "open").map(e => e.email)).size;
    const clicked = new Set(c.events.filter(e => e.event === "click").map(e => e.email)).size;
    return { ...c, opened, clicked };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Email Campaigns</h1>
          <p className="text-gray-500 mt-1">Send custom emails to students or gym admins.</p>
        </div>
        <Link
          href="/platform/campaigns/new"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-[#111] border border-white/10 rounded-xl p-12 text-center">
          <Mail className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No campaigns yet</p>
          <p className="text-gray-500 text-sm mb-4">Tell Claude what you want to send and it will draft the HTML for you.</p>
          <Link href="/platform/campaigns/new" className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            Create First Campaign
          </Link>
        </div>
      ) : (
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Subject</th>
                <th className="text-left px-4 py-3 font-semibold">Audience</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Sent</th>
                <th className="text-left px-4 py-3 font-semibold">Opened</th>
                <th className="text-left px-4 py-3 font-semibold">Clicked</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaignsWithStats.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3">
                    <Link href={`/platform/campaigns/${c.id}`} className="text-white font-medium hover:text-orange-400">{c.subject}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{c.audience.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${c.status === "sent" ? "bg-green-500/15 text-green-400" : "bg-white/5 text-gray-400"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{c.sentCount}</td>
                  <td className="px-4 py-3">
                    <span className={c.opened > 0 ? "text-emerald-400" : "text-gray-600"}>{c.opened}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.clicked > 0 ? "text-purple-400" : "text-gray-600"}>{c.clicked}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(c.sentAt || c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
