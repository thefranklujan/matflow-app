// Generic import script for any Apify dataset
// Usage: npx tsx scripts/import-dataset.ts <datasetId>

const DATASET_ID = process.argv[2];
if (!DATASET_ID) { console.error("Usage: npx tsx scripts/import-dataset.ts <datasetId>"); process.exit(1); }

const API_BASE = "https://api.apify.com/v2";
const BATCH_SIZE = 100;

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

async function main() {
  // Get total count first
  const countRes = await fetch(`${API_BASE}/datasets/${DATASET_ID}/items?limit=1&format=json`);
  const countData = await countRes.json();

  // Fetch all items
  let offset = 0;
  const allItems: any[] = [];

  while (true) {
    const url = `${API_BASE}/datasets/${DATASET_ID}/items?offset=${offset}&limit=${BATCH_SIZE}&fields=title,phone,website,address,city,state,postalCode,totalScore,reviewsCount,categories,placeId,emails,facebooks,instagrams&format=json`;
    const res = await fetch(url);
    const items = await res.json();
    if (!items.length) break;
    allItems.push(...items);
    offset += BATCH_SIZE;
    process.stdout.write(`  Fetched ${allItems.length} records...\r`);
  }

  console.log(`\nFetched ${allItems.length} total records. Importing...`);

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let imported = 0, skipped = 0;

  for (const item of allItems) {
    const stateRaw = item.state || "";
    const stateAbbr = STATE_ABBR[stateRaw] || stateRaw;
    const socials: string[] = [];
    if (item.facebooks?.length) socials.push(item.facebooks[0]);
    if (item.instagrams?.length) socials.push(item.instagrams[0]);

    const rec = {
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
      skipped++;
    }
  }

  await prisma.$disconnect();
  console.log(`Done! Imported: ${imported}, Skipped/Dupes: ${skipped}`);
}

main().catch(console.error);
