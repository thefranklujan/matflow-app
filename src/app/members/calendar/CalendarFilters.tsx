"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const LOCATIONS = [
  { label: "All Locations", value: "" },
  { label: "Magnolia", value: "magnolia" },
  { label: "Cypress", value: "cypress" },
];

const CLASS_TYPES = [
  { label: "All Classes", value: "" },
  { label: "Gi", value: "Gi" },
  { label: "No-Gi", value: "No-Gi" },
  { label: "Fundamentals", value: "Fundamentals" },
  { label: "Kids", value: "Kids" },
  { label: "Competition", value: "Competition" },
];

const EVENT_TYPES = [
  { label: "All Events", value: "" },
  { label: "Seminar", value: "seminar" },
  { label: "Open Mat", value: "open-mat" },
  { label: "Promotion", value: "promotion" },
  { label: "Closure", value: "closure" },
  { label: "Social", value: "social" },
];

export default function CalendarFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const location = searchParams.get("location") || "";
  const classType = searchParams.get("classType") || "";
  const eventType = searchParams.get("eventType") || "";

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const pillClass = (isActive: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
      isActive
        ? "bg-brand-accent text-brand-black font-bold"
        : "bg-brand-dark border border-brand-gray text-gray-300 hover:border-brand-accent hover:text-white"
    }`;

  return (
    <div className="space-y-3 mb-6">
      {/* Location */}
      <div className="flex flex-wrap gap-2">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.value}
            onClick={() => updateFilter("location", loc.value)}
            className={pillClass(location === loc.value)}
          >
            {loc.label}
          </button>
        ))}
      </div>

      {/* Class Type */}
      <div className="flex flex-wrap gap-2">
        {CLASS_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => updateFilter("classType", ct.value)}
            className={pillClass(classType === ct.value)}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Event Type */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((et) => (
          <button
            key={et.value}
            onClick={() => updateFilter("eventType", et.value)}
            className={pillClass(eventType === et.value)}
          >
            {et.label}
          </button>
        ))}
      </div>
    </div>
  );
}
