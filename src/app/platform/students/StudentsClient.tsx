"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Trash2, Eye } from "lucide-react";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
  gyms: string[];
  gymCount: number;
  pendingCount: number;
  status: string;
};

type SortKey = "name" | "email" | "createdAt" | "gymCount" | "pendingCount" | "status";
type GroupKey = "none" | "status" | "gym";

export default function StudentsClient({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function deleteStudent(r: Row) {
    const name = `${r.firstName} ${r.lastName}`;
    const c = window.prompt(`Permanently delete "${name}" and all their data. Type the full name to confirm:`);
    if (c !== name) { if (c !== null) alert("Name did not match. Cancelled."); return; }
    setBusyId(r.id);
    const res = await fetch(`/api/platform/students/${r.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) { alert("Failed to delete"); return; }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  }

  async function viewAsStudent(r: Row) {
    setBusyId(r.id);
    const res = await fetch(`/api/platform/impersonate-student/${r.id}`, { method: "POST" });
    if (!res.ok) { setBusyId(null); alert("Failed to impersonate"); return; }
    window.location.href = "/student";
  }

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (r) =>
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.gyms.some((g) => g.toLowerCase().includes(q))
        )
      : rows;
    const sorted = [...list].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "name":
          av = `${a.lastName} ${a.firstName}`.toLowerCase();
          bv = `${b.lastName} ${b.firstName}`.toLowerCase();
          break;
        case "email":
          av = a.email.toLowerCase();
          bv = b.email.toLowerCase();
          break;
        case "createdAt":
          av = a.createdAt;
          bv = b.createdAt;
          break;
        case "gymCount":
          av = a.gymCount;
          bv = b.gymCount;
          break;
        case "pendingCount":
          av = a.pendingCount;
          bv = b.pendingCount;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "All Students", rows: filtered }];
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      if (groupBy === "status") {
        const k = r.status;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      } else if (groupBy === "gym") {
        if (r.gyms.length === 0) {
          if (!map.has("(no gym)")) map.set("(no gym)", []);
          map.get("(no gym)")!.push(r);
        } else {
          for (const g of r.gyms) {
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(r);
          }
        }
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rs]) => ({ key, rows: rs }));
  }, [filtered, groupBy]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">All Students</h1>
        <span className="text-gray-500 text-sm">{rows.length} total</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, gym..."
          className="bg-[#111] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 w-64 focus:outline-none focus:border-orange-500/50"
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="bg-[#111] border border-white/10 rounded px-2 py-1.5 text-white"
          >
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="gym">Gym</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Sort by:</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-[#111] border border-white/10 rounded px-2 py-1.5 text-white"
          >
            <option value="createdAt">Joined</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="gymCount">Gym count</option>
            <option value="pendingCount">Pending</option>
            <option value="status">Status</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="bg-[#111] border border-white/10 rounded px-2 py-1.5 text-gray-400 hover:text-white"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.key} className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
            {groupBy !== "none" && (
              <div className="px-6 py-3 bg-white/[0.03] border-b border-white/10 text-sm text-orange-400 font-semibold uppercase tracking-wider">
                {g.key} <span className="text-gray-500 ml-2">({g.rows.length})</span>
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                  <Th label="Name" onClick={() => toggleSort("name")} />
                  <Th label="Email" onClick={() => toggleSort("email")} />
                  <th className="text-left px-6 py-3">Phone</th>
                  <Th label="Gyms" onClick={() => toggleSort("gymCount")} />
                  <Th label="Pending" onClick={() => toggleSort("pendingCount")} center />
                  <Th label="Status" onClick={() => toggleSort("status")} center />
                  <Th label="Joined" onClick={() => toggleSort("createdAt")} />
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const statusColor =
                    r.status === "active"
                      ? "bg-green-500/20 text-green-400"
                      : r.status === "pending"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-gray-500/20 text-gray-400";
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 text-white">{r.firstName} {r.lastName}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{r.email}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{r.phone || "—"}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{r.gyms.join(", ") || "—"}</td>
                      <td className="px-6 py-4 text-center text-white">{r.pendingCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => viewAsStudent(r)}
                          disabled={busyId === r.id}
                          className="text-orange-400 hover:text-orange-300 disabled:opacity-50 mr-3"
                          title="View as student"
                        >
                          <Eye className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => deleteStudent(r)}
                          disabled={busyId === r.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          title="Delete student"
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {g.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-600 text-sm">
                      No students.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ label, onClick, center }: { label: string; onClick: () => void; center?: boolean }) {
  return (
    <th className={`px-6 py-3 ${center ? "text-center" : "text-left"}`}>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-white transition">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
