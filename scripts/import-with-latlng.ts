// Import Apify dataset with lat/lng included
// Usage: npx tsx scripts/import-with-latlng.ts <datasetId>

const DSI = process.argv[2];
if (!DSI) { console.error("Usage: npx tsx scripts/import-with-latlng.ts <datasetId>"); process.exit(1); }

const API = "https://api.apify.com/v2";
const BS = 100;
const SA: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
};

async function main() {
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const r = await fetch(`${API}/datasets/${DSI}/items?offset=${offset}&limit=${BS}&fields=title,phone,website,address,city,state,postalCode,totalScore,reviewsCount,categories,placeId,emails,facebooks,instagrams,location&format=json`);
    const items = await r.json();
    if (!items.length) break;
    all.push(...items);
    offset += BS;
    process.stdout.write(`  Fetched ${all.length}...\r`);
  }
  console.log(`\nFetched ${all.length}. Importing...`);

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let imp = 0, skip = 0;

  for (const i of all) {
    const st = SA[i.state || ""] || i.state || null;
    const soc: string[] = [];
    if (i.facebooks?.length) soc.push(i.facebooks[0]);
    if (i.instagrams?.length) soc.push(i.instagrams[0]);
    const rec = {
      name: i.title, email: i.emails?.[0] || null, phone: i.phone || null,
      website: i.website || null, address: i.address || null, city: i.city || null,
      state: st, zip: i.postalCode || null, rating: i.totalScore || null,
      reviewCount: i.reviewsCount || null, categories: i.categories?.join(", ") || null,
      socialMedia: soc.join(", ") || null, googlePlaceId: i.placeId || null,
      lat: i.location?.lat || null, lng: i.location?.lng || null, source: "google_maps",
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
      imp++;
    } catch { skip++; }
  }
  await prisma.$disconnect();
  console.log(`Done! Imported: ${imp}, Skipped: ${skip}`);
}
main().catch(console.error);
