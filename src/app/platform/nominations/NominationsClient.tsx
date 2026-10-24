"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Check, AlertTriangle } from "lucide-react";

interface NominationRow {
  id: string;
  gymName: string;
  city: string | null;
  state: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  reviewMatches: Array<{ gymId: string; gymName: string; location: "match" | "unknown" | "conflict" }>;
  student: { id: string; firstName: string; lastName: string; email: string };
}

interface GymOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

function formatLocation(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(", ");
}

function suggestMatch(groupName: string, gyms: GymOption[]): string | null {
  const lower = groupName.toLowerCase();
  // Prefer gyms whose name is a prefix of the group name (e.g. "Ceconi BJJ" ⊂ "Ceconi BJJ Cypress")
  const prefixHits = gyms
    .filter((g) => lower.startsWith(g.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (prefixHits.length) return prefixHits[0].id;
  // Otherwise any shared word of length >= 4
  const words = lower.split(/\s+/).filter((w) => w.length >= 4);
  for (const g of gyms) {
    const gLower = g.name.toLowerCase();
    if (words.some((w) => gLower.includes(w))) return g.id;
  }
  return null;
}

export default function NominationsClient({
  rows,
  activeGyms,
}: {
  rows: NominationRow[];
  activeGyms: GymOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ key: string; kind: "ok" | "err"; msg: string } | null>(null);

  // Group by normalized gym name
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: NominationRow[] }>();
    for (const r of rows) {
      if (r.status === "claimed") continue;
      const key = r.gymName.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { name: r.gymName, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, name: v.name, rows: v.rows }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [rows]);

  async function postClaim(targetGymId: string, nominationIds: string[], allowLocationMismatch: boolean) {
    const res = await fetch("/api/platform/nominations/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetGymId, nominationIds, allowLocationMismatch }),
    });
    return { res, data: await res.json().catch(() => ({})) };
  }

  async function claim(groupKey: string, groupName: string) {
    const targetGymId = selected[groupKey] || suggestMatch(groupName, activeGyms);
    if (!targetGymId) {
      setFlash({ key: groupKey, kind: "err", msg: "Pick an active gym first" });
      return;
    }
    const target = activeGyms.find((g) => g.id === targetGymId);
    const count = groups.find((g) => g.key === groupKey)?.rows.length ?? 0;
    const confirmed = confirm(
      `Claim "${groupName}" for ${target?.name}?\n\n${count} student${count === 1 ? " who" : "s who"} nominated will get a pending join request to ${target?.name}. The owner still approves each one.\n\nThe student community, its members and posts are kept as they are.`
    );
    if (!confirmed) return;
    setBusyKey(groupKey);
    setFlash(null);
    try {
      const nominationIds = groups.find((g) => g.key === groupKey)?.rows.map((r) => r.id) ?? [];
      let { res, data } = await postClaim(targetGymId, nominationIds, false);
      if (res.status === 409 && data.code === "LOCATION_MISMATCH") {
        const override = confirm(
          `${data.error}\n\nOnly continue if you have confirmed with the owner that this is the same academy.`
        );
        if (!override) {
          setFlash({ key: groupKey, kind: "err", msg: "Not claimed: location differs. Nothing changed." });
          setBusyKey(null);
          return;
        }
        ({ res, data } = await postClaim(targetGymId, nominationIds, true));
      }
      if (!res.ok) {
        setFlash({ key: groupKey, kind: "err", msg: data.error || "Claim failed" });
        setBusyKey(null);
        return;
      }
      setFlash({
        key: groupKey,
        kind: "ok",
        msg: `Claimed for ${target?.name}. ${data.joinRequestsCreated} join request${data.joinRequestsCreated === 1 ? "" : "s"} created${
          data.skippedRejected ? `, ${data.skippedRejected} previously rejected left as is` : ""
        }${data.alreadyMembers ? `, ${data.alreadyMembers} already members` : ""}. Community kept.`,
      });
      setBusyKey(null);
      router.refresh();
    } catch {
      setFlash({ key: groupKey, kind: "err", msg: "Network error" });
      setBusyKey(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Gym Nominations</h1>
        <span className="text-gray-400 text-sm">{rows.filter((r) => r.status !== "claimed").length} open</span>
      </div>

      {groups.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center text-gray-400">
          No open gym nominations.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const count = group.rows.length;
            const first = group.rows[0];
            const exact = group.rows.flatMap((r) => r.reviewMatches);
            const suggestion = exact.find((m) => m.location !== "conflict")?.gymId ?? suggestMatch(group.name, activeGyms);
            const currentSelection = selected[group.key] || suggestion || "";
            return (
              <div key={group.key} className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-white text-lg font-bold">{group.name}</h2>
                      {count >= 3 ? (
                        <span className="bg-orange-500/20 text-orange-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded">
                          Hot · {count} students
                        </span>
                      ) : (
                        <span className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded">
                          {count} student{count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {(first.city || first.state) && (
                      <p className="text-gray-400 text-xs mt-1">{formatLocation(first.city, first.state)}</p>
                    )}
                    {exact.length > 0 && (
                      <p role="status" className="text-amber-300 text-xs mt-2">
                        Pending review: {Array.from(new Set(exact.map((m) => m.gymName))).join(", ")} joined MatFlow with this
                        name{exact.some((m) => m.location === "conflict") ? " but lists a different location" : ""}. A
                        matching name is not proof of ownership; confirm with the owner before claiming.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Academy to link ${group.name} to`}
                      value={currentSelection}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [group.key]: e.target.value }))
                      }
                      className="bg-[#111] border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-orange-500"
                      style={{ minWidth: 240 }}
                    >
                      <option value="">Link to active gym...</option>
                      {activeGyms.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {formatLocation(g.city, g.state) ? ` (${formatLocation(g.city, g.state)})` : ""}
                          {g.id === suggestion ? " ← likely match" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => claim(group.key, group.name)}
                      disabled={busyKey === group.key || !currentSelection}
                      className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Link2 className="h-4 w-4" />
                      {busyKey === group.key ? "Claiming..." : "Claim"}
                    </button>
                  </div>
                </div>
                {flash && flash.key === group.key && (
                  <div
                    className={`px-6 py-3 text-sm flex items-center gap-2 ${
                      flash.kind === "ok"
                        ? "bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-b border-red-500/20"
                    }`}
                  >
                    {flash.kind === "ok" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {flash.msg}
                  </div>
                )}
                <div className="divide-y divide-white/5">
                  {group.rows.map((n) => (
                    <div
                      key={n.id}
                      className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">
                          {n.student.firstName} {n.student.lastName}
                        </p>
                        <p className="text-gray-400 text-xs">{n.student.email}</p>
                        {n.notes && (
                          <p className="text-gray-400 text-xs mt-1 italic">&ldquo;{n.notes}&rdquo;</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {n.ownerEmail && (
                          <a
                            href={`mailto:${n.ownerEmail}`}
                            className="block text-orange-400 text-xs hover:underline"
                          >
                            {n.ownerEmail}
                          </a>
                        )}
                        {n.ownerPhone && (
                          <a
                            href={`tel:${n.ownerPhone}`}
                            className="block text-gray-400 text-xs hover:underline"
                          >
                            {n.ownerPhone}
                          </a>
                        )}
                        <p className="text-gray-400 text-[10px] mt-1">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
