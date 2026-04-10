// Script to import scraped BJJ gym data from Apify into the GymDatabase table
// Run with: npx tsx scripts/import-gyms.ts

const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
const DATASET_ID = "oT9alRdtH8vxRdwqU";
const API_BASE = "https://api.apify.com/v2";
const BATCH_SIZE = 100;
const TOTAL = 720;

// State abbreviation mapping
const STATE_ABBR: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
};

interface ApifyItem {
  title: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  totalScore?: number;
  reviewsCount?: number;
  categories?: string[];
  placeId?: string;
  emails?: string[];
  facebooks?: string[];
  instagrams?: string[];
}

async function fetchBatch(offset: number): Promise<ApifyItem[]> {
  const url = `${API_BASE}/datasets/${DATASET_ID}/items?offset=${offset}&limit=${BATCH_SIZE}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apify fetch failed: ${res.status}`);
  return res.json();
}

function transform(item: ApifyItem) {
  const stateRaw = item.state || "";
  const stateAbbr = STATE_ABBR[stateRaw] || stateRaw;

  const socials: string[] = [];
  if (item.facebooks?.length) socials.push(...item.facebooks.slice(0, 1));
  if (item.instagrams?.length) socials.push(...item.instagrams.slice(0, 1));

  return {
    name: item.title,
    email: item.emails?.[0] || null,
    phone: item.phone || null,
    website: item.website || null,
    address: item.address || null,
    city: item.city || null,
    state: stateAbbr || null,
    zip: item.postalCode || null,
    rating: item.totalScore || null,
    reviewCount: item.reviewsCount || null,
    categories: item.categories?.join(", ") || null,
    socialMedia: socials.join(", ") || null,
    googlePlaceId: item.placeId || null,
    source: "google_maps",
  };
}

async function importToDb(records: ReturnType<typeof transform>[]) {
  // Use the app's API route directly via internal fetch
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  let imported = 0;
  let skipped = 0;

  for (const rec of records) {
    try {
      if (rec.googlePlaceId) {
        await prisma.gymDatabase.upsert({
          where: { googlePlaceId: rec.googlePlaceId },
          update: { ...rec, updatedAt: new Date() },
          create: rec,
        });
      } else {
        await prisma.gymDatabase.create({ data: rec });
      }
      imported++;
    } catch (e: any) {
      if (e?.code === "P2002") {
        skipped++;
      } else {
        console.error(`Failed to import ${rec.name}:`, e.message);
        skipped++;
      }
    }
  }

  await prisma.$disconnect();
  return { imported, skipped };
}

async function main() {
  console.log(`Fetching ${TOTAL} gyms from Apify dataset ${DATASET_ID}...`);

  const allRecords: ReturnType<typeof transform>[] = [];

  for (let offset = 0; offset < TOTAL; offset += BATCH_SIZE) {
    console.log(`  Fetching batch ${offset}-${offset + BATCH_SIZE}...`);
    const items = await fetchBatch(offset);
    const transformed = items.map(transform);
    allRecords.push(...transformed);
  }

  console.log(`Fetched ${allRecords.length} records. Importing to database...`);
  const result = await importToDb(allRecords);
  console.log(`Done! Imported: ${result.imported}, Skipped: ${result.skipped}`);
}

main().catch(console.error);
