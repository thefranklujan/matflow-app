export const BRAND = {
  name: "Ceconi BJJ",
  tagline: "Respect & Friendship",
  motto: "Work hard pays off",
  phone: "713-594-8160",
  website: "www.ceconibjj.com",
  locations: [
    {
      name: "Magnolia",
      address: "10540 FM1488 Ste 110, Magnolia, TX 77354",
    },
    {
      name: "Cypress",
      address: "15460 FM 529 RD, Houston, TX 77095",
    },
  ],
  colors: {
    teal: "#0fe69b",
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

export const CATEGORIES = [
  { name: "Gis", slug: "gis", sortOrder: 1 },
  { name: "Rash Guards", slug: "rash-guards", sortOrder: 2 },
  { name: "Shorts", slug: "shorts", sortOrder: 3 },
  { name: "T-Shirts", slug: "t-shirts", sortOrder: 4 },
  { name: "Hoodies", slug: "hoodies", sortOrder: 5 },
  { name: "Belts", slug: "belts", sortOrder: 6 },
  { name: "Patches", slug: "patches", sortOrder: 7 },
  { name: "Accessories", slug: "accessories", sortOrder: 8 },
] as const;
