// Monitor running Apify scrapes and import results as they complete
// Usage: npx tsx scripts/monitor-and-import.ts

const API = "https://api.apify.com/v2";
const STATE_ABBR: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
};

const RUNS = [
  "EX5QX9eIiQzEiBhW9", // FL
  "i90KPag0KKb6FPFSo", // NY
  "VHlsfXFcMPKWI0ow7", // NJ
  "Taoo9cfYAqaNDJhYP", // NC
  "9HCYkEpeED21nFffw", // GA
  "cQj3Kl56zhH3aOqQt", // VA
  "AapcYjp7ZAq2oP7Fm", // MA
  "Bkletcy6bPVg9vKG9", // OH
  "ThmMouiy4GOwueO5a", // IL
  "9AIpFKQglPk22VWVF", // MI
  "1cvmYlxhJi0nmnBCa", // AZ
  "TFTk1nhF1daSJXGYE", // WA
  "IJ1TalNA4iNYnuDcl", // TN
  "Q7teMLJQ9e70sv1HF", // IN
  "SfD1odFcycYmC3lqL", // MO
  "aeoJEsQDp6ya2vgOp", // MD
  "yi8KbUNhuwHXqU60k", // WI
  "NOANvpAd7hqM7NaZv", // MN
  "w2zsH07pait09V4Yf", // SC
  "T2mgqEEfGIBcX2j2q", // AL
  "5lOoVKSgisfPWT2yT", // LA
  "m3bXcl5aqQmwemzQP", // KY
  "Y7vEqcDpGZ2DTZfHf", // CT
  "duO2RVpJGqf3TfMQQ", // UT
  "KSmEceSaHLNUUzPga", // OK
  "HascMwa1BodPUMQag", // IA
  "s3tnH4iRd9pYoSWxP", // NV
  "gh4Ah346mjCndparT", // AR
  "AmWgguG5kGbEyN11n", // MS
  "qIemKKZz2hAVgrvFl", // NM
  "SoBbSpzwwZzA5d4v8", // NE
  "SDxPwAaOjl6dsFYJy", // ID
];

async function importDataset(datasetId: string) {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let offset = 0, imported = 0;

  while (true) {
    const res = await fetch(`${API}/datasets/${datasetId}/items?offset=${offset}&limit=100&fields=title,phone,website,address,city,state,postalCode,totalScore,reviewsCount,categories,placeId,emails,facebooks,instagrams,location&format=json`);
    const items = await res.json();
    if (!items.length) break;

    for (const i of items) {
      const st = STATE_ABBR[i.state || ""] || i.state || null;
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
          await prisma.gymDatabase.upsert({ where: { googlePlaceId: rec.googlePlaceId }, update: { ...rec, updatedAt: new Date() }, create: rec });
        } else {
          await prisma.gymDatabase.create({ data: rec });
        }
        imported++;
      } catch {}
    }
    offset += 100;
  }
  await prisma.$disconnect();
  return imported;
}

async function main() {
  const completed = new Set<string>();

  while (completed.size < RUNS.length) {
    for (const runId of RUNS) {
      if (completed.has(runId)) continue;
      try {
        const res = await fetch(`${API}/actor-runs/${runId}`);
        const data = await res.json();
        const status = data.data?.status;

        if (status === "SUCCEEDED") {
          const dsId = data.data.defaultDatasetId;
          const count = data.data.stats?.durationMillis ? Math.round(data.data.stats.durationMillis / 1000) : 0;
          console.log(`\n[DONE] Run ${runId} succeeded (${count}s). Importing dataset ${dsId}...`);
          const imported = await importDataset(dsId);
          console.log(`  Imported ${imported} records`);
          completed.add(runId);
        } else if (status === "FAILED" || status === "ABORTED") {
          console.log(`\n[SKIP] Run ${runId}: ${status}`);
          completed.add(runId);
        }
      } catch {}
    }

    if (completed.size < RUNS.length) {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ${completed.size}/${RUNS.length} complete. Waiting...`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  console.log(`\n\n=== ALL DONE === ${completed.size} runs processed`);
}

main().catch(console.error);
