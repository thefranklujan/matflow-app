"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import {
  Database, Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  Mail, Phone, MapPin, Star, Globe, X, Plus,
  Edit2, Trash2, Eye, Layers, ChevronsDown, ChevronsUp,
} from "lucide-react";

interface GymRecord {
  id: string;
  name: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  rating: number | null;
  reviewCount: number | null;
  categories: string | null;
  socialMedia: string | null;
  status: string;
  notes: string | null;
  source: string;
  googlePlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ["new", "contacted", "demo", "negotiating", "signed", "lost"];
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "bg-blue-500/15", text: "text-blue-400" },
  contacted: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  demo: { bg: "bg-purple-500/15", text: "text-purple-400" },
  negotiating: { bg: "bg-orange-500/15", text: "text-orange-400" },
  signed: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  lost: { bg: "bg-red-500/15", text: "text-red-400" },
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

function DropdownMenu({ label, icon: Icon, children, active }: {
  label: string;
  icon: typeof Filter;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
          active
            ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/30"
            : "bg-[#1a1a1a] text-gray-400 border border-white/10 hover:text-white hover:border-white/20"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[300px] overflow-y-auto">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition ${
        active ? "text-brand-accent bg-brand-accent/10" : "text-gray-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function DetailPanel({ record, onClose, onUpdate, onDelete }: {
  record: GymRecord;
  onClose: () => void;
  onUpdate: (id: string, fields: Partial<GymRecord>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(record);

  function handleSave() {
    onUpdate(record.id, {
      name: form.name,
      ownerName: form.ownerName,
      email: form.email,
      phone: form.phone,
      website: form.website,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      status: form.status,
      notes: form.notes,
    });
    setEditing(false);
  }

  const sc = STATUS_COLORS[record.status] || STATUS_COLORS.new;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#111111] border-l border-white/10 overflow-y-auto" style={{ padding: "32px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
          <h2 className="text-xl font-bold text-white">{record.name}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2" style={{ marginBottom: "32px" }}>
          <span className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
            {record.status}
          </span>
          {record.rating && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Star className="h-3 w-3 fill-yellow-400" />
              {record.rating} ({record.reviewCount || 0})
            </span>
          )}
          <span className="text-xs text-gray-600">{record.source}</span>
        </div>

        {!editing ? (
          <div className="space-y-0" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {record.ownerName && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Owner</label>
                <p className="text-sm text-white" style={{ marginTop: "4px" }}>{record.ownerName}</p>
              </div>
            )}
            {record.email && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Email</label>
                <a href={`mailto:${record.email}`} className="flex items-center gap-2 text-sm text-brand-accent hover:underline" style={{ marginTop: "4px" }}>
                  <Mail className="h-3.5 w-3.5" />{record.email}
                </a>
              </div>
            )}
            {record.phone && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Phone</label>
                <a href={`tel:${record.phone}`} className="flex items-center gap-2 text-sm text-brand-accent hover:underline" style={{ marginTop: "4px" }}>
                  <Phone className="h-3.5 w-3.5" />{record.phone}
                </a>
              </div>
            )}
            {record.website && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Website</label>
                <a href={record.website.startsWith("http") ? record.website : `https://${record.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-accent hover:underline" style={{ marginTop: "4px" }}>
                  <Globe className="h-3.5 w-3.5" />{record.website}
                </a>
              </div>
            )}
            {(record.address || record.city) && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Location</label>
                <p className="flex items-center gap-2 text-sm text-gray-300" style={{ marginTop: "4px" }}>
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[record.address, record.city, record.state, record.zip].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
            {record.categories && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Categories</label>
                <p className="text-sm text-gray-300" style={{ marginTop: "4px" }}>{record.categories}</p>
              </div>
            )}
            {record.socialMedia && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Social Media</label>
                <p className="text-sm text-gray-300 break-all" style={{ marginTop: "4px" }}>{record.socialMedia}</p>
              </div>
            )}
            {record.notes && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Notes</label>
                <p className="text-sm text-gray-300" style={{ marginTop: "4px" }}>{record.notes}</p>
              </div>
            )}

            <div className="flex gap-2" style={{ paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => { if (confirm("Delete this record?")) { onDelete(record.id); onClose(); } }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {(["name", "ownerName", "email", "phone", "website", "address", "city", "state", "zip"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium capitalize">
                  {field === "ownerName" ? "Owner Name" : field}
                </label>
                <input
                  value={form[field] || ""}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent/50 focus:outline-none transition"
                  style={{ marginTop: "4px" }}
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent/50 focus:outline-none transition capitalize"
                style={{ marginTop: "4px" }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Notes</label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent/50 focus:outline-none transition resize-none"
                style={{ marginTop: "4px" }}
              />
            </div>
            <div className="flex gap-2" style={{ paddingTop: "8px" }}>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-brand-accent text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                Save
              </button>
              <button
                onClick={() => { setForm(record); setEditing(false); }}
                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DatabaseClient() {
  const [records, setRecords] = useState<GymRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [selected, setSelected] = useState<GymRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "state">("none");
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"name" | "state" | "rating" | "email" | "phone">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const limit = 50;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (search) params.set("search", search);
    if (groupBy === "state") params.set("groupBy", "state");

    try {
      const res = await fetch(`/api/admin/database?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch database:", err);
    }
    setLoading(false);
  }, [page, statusFilter, stateFilter, search, groupBy]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function updateRecord(id: string, fields: Partial<GymRecord>) {
    await fetch("/api/admin/database", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    fetchRecords();
    if (selected?.id === id) {
      setSelected({ ...selected, ...fields } as GymRecord);
    }
  }

  async function deleteRecord(id: string) {
    await fetch(`/api/admin/database?id=${id}`, { method: "DELETE" });
    fetchRecords();
  }

  async function addRecord(data: Partial<GymRecord>) {
    await fetch("/api/admin/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAdd(false);
    fetchRecords();
  }

  const totalPages = Math.ceil(total / limit);

  const statusCounts = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sortedRecords = useMemo(() => {
    const sorted = [...records];
    sorted.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (sortField === "name") { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortField === "state") { aVal = (a.state || "").toLowerCase(); bVal = (b.state || "").toLowerCase(); }
      else if (sortField === "rating") { aVal = a.rating || 0; bVal = b.rating || 0; }
      else if (sortField === "email") { aVal = (a.email || "zzz").toLowerCase(); bVal = (b.email || "zzz").toLowerCase(); }
      else if (sortField === "phone") { aVal = (a.phone || "zzz"); bVal = (b.phone || "zzz"); }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [records, sortField, sortDir]);

  const groupedByState = useMemo(() => {
    if (groupBy !== "state") return null;
    const groups: Record<string, GymRecord[]> = {};
    for (const rec of sortedRecords) {
      const key = rec.state || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedRecords, groupBy]);

  function SortHeader({ label, field, className }: { label: string; field: typeof sortField; className?: string }) {
    const active = sortField === field;
    return (
      <th
        className={`text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-white transition ${active ? "text-brand-accent" : "text-gray-500"} ${className || ""}`}
        style={{ padding: "12px 16px" }}
        onClick={() => toggleSort(field)}
      >
        {label} {active && (sortDir === "asc" ? "\u2191" : "\u2193")}
      </th>
    );
  }

  function GymRow({ rec }: { rec: GymRecord }) {
    const sc = STATUS_COLORS[rec.status] || STATUS_COLORS.new;
    return (
      <tr
        key={rec.id}
        className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer"
        onClick={() => setSelected(rec)}
      >
        <td style={{ padding: "14px 16px" }}>
          <div className="text-sm font-medium text-white">{rec.name}</div>
          {rec.website && (
            <div className="text-xs text-gray-500 truncate max-w-[200px]">{rec.website}</div>
          )}
        </td>
        <td style={{ padding: "14px 16px" }}>
          <div className="text-sm text-gray-300">{rec.ownerName || "\u2014"}</div>
        </td>
        <td style={{ padding: "14px 16px" }}>
          {rec.email ? (
            <div className="text-sm text-gray-300 truncate max-w-[200px]">{rec.email}</div>
          ) : (
            <span className="text-sm text-gray-600">{"\u2014"}</span>
          )}
        </td>
        <td style={{ padding: "14px 16px" }}>
          {rec.phone ? (
            <div className="text-sm text-gray-300">{rec.phone}</div>
          ) : (
            <span className="text-sm text-gray-600">{"\u2014"}</span>
          )}
        </td>
        <td style={{ padding: "14px 16px" }}>
          <div className="text-sm text-gray-300">
            {rec.city && rec.state ? `${rec.city}, ${rec.state}` : rec.state || rec.city || "\u2014"}
          </div>
        </td>
        <td style={{ padding: "14px 16px" }}>
          {rec.rating ? (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span className="text-sm text-gray-300">{rec.rating}</span>
              {rec.reviewCount != null && (
                <span className="text-xs text-gray-600">({rec.reviewCount})</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-600">{"\u2014"}</span>
          )}
        </td>
        <td style={{ padding: "14px 16px" }}>
          <select
            value={rec.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateRecord(rec.id, { status: e.target.value })}
            className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer focus:outline-none capitalize ${sc.bg} ${sc.text}`}
            style={{ background: "transparent" }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#1a1a1a] text-gray-300">{s}</option>
            ))}
          </select>
        </td>
        <td style={{ padding: "14px 16px" }} className="text-right">
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(rec); }}
            className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition"
          >
            <Eye className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-brand-accent" />
          <h1 className="text-2xl font-bold text-white">Database</h1>
          {!loading && (
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {total.toLocaleString()} gyms
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" /> Add Gym
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: "24px" }}>
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search gyms, owners, emails, cities..."
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-accent/50 focus:outline-none transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <DropdownMenu
          label={statusFilter === "all" ? "Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          icon={Filter}
          active={statusFilter !== "all"}
        >
          <MenuItem label="All Statuses" active={statusFilter === "all"} onClick={() => { setStatusFilter("all"); setPage(1); }} />
          <div className="h-px bg-white/5 my-1" />
          {STATUSES.map((s) => (
            <MenuItem key={s} label={`${s.charAt(0).toUpperCase() + s.slice(1)} ${statusCounts[s] ? `(${statusCounts[s]})` : ""}`} active={statusFilter === s} onClick={() => { setStatusFilter(s); setPage(1); }} />
          ))}
        </DropdownMenu>

        <DropdownMenu
          label={stateFilter === "all" ? "State" : stateFilter}
          icon={MapPin}
          active={stateFilter !== "all"}
        >
          <MenuItem label="All States" active={stateFilter === "all"} onClick={() => { setStateFilter("all"); setPage(1); }} />
          <div className="h-px bg-white/5 my-1" />
          {US_STATES.map((s) => (
            <MenuItem key={s} label={s} active={stateFilter === s} onClick={() => { setStateFilter(s); setPage(1); }} />
          ))}
        </DropdownMenu>

        <button
          onClick={() => {
            if (groupBy === "none") {
              setGroupBy("state");
              setExpandedStates(new Set());
              setPage(1);
            } else {
              setGroupBy("none");
              setPage(1);
            }
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            groupBy === "state"
              ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/30"
              : "bg-[#1a1a1a] text-gray-400 border border-white/10 hover:text-white hover:border-white/20"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          {groupBy === "state" ? "Grouped by State" : "Group by State"}
        </button>

        {groupBy === "state" && groupedByState && (
          <>
            <button
              onClick={() => setExpandedStates(new Set(groupedByState.map(([s]) => s)))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-400 border border-white/10 hover:text-white hover:border-white/20 transition"
            >
              <ChevronsDown className="h-3.5 w-3.5" /> Expand All
            </button>
            <button
              onClick={() => setExpandedStates(new Set())}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-400 border border-white/10 hover:text-white hover:border-white/20 transition"
            >
              <ChevronsUp className="h-3.5 w-3.5" /> Collapse All
            </button>
          </>
        )}

        {(statusFilter !== "all" || stateFilter !== "all" || search || groupBy !== "none") && (
          <button
            onClick={() => { setStatusFilter("all"); setStateFilter("all"); setSearch(""); setSearchInput(""); setGroupBy("none"); setPage(1); }}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-500 hover:text-white transition"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm py-12 text-center">Loading database...</div>
      ) : records.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">
          {search || statusFilter !== "all" || stateFilter !== "all"
            ? "No gyms match your filters."
            : "No gyms in the database yet. Add manually or import from a scrape."}
        </div>
      ) : groupedByState ? (
        /* Grouped by State: parent/child rows in single table */
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-[#0a0a0a]">
                  <SortHeader label="Gym" field="name" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ padding: "12px 16px" }}>Owner</th>
                  <SortHeader label="Email" field="email" />
                  <SortHeader label="Phone" field="phone" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ padding: "12px 16px" }}>City</th>
                  <SortHeader label="Rating" field="rating" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {groupedByState.map(([state, gyms]) => {
                  const isExpanded = expandedStates.has(state);
                  return (
                    <Fragment key={state}>
                      {/* Parent row */}
                      <tr
                        className="border-b border-white/10 bg-[#0d0d0d] hover:bg-white/[0.04] cursor-pointer select-none"
                        onClick={() => {
                          setExpandedStates(prev => {
                            const next = new Set(prev);
                            if (next.has(state)) next.delete(state); else next.add(state);
                            return next;
                          });
                        }}
                      >
                        <td colSpan={8} style={{ padding: "10px 16px" }}>
                          <div className="flex items-center gap-3">
                            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                            <span className="text-sm font-semibold text-white uppercase tracking-wider">{state}</span>
                            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full font-medium">
                              {gyms.length} gym{gyms.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Child rows */}
                      {isExpanded && gyms.map((rec) => (
                        <GymRow key={rec.id} rec={rec} />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Flat table view */
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-[#0a0a0a]">
                  <SortHeader label="Gym" field="name" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ padding: "12px 16px" }}>Owner</th>
                  <SortHeader label="Email" field="email" />
                  <SortHeader label="Phone" field="phone" />
                  <SortHeader label="Location" field="state" />
                  <SortHeader label="Rating" field="rating" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((rec) => (
                  <GymRow key={rec.id} rec={rec} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between" style={{ marginTop: "20px" }}>
          <span className="text-sm text-gray-500">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          record={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateRecord}
          onDelete={deleteRecord}
        />
      )}

      {/* Add modal */}
      {showAdd && <AddGymModal onClose={() => setShowAdd(false)} onAdd={addRecord} />}
    </div>
  );
}

function AddGymModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Partial<GymRecord>) => void }) {
  const [form, setForm] = useState<Partial<GymRecord>>({ status: "new", source: "manual" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111111] border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ padding: "32px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
          <h2 className="text-lg font-bold text-white">Add Gym</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {(["name", "ownerName", "email", "phone", "website", "address", "city", "state", "zip"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                {field === "ownerName" ? "Owner Name" : field}
                {field === "name" && <span className="text-red-400"> *</span>}
              </label>
              <input
                value={(form as Record<string, string>)[field] || ""}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent/50 focus:outline-none transition"
                style={{ marginTop: "4px" }}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent/50 focus:outline-none transition resize-none"
              style={{ marginTop: "4px" }}
            />
          </div>
        </div>

        <div className="flex gap-2" style={{ marginTop: "24px" }}>
          <button
            onClick={() => { if (form.name) onAdd(form); }}
            disabled={!form.name}
            className="px-4 py-2 bg-brand-accent text-black rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-30 transition"
          >
            Add Gym
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
