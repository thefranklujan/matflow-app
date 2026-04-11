// Scrape emails from gym websites overnight
// Runs contact extractor on all gyms without emails, imports results back
// Usage: npx tsx scripts/scrape-emails-overnight.ts

const ACTOR = "betterdevsscrape/contact-details-extractor";
const API = "https://api.apify.com/v2";
const BATCH_SIZE = 200;

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  // Get all gyms with website but no email
  const gyms = await prisma.gymDatabase.findMany({
    where: { email: null, website: { not: null } },
    select: { id: true, website: true, googlePlaceId: true },
  });

  console.log(`Found ${gyms.length} gyms to scrape for emails`);

  // Create batches
  const batches: typeof gyms[] = [];
  for (let i = 0; i < gyms.length; i += BATCH_SIZE) {
    batches.push(gyms.slice(i, i + BATCH_SIZE));
  }

  console.log(`Split into ${batches.length} batches of ~${BATCH_SIZE}`);

  let totalFound = 0;
  let totalUpdated = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const startUrls = batch.map(g => ({ url: g.website }));

    console.log(`\n--- Batch ${b + 1}/${batches.length} (${batch.length} URLs) ---`);

    // Start the actor run
    const runRes = await fetch(`${API}/acts/${ACTOR.replace("/", "~")}/runs?waitForFinish=300`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls,
        maxPagesPerStartUrl: 5,
        maxDepth: 1,
        sameDomain: true,
        mergeContacts: true,
        browserMode: "auto",
        companyNameMethod: "heuristics",
      }),
    });

    if (!runRes.ok) {
      console.log(`  Batch ${b + 1} failed to start: ${runRes.status}`);
      // Wait and retry
      await new Promise(r => setTimeout(r, 30000));
      continue;
    }

    const runData = await runRes.json();
    const datasetId = runData.data?.defaultDatasetId;
    const runId = runData.data?.id;
    const status = runData.data?.status;

    console.log(`  Run ${runId} - Status: ${status}`);

    if (!datasetId) {
      console.log(`  No dataset ID, skipping`);
      continue;
    }

    // If not finished yet, poll
    if (status === "RUNNING" || status === "READY") {
      console.log(`  Waiting for completion...`);
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 10000));
        const checkRes = await fetch(`${API}/actor-runs/${runId}`);
        const checkData = await checkRes.json();
        if (checkData.data?.status === "SUCCEEDED" || checkData.data?.status === "FAILED" || checkData.data?.status === "ABORTED") {
          console.log(`  Final status: ${checkData.data.status}`);
          break;
        }
        attempts++;
        process.stdout.write(".");
      }
    }

    // Fetch results
    const resultsRes = await fetch(`${API}/datasets/${datasetId}/items?format=json`);
    const results = await resultsRes.json();

    console.log(`  Got ${results.length} results`);

    // Match results back to gyms by URL and update emails
    for (const result of results) {
      const emails = result.emails || [];
      if (emails.length === 0) continue;

      totalFound++;
      const email = emails[0]; // Take the first email found
      const domain = result.domain || "";

      // Find matching gym by website domain
      const matchingGym = batch.find(g => {
        try {
          const gymDomain = new URL(g.website!).hostname.replace("www.", "");
          return gymDomain === domain.replace("www.", "");
        } catch { return false; }
      });

      if (matchingGym) {
        try {
          await prisma.gymDatabase.update({
            where: { id: matchingGym.id },
            data: {
              email,
              socialMedia: [
                result.facebooks?.[0],
                result.instagrams?.[0],
              ].filter(Boolean).join(", ") || undefined,
            },
          });
          totalUpdated++;
        } catch (e) {
          // Skip update errors
        }
      }
    }

    console.log(`  Running total: ${totalFound} emails found, ${totalUpdated} gyms updated`);

    // Small delay between batches
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total emails found: ${totalFound}`);
  console.log(`Total gyms updated: ${totalUpdated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
