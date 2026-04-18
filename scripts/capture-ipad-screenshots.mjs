#!/usr/bin/env node
/**
 * Capture /app-store-ipad/[1..5] at 2064×2752 (13-inch iPad) for App Store Connect.
 * Run: ORIGIN=http://localhost:3000 node scripts/capture-ipad-screenshots.mjs
 */
import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../app-store-screenshots/ipad");
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const PAGES = [1, 2, 3, 4, 5];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new" });
  try {
    for (const n of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 2064, height: 2752, deviceScaleFactor: 1 });
      const url = `${ORIGIN}/app-store-ipad/${n}`;
      console.log(`[screenshot] ${url}`);
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
      await new Promise((r) => setTimeout(r, 1200));
      const outPath = resolve(OUT_DIR, `matflow-ipad-${n}.png`);
      await page.screenshot({ path: outPath, omitBackground: false, fullPage: false });
      console.log(`[screenshot] wrote ${outPath}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Done. ${PAGES.length} iPad screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
