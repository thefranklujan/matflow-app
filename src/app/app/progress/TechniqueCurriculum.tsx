"use client";

import { useState } from "react";
import { CURRICULUM, CATEGORIES, getNextMilestoneTechniques } from "@/lib/curriculum";
import type { Technique } from "@/lib/curriculum";

interface CompletedTechnique {
  techniqueId: string;
  completedAt: string;
  verifiedBy: string | null;
}

interface Props {
  completedTechniques: CompletedTechnique[];
  currentBelt: string;
  currentStripes: number;
}

const BELT_BG: Record<string, string> = {
  white: "bg-white/10 border-white/30",
  blue: "bg-blue-600/10 border-blue-600/30",
  purple: "bg-purple-600/10 border-purple-600/30",
  brown: "bg-amber-800/10 border-amber-800/30",
  black: "bg-gray-800/10 border-gray-600/30",
};

const BELT_TEXT: Record<string, string> = {
  white: "text-white",
  blue: "text-blue-400",
  purple: "text-purple-400",
  brown: "text-amber-500",
  black: "text-gray-300",
};

const BELT_ACCENT: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-gray-600",
};

export default function TechniqueCurriculum({
  completedTechniques,
  currentBelt,
  currentStripes,
}: Props) {
  const completedIds = new Set(completedTechniques.map((t) => t.techniqueId));
  const [openBelts, setOpenBelts] = useState<Set<string>>(new Set([currentBelt]));
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "remaining">("all");

  const toggleBelt = (belt: string) => {
    setOpenBelts((prev) => {
      const next = new Set(prev);
      if (next.has(belt)) next.delete(belt);
      else next.add(belt);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Next milestone
  const nextMilestone = getNextMilestoneTechniques(currentBelt, currentStripes);
  const nextCompleted = nextMilestone.techniques.filter((t) => completedIds.has(t.id)).length;
  const nextTotal = nextMilestone.techniques.length;
  const nextPct = nextTotal > 0 ? Math.round((nextCompleted / nextTotal) * 100) : 0;

  // Filter techniques
  const matchesFilters = (tech: Technique) => {
    if (search) {
      const q = search.toLowerCase();
      if (!tech.name.toLowerCase().includes(q) && !tech.category.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterCategory !== "all" && tech.category !== filterCategory) return false;
    if (filterStatus === "completed" && !completedIds.has(tech.id)) return false;
    if (filterStatus === "remaining" && completedIds.has(tech.id)) return false;
    return true;
  };

  const hasActiveFilters = search !== "" || filterCategory !== "all" || filterStatus !== "all";

  // Group techniques by category
  const groupByCategory = (techniques: Technique[]) => {
    const groups: Record<string, Technique[]> = {};
    for (const cat of CATEGORIES) {
      const items = techniques.filter((t) => t.category === cat);
      if (items.length > 0) groups[cat] = items;
    }
    return groups;
  };

  return (
    <div className="space-y-8">
      {/* ── Next Milestone Progress ─────────────────────── */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-1">
          Next Milestone
        </h3>
        <p className="text-white font-semibold text-lg mb-4">{nextMilestone.label}</p>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 bg-brand-gray rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-accent rounded-full transition-all duration-500"
              style={{ width: `${nextPct}%` }}
            />
          </div>
          <span className="text-brand-accent font-bold text-sm whitespace-nowrap">
            {nextCompleted}/{nextTotal} ({nextPct}%)
          </span>
        </div>

        {/* ── Filters & Search ─────────────────────────────── */}
        <div className="mt-4 space-y-3 border-t border-brand-gray/30 pt-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search techniques..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-brand-black/50 border border-brand-gray rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterCategory("all")}
                className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                  filterCategory === "all"
                    ? "bg-brand-accent text-brand-black"
                    : "bg-brand-black/50 border border-brand-gray text-gray-300 hover:border-brand-accent/50"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                    filterCategory === cat
                      ? "bg-brand-accent text-brand-black"
                      : "bg-brand-black/50 border border-brand-gray text-gray-300 hover:border-brand-accent/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex gap-1.5">
              {([["all", "All"], ["completed", "Completed"], ["remaining", "Remaining"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterStatus(val)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                    filterStatus === val
                      ? "bg-brand-accent text-brand-black"
                      : "bg-brand-black/50 border border-brand-gray text-gray-300 hover:border-brand-accent/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStatus("all"); }}
              className="text-xs text-gray-400 hover:text-brand-accent transition"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Technique checklist for next milestone */}
        <div className="mt-4 space-y-1.5">
          {nextMilestone.techniques.map((tech) => {
            const done = completedIds.has(tech.id);
            return (
              <div key={tech.id} className="flex items-center gap-3 py-1">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    done
                      ? "bg-brand-accent/20 border border-brand-accent/50"
                      : "border border-brand-gray"
                  }`}
                >
                  {done && (
                    <svg className="w-3.5 h-3.5 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${done ? "text-gray-400 line-through" : "text-white"}`}>
                  {tech.name}
                </span>
                <span className="text-[10px] text-gray-500 ml-auto">{tech.category}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Full Curriculum Chart ───────────────────────── */}
      <div>
        <h3 className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-4">
          Complete Curriculum: White to Black Belt
        </h3>

        <div className="space-y-3">
          {CURRICULUM.map((belt) => {
            const filteredTechniques = belt.techniques.filter(matchesFilters);
            if (hasActiveFilters && filteredTechniques.length === 0) return null;

            const beltCompleted = belt.techniques.filter((t) => completedIds.has(t.id)).length;
            const beltTotal = belt.techniques.length;
            const beltPct = beltTotal > 0 ? Math.round((beltCompleted / beltTotal) * 100) : 0;
            const isOpen = hasActiveFilters || openBelts.has(belt.beltRank);
            const isCurrent = belt.beltRank === currentBelt;

            // Group by stripe (use filtered techniques when filters active)
            const techsToShow = hasActiveFilters ? filteredTechniques : belt.techniques;
            const stripes = new Map<number, Technique[]>();
            for (const tech of techsToShow) {
              if (!stripes.has(tech.stripe)) stripes.set(tech.stripe, []);
              stripes.get(tech.stripe)!.push(tech);
            }
            const sortedStripes = Array.from(stripes.entries()).sort((a, b) => a[0] - b[0]);

            return (
              <div key={belt.beltRank} className={`border rounded-lg overflow-hidden ${BELT_BG[belt.beltRank] || "bg-brand-dark border-brand-gray"}`}>
                {/* Belt header */}
                <button
                  onClick={() => toggleBelt(belt.beltRank)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-3 rounded-sm ${BELT_ACCENT[belt.beltRank]} ${belt.beltRank === "white" ? "border border-gray-400" : ""}`} />
                    <span className={`font-semibold ${BELT_TEXT[belt.beltRank]}`}>
                      {belt.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-brand-gray/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-accent rounded-full"
                          style={{ width: `${beltPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-16 text-right">
                        {beltCompleted}/{beltTotal}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Belt content */}
                {isOpen && (
                  <div className="border-t border-brand-gray/30 px-4 pb-4">
                    {sortedStripes.map(([stripe, techniques]) => {
                      const stripeCompleted = techniques.filter((t) => completedIds.has(t.id)).length;
                      const stripeLabel = stripe === 0 ? "Promotion Requirements" : `Stripe ${stripe}`;
                      const grouped = groupByCategory(techniques);

                      return (
                        <div key={stripe} className="mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-sm font-semibold text-white">{stripeLabel}</h4>
                            <span className="text-[10px] text-gray-500">
                              {stripeCompleted}/{techniques.length} complete
                            </span>
                            {/* Stripe bars */}
                            {stripe > 0 && (
                              <div className="flex gap-0.5 ml-1">
                                {Array.from({ length: stripe }).map((_, i) => (
                                  <div key={i} className="w-1 h-3 rounded-sm bg-black" />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Category groups */}
                          {Object.entries(grouped).map(([category, techs]) => {
                            const catKey = `${belt.beltRank}-${stripe}-${category}`;
                            const catOpen = hasActiveFilters || openCategories.has(catKey);
                            const catCompleted = techs.filter((t) => completedIds.has(t.id)).length;

                            return (
                              <div key={catKey} className="mb-2">
                                <button
                                  onClick={() => toggleCategory(catKey)}
                                  className="flex items-center gap-2 w-full py-1.5 text-left hover:text-white transition"
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 transition-transform ${catOpen ? "rotate-90" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-300">{category}</span>
                                  <span className="text-[10px] text-gray-500">
                                    ({catCompleted}/{techs.length})
                                  </span>
                                </button>

                                {catOpen && (
                                  <div className="ml-5 space-y-1 mt-1">
                                    {techs.map((tech) => {
                                      const done = completedIds.has(tech.id);
                                      return (
                                        <div key={tech.id} className="flex items-center gap-2.5 py-0.5">
                                          <div
                                            className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                              done
                                                ? "bg-brand-accent/20 border border-brand-accent/50"
                                                : "border border-brand-gray/60"
                                            }`}
                                          >
                                            {done && (
                                              <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                          <span className={`text-xs ${done ? "text-gray-500 line-through" : "text-gray-200"}`}>
                                            {tech.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total count */}
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-500">
            Total: {completedTechniques.length} of{" "}
            {CURRICULUM.reduce((s, b) => s + b.techniques.length, 0)} techniques completed across all belts
          </span>
        </div>
      </div>
    </div>
  );
}
