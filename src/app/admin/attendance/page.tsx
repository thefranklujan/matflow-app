"use client";

import { useState, useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { CLASS_TYPES } from "@/lib/constants";

// TODO: Locations will come from the Gym model
const LOCATIONS: { value: string; label: string }[] = [];

interface MemberItem {
  id: string;
  firstName: string;
  lastName: string;
  beltRank: string;
}

export default function AdminAttendancePage() {
  const [classDate, setClassDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [classType, setClassType] = useState<string>(CLASS_TYPES[0].value);
  const [locationSlug, setLocationSlug] = useState<string>(LOCATIONS[0]?.value ?? "");
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [classDate, classType, locationSlug]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    // Load approved members
    const membersRes = await fetch("/api/admin/members");
    if (membersRes.ok) {
      const allMembers: MemberItem[] = await membersRes.json();
      setMembers(allMembers.filter((m: any) => m.approved && m.active));
    }

    // Load existing attendance for this date/class
    const attendanceRes = await fetch(
      `/api/admin/attendance?classDate=${classDate}&classType=${classType}`
    );
    if (attendanceRes.ok) {
      const records = await attendanceRes.json();
      const checkedInIds = new Set<string>(
        records.map((r: any) => r.memberId)
      );
      setAlreadyCheckedIn(checkedInIds);
    }

    setSelected(new Set());
    setLoading(false);
  }

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    const unchecked = members.filter((m) => !alreadyCheckedIn.has(m.id));
    setSelected(new Set(unchecked.map((m) => m.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setMessage("");

    const res = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classDate,
        classType,
        locationSlug,
        memberIds: Array.from(selected),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessage(`Attendance recorded for ${data.count} member(s).`);
      loadData();
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to record attendance.");
    }
    setSubmitting(false);
  }

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-white mb-8">Record Attendance</h1>

        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={classDate}
                onChange={(e) => setClassDate(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Class Type</label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
              >
                {CLASS_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <select
                value={locationSlug}
                onChange={(e) => setLocationSlug(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Members ({members.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-brand-teal hover:text-brand-teal/80 transition"
              >
                Select All
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                Deselect All
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-gray-500 text-sm">No approved members found.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {members.map((member) => {
                const already = alreadyCheckedIn.has(member.id);
                return (
                  <label
                    key={member.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition cursor-pointer ${
                      already
                        ? "bg-green-500/10 opacity-60"
                        : selected.has(member.id)
                        ? "bg-brand-teal/10 border border-brand-teal/30"
                        : "hover:bg-brand-gray/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={already || selected.has(member.id)}
                      disabled={already}
                      onChange={() => toggleMember(member.id)}
                      className="rounded border-brand-gray bg-brand-gray text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-white text-sm">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className="text-gray-500 text-xs capitalize">
                      {member.beltRank}
                    </span>
                    {already && (
                      <span className="text-xs text-green-400 ml-auto">
                        Already checked in
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {message && (
            <p
              className={`mt-4 text-sm ${
                message.includes("recorded") ? "text-green-400" : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-brand-gray">
            <button
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              className="bg-brand-teal text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-teal/90 transition text-sm disabled:opacity-50"
            >
              {submitting
                ? "Recording..."
                : `Record Attendance (${selected.size} selected)`}
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
