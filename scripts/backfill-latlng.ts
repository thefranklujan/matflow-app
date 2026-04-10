// Backfill lat/lng from Apify datasets into GymDatabase
// Usage: npx tsx scripts/backfill-latlng.ts <datasetId1> [datasetId2] ...

const DATASET_IDS = process.argv.slice(2);
if (!DATASET_IDS.length) { console.error("Usage: npx tsx scripts/backfill-latlng.ts <datasetId1> [datasetId2]"); process.exit(1); }

const API_BASE = "https://api.apify.com/v2";
const BATCH_SIZE = 100;

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let updated = 0;

  for (const dsId of DATASET_IDS) {
    console.log(`Processing dataset ${dsId}...`);
    let offset = 0;
    while (true) {
      const url = `${API_BASE}/datasets/${dsId}/items?offset=${offset}&limit=${BATCH_SIZE}&fields=placeId,location&format=json`;
      const res = await fetch(url);
      const items = await res.json();
      if (!items.length) break;

      for (const item of items) {
        if (item.placeId && item.location?.lat && item.location?.lng) {
          try {
            await prisma.gymDatabase.update({
              where: { googlePlaceId: item.placeId },
              data: { lat: item.location.lat, lng: item.location.lng },
            });
            updated++;
          } catch { /* not found, skip */ }
        }
      }
      offset += BATCH_SIZE;
      process.stdout.write(`  ${offset} records processed, ${updated} updated...\r`);
    }
  }

  await prisma.$disconnect();
  console.log(`\nDone! Updated ${updated} records with lat/lng.`);
}

main().catch(console.error);
