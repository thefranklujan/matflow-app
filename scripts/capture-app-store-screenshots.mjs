#!/usr/bin/env node
/**
 * Capture the five /app-store/[1..5] marketing pages to PNG at 1290×2796,
 * saved into /app-store-screenshots/. Run against whatever origin you want:
 *
 *   ORIGIN=https://app.mymatflow.com node scripts/capture-app-store-screenshots.mjs
 *
 * Defaults to http://localhost:3000 (use `npm run dev` in another terminal).
 * PNGs are what you upload in App Store Connect → Screenshots → 6.7" iPhone.
 */

import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../app-store-screenshots");
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const PAGES = [1, 2, 3, 4, 5];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new" });
  try {
    for (const n of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1284, height: 2778, deviceScaleFactor: 1 });
      const url = `${ORIGIN}/app-store/${n}`;
      console.log(`[screenshot] capturing ${url}`);
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
      // Let fonts settle for a beat
      await new Promise((r) => setTimeout(r, 1200));
      const outPath = resolve(OUT_DIR, `matflow-${n}.png`);
      await page.screenshot({ path: outPath, omitBackground: false, fullPage: false });
      console.log(`[screenshot] wrote ${outPath}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone. ${PAGES.length} screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
