"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  QUEUE_UNAVAILABLE,
  filterSalesQueue,
  sortSalesQueue,
  type QueueFilters,
  type SalesPriority,
  type SalesQueueRow,
  type SortKey,
} from "@/lib/sales-queue";

const PRIORITY_TONE: Record<SalesPriority, string> = {
  billing_issue: "bg-red-500/15 text-red-400",
  trial_expired: "bg-red-500/15 text-red-300",
  subscription_canceled: "bg-gray-500/20 text-gray-300",
  trial_ending_now: "bg-orange-500/15 text-orange-300",
  trial_ending_soon: "bg-yellow-500/15 text-yellow-300",
  stuck_unactivated: "bg-blue-500/15 text-blue-300",
  activated_no_usage: "bg-purple-500/15 text-purple-300",
  paid_active: "bg-green-500/15 text-green-400",
  none: "bg-white/5 text-gray-400",
};

function planLabel(row: SalesQueueRow): string {
  if (row.needsPriceReconciliation) return "Unrecognised price";
  if (row.plan === "basic") return "Basic $49";
  if (row.plan === "pro") return "Pro $99";
  if (row.subscriptionStatus === "trialing") return "Trial";
  return "No plan";
}

function trialLabel(row: SalesQueueRow): string {
  if (row.trialDaysRemaining === null) return "-";
  if (row.trialDaysRemaining < 0) return "Ended";
  if (row.trialDaysRemaining === 0) return "Ends today";
  return `${row.trialDaysRemaining}d left`;
}

export default function SalesQueueClient({ rows, recentDays }: { rows: SalesQueueRow[]; recentDays: number }) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<SalesPriority | "all">("all");
  const [activation, setActivation] = useState<QueueFilters["activation"]>("all");
  const [billing, setBilling] = useState<QueueFilters["billing"]>("all");
  const [plan, setPlan] = useState<QueueFilters["plan"]>("all");
  const [sort, setSort] = useState<SortKey>("urgency");

  const visible = useMemo(
    () => sortSalesQueue(filterSalesQueue(rows, { search, priority, activation, billing, plan }), sort),
    [rows, search, priority, activation, billing, plan, sort],
  );

  const noAcademies = rows.length === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sales &amp; onboarding queue</h1>
        <p className="text-sm text-gray-400 mt-1">
          Every real academy, ordered by what needs a founder today. Derived from academy records only.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0">
        <div className="lg:col-span-2 min-w-0">
          <label htmlFor="sales-search" className="block text-xs text-gray-400 mb-1">
            Search academy or owner
          </label>
          <input
            id="sales-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Iron Lion, marcus@..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="sales-priority" className="block text-xs text-gray-400 mb-1">Priority</label>
          <select
            id="sales-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SalesPriority | "all")}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="sales-activation" className="block text-xs text-gray-400 mb-1">Activation</label>
          <select
            id="sales-activation"
            value={activation}
            onChange={(e) => setActivation(e.target.value as QueueFilters["activation"])}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All</option>
            <option value="activated">Activated</option>
            <option value="not_activated">Not activated</option>
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="sales-billing" className="block text-xs text-gray-400 mb-1">Billing</label>
          <select
            id="sales-billing"
            value={billing}
            onChange={(e) => setBilling(e.target.value as QueueFilters["billing"])}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="trouble">Needs attention</option>
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="sales-sort" className="block text-xs text-gray-400 mb-1">Sort</label>
          <select
            id="sales-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="urgency">Urgency</option>
            <option value="trialEnd">Trial end</option>
            <option value="created">Newest</option>
            <option value="lastActivity">Last activity</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 min-w-0">
        <label htmlFor="sales-plan" className="text-xs text-gray-400">Plan</label>
        <select
          id="sales-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as QueueFilters["plan"])}
          className="min-w-0 max-w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="all">All plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="unknown">No allow-listed price</option>
        </select>
        <p className="text-xs text-gray-400" data-testid="sales-count">
          {visible.length} of {rows.length} {rows.length === 1 ? "academy" : "academies"}
        </p>
      </div>

      {noAcademies ? (
        <div className="border border-white/10 rounded-lg p-8 text-center">
          <p className="text-white font-semibold">No academies yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Real academies appear here as soon as owners register. Synthetic platform gyms are excluded.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-8 text-center">
          <p className="text-white font-semibold">No academies match these filters</p>
          <button
            onClick={() => {
              setSearch("");
              setPriority("all");
              setActivation("all");
              setBilling("all");
              setPlan("all");
            }}
            className="mt-3 text-sm text-[#ef4444] underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto border border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th scope="col" className="text-left font-medium px-4 py-3">Academy</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Owner</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Priority</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Billing</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Trial</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Setup</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Live</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">M / I / C</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Check-ins ({recentDays}d)</th>
                  <th scope="col" className="text-left font-medium px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.gymId} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/platform/gyms/${row.gymId}`} className="text-white hover:underline font-medium">
                        {row.gymName}
                      </Link>
                      <p className="text-gray-400 text-xs">{row.ageDays}d old</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.owner.known ? (
                        <>
                          <p className="text-white">{row.owner.name ?? "-"}</p>
                          <p className="text-gray-400 text-xs">{row.owner.email ?? "-"}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">
                          {row.owner.resolution === "ambiguous" ? "Unknown (multiple owners marked)" : "Unknown"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${PRIORITY_TONE[row.priority]}`}>
                        {PRIORITY_LABELS[row.priority]}
                      </span>
                      <p className="text-gray-400 text-xs mt-1">{row.recommendedAction}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {row.subscriptionStatus}
                      <p className="text-gray-400 text-xs">{planLabel(row)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{trialLabel(row)}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {row.milestonesComplete}/{row.milestonesTotal}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{row.hasLiveUsage ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {row.activeMembers} / {row.activeInstructors} / {row.activeClasses}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{row.recentAttendanceCount}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {row.lastActivityUnavailable ? (
                        <span className="text-yellow-400">Unavailable</span>
                      ) : row.lastActivityAt ? (
                        <>
                          <span className="capitalize">{row.lastActivityAction?.replace(/_/g, " ")}</span>
                          <p className="text-gray-400 text-xs">{new Date(row.lastActivityAt).toLocaleDateString()}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list — purpose-built, never a squeezed table */}
          <ul className="lg:hidden space-y-3">
            {visible.map((row) => (
              <li key={row.gymId} className="border border-white/10 rounded-lg p-4 min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/platform/gyms/${row.gymId}`} className="text-white font-semibold hover:underline min-w-0 truncate">
                    {row.gymName}
                  </Link>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${PRIORITY_TONE[row.priority]}`}>
                    {PRIORITY_LABELS[row.priority]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {row.owner.known
                    ? `${row.owner.name ?? ""} ${row.owner.email ?? ""}`.trim()
                    : row.owner.resolution === "ambiguous"
                      ? "Owner unknown (multiple marked)"
                      : "Owner unknown"}
                </p>
                <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-gray-400">Billing</dt>
                  <dd className="text-gray-300 text-right">{row.subscriptionStatus} · {planLabel(row)}</dd>
                  <dt className="text-gray-400">Trial</dt>
                  <dd className="text-gray-300 text-right">{trialLabel(row)}</dd>
                  <dt className="text-gray-400">Setup</dt>
                  <dd className="text-gray-300 text-right">{row.milestonesComplete}/{row.milestonesTotal}</dd>
                  <dt className="text-gray-400">Live usage</dt>
                  <dd className="text-gray-300 text-right">{row.hasLiveUsage ? "Yes" : "No"}</dd>
                  <dt className="text-gray-400 min-w-0 break-words">Members / instructors / classes</dt>
                  <dd className="text-gray-300 text-right">
                    {row.activeMembers} / {row.activeInstructors} / {row.activeClasses}
                  </dd>
                  <dt className="text-gray-400 min-w-0 break-words">Check-ins ({recentDays}d)</dt>
                  <dd className="text-gray-300 text-right">{row.recentAttendanceCount}</dd>
                </dl>
                <p className="text-xs text-gray-400 mt-3">{row.recommendedAction}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="mt-8 border border-white/10 rounded-lg p-5 min-w-0 break-words">
        <h2 className="text-sm font-semibold text-white mb-3">What these columns mean</h2>
        <dl className="text-xs text-gray-400 space-y-1.5">
          <div><dt className="inline text-gray-300">Setup:</dt> <dd className="inline">profile complete, first member beyond the owner, an active instructor, an active class.</dd></div>
          <div><dt className="inline text-gray-300">Live:</dt> <dd className="inline">at least one attendance record exists. Setup and live usage are tracked separately.</dd></div>
          <div><dt className="inline text-gray-300">Plan:</dt> <dd className="inline">only server allow-listed Basic/Pro prices count. An active subscription with any other price is a reconciliation issue, never revenue.</dd></div>
          <div><dt className="inline text-gray-300">Owner:</dt> <dd className="inline">the single member carrying the registration owner marker. Zero or several marked owners both read Unknown — earliest member, belt rank, and email order are never used as fallbacks.</dd></div>
          <div><dt className="inline text-gray-300">Last activity:</dt> <dd className="inline">the newest activity record for that academy. If the lookup fails it reads Unavailable, never a false &quot;None&quot;.</dd></div>
        </dl>
        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Not available here</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          {QUEUE_UNAVAILABLE.map((item) => (
            <li key={item.metric}>
              <span className="text-gray-300">{item.metric}</span> — {item.status}: {item.why}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
