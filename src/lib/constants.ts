// MatFlow — Gym management SaaS for martial arts academies
// These are platform defaults. Per-gym branding comes from the Gym model.

export const MATFLOW = {
  name: "MatFlow",
  tagline: "Gym Management for Martial Arts",
  website: "www.mymatflow.com",
  supportEmail: "support@mymatflow.com",
  colors: {
    primary: "#c4b5a0",
    black: "#0a0a0a",
    dark: "#1a1a1a",
    gray: "#2a2a2a",
    white: "#fafafa",
  },
} as const;

export const GI_SIZES = ["A0", "A1", "A2", "A3", "A4", "A5", "A6"] as const;
export const APPAREL_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export const BELT_SIZES = ["A0", "A1", "A2", "A3", "A4", "A5"] as const;

export const CATEGORY_SIZE_MAP: Record<string, readonly string[]> = {
  gis: GI_SIZES,
  "rash-guards": APPAREL_SIZES,
  shorts: APPAREL_SIZES,
  "t-shirts": APPAREL_SIZES,
  hoodies: APPAREL_SIZES,
  belts: BELT_SIZES,
  patches: [],
  accessories: [],
};

export const PRODUCT_COLORS = [
  "White",
  "Black",
  "Blue",
  "Gray",
  "Teal",
] as const;

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

// ── Member Portal ──────────────────────────────────────

export const BELT_RANKS = [
  { value: "white", label: "White", color: "#FFFFFF" },
  { value: "blue", label: "Blue", color: "#1E40AF" },
  { value: "purple", label: "Purple", color: "#7C3AED" },
  { value: "brown", label: "Brown", color: "#92400E" },
  { value: "black", label: "Black", color: "#1a1a1a" },
] as const;

export const CLASS_TYPES = [
  { value: "gi", label: "Gi" },
  { value: "nogi", label: "No-Gi" },
  { value: "kids", label: "Kids" },
  { value: "fundamentals", label: "Fundamentals" },
  { value: "competition", label: "Competition" },
  { value: "womens", label: "Women's" },
  { value: "self-defense", label: "Self-Defense" },
] as const;

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SCHEDULE_TOPICS = [
  "Takedowns",
  "Guard Passing",
  "Closed Guard",
  "Open Guard",
  "Half Guard",
  "Mount",
  "Side Control",
  "Back Control",
  "Submissions",
  "Sweeps",
  "Escapes",
  "Self Defense",
  "Leg Locks",
  "Chokes",
  "Arm Locks",
  "Drills & Conditioning",
  "Competition Prep",
  "Free Roll",
  "Review / Q&A",
] as const;

export const DEFAULT_CATEGORIES = [
  { name: "Gis", slug: "gis", sortOrder: 1 },
  { name: "Rash Guards", slug: "rash-guards", sortOrder: 2 },
  { name: "Shorts", slug: "shorts", sortOrder: 3 },
  { name: "T-Shirts", slug: "t-shirts", sortOrder: 4 },
  { name: "Hoodies", slug: "hoodies", sortOrder: 5 },
  { name: "Belts", slug: "belts", sortOrder: 6 },
  { name: "Patches", slug: "patches", sortOrder: 7 },
  { name: "Accessories", slug: "accessories", sortOrder: 8 },
] as const;
