#!/usr/bin/env node
/**
 * Stripe test-mode readiness preflight.
 *
 * Prints configuration STATUS only — never a value, never a fragment.
 * Never calls Stripe. Never reads Vercel. Refuses live keys and .env.production.
 *
 *   node scripts/stripe-readiness.mjs                        # inherited env
 *   node scripts/stripe-readiness.mjs --config .env.stripe-test
 *
 * NOTE: the flag is --config, not --env-file: Node itself consumes --env-file
 * (v20.6+) before the script ever sees it.
 *
 * Exit codes: 0 ready, 1 incomplete, 87 live key refused, 88 forbidden file.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

// Node 20 cannot import TypeScript, so the evaluation logic below is a
// deliberate copy of src/lib/stripe-readiness.ts kept here to make this script
// dependency-free. src/lib/stripe-cli-parity.test.ts spawns this file and
// asserts the two agree, so the copies cannot drift apart unnoticed.
const EXIT_LIVE_KEY_REFUSED = 87;
const EXIT_FORBIDDEN_FILE = 88;

function parseArgs(argv) {
  const args = { envFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config" || argv[i] === "--stripe-env") args.envFile = argv[++i];
  }
  return args;
}

/** Minimal KEY=VALUE reader. Values are never printed or logged. */
function readEnvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function stripeCliPresent() {
  try {
    // Output is discarded: a CLI banner must never leak into logs.
    execFileSync("stripe", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let env = process.env;
  if (args.envFile) {
    const resolved = path.resolve(REPO_ROOT, args.envFile);
    const name = path.basename(resolved);
    if (/^\.env\.production(\..*)?$/.test(name) || name === ".env.prod") {
      console.error(`Refusing to read ${name}: this preflight never loads production configuration.`);
      process.exit(EXIT_FORBIDDEN_FILE);
    }
    if (!fs.existsSync(resolved)) {
      console.error(`Env file not found: ${args.envFile}`);
      process.exit(1);
    }
    env = { ...readEnvFile(resolved) };
  }

  const picked = {
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    STRIPE_BASIC_PRICE_ID: env.STRIPE_BASIC_PRICE_ID,
    STRIPE_PRO_PRICE_ID: env.STRIPE_PRO_PRICE_ID,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  };

  const report = evaluateReadiness(picked, { stripeCliPresent: stripeCliPresent() });
  console.log(formatReport(report));
  if (report.exitCode === EXIT_LIVE_KEY_REFUSED) {
    console.error("\nRefusing to continue: live-mode credentials must never be used by this tooling.");
  }
  process.exit(report.exitCode);
}

/* ---- Copy of src/lib/stripe-readiness.ts (parity-tested) ---- */
function evaluateReadiness(env, opts) {
  const present = (v) => typeof v === "string" && v.trim().length > 0;
  const mode = !present(env.STRIPE_SECRET_KEY)
    ? "missing"
    : /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY.trim())
      ? "test"
      : /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY.trim())
        ? "live"
        : "unrecognized";
  const basic = present(env.STRIPE_BASIC_PRICE_ID);
  const pro = present(env.STRIPE_PRO_PRICE_ID);
  const distinct = basic && pro && env.STRIPE_BASIC_PRICE_ID.trim() !== env.STRIPE_PRO_PRICE_ID.trim();
  const url = !present(env.NEXT_PUBLIC_APP_URL)
    ? "missing"
    : /^https?:\/\/(localhost|127\.0\.0\.1)/.test(env.NEXT_PUBLIC_APP_URL.trim().toLowerCase())
      ? "localhost"
      : env.NEXT_PUBLIC_APP_URL.includes("vercel.app")
        ? "preview"
        : "production";
  if (mode === "live") {
    return {
      secretKeyMode: mode, webhookSecretPresent: present(env.STRIPE_WEBHOOK_SECRET),
      basicPricePresent: basic, proPricePresent: pro, pricesDistinct: distinct, appUrl: url,
      stripeCliPresent: opts.stripeCliPresent, ready: false, exitCode: EXIT_LIVE_KEY_REFUSED,
      problems: ["A LIVE Stripe secret key is configured. This tooling refuses to run against live mode."],
    };
  }
  const problems = [];
  if (mode !== "test") problems.push(`STRIPE_SECRET_KEY is ${mode} (need a test-mode key).`);
  if (!present(env.STRIPE_WEBHOOK_SECRET)) problems.push("STRIPE_WEBHOOK_SECRET is missing.");
  if (!basic) problems.push("STRIPE_BASIC_PRICE_ID is missing.");
  if (!pro) problems.push("STRIPE_PRO_PRICE_ID is missing.");
  if (basic && pro && !distinct) problems.push("Basic and Pro price IDs are identical.");
  if (url === "missing") problems.push("NEXT_PUBLIC_APP_URL is missing.");
  if (url === "production") problems.push("NEXT_PUBLIC_APP_URL looks like production.");
  if (!opts.stripeCliPresent) problems.push("Stripe CLI not found.");
  const ready = problems.length === 0;
  return {
    secretKeyMode: mode, webhookSecretPresent: present(env.STRIPE_WEBHOOK_SECRET),
    basicPricePresent: basic, proPricePresent: pro, pricesDistinct: distinct, appUrl: url,
    stripeCliPresent: opts.stripeCliPresent, ready, exitCode: ready ? 0 : 1, problems,
  };
}

function formatReport(r) {
  const yes = (b) => (b ? "present" : "MISSING");
  return [
    "MatFlow Stripe test-mode readiness (configuration shape only — no values printed)",
    "",
    `  Secret key mode ......... ${r.secretKeyMode}`,
    `  Webhook secret .......... ${yes(r.webhookSecretPresent)}`,
    `  Basic price ID .......... ${yes(r.basicPricePresent)}`,
    `  Pro price ID ............ ${yes(r.proPricePresent)}`,
    `  Prices distinct ......... ${r.pricesDistinct ? "yes" : "no"}`,
    `  App URL ................. ${r.appUrl}`,
    `  Stripe CLI .............. ${yes(r.stripeCliPresent)}`,
    "",
    r.ready ? "  READY: complete test-mode configuration." : "  NOT READY:",
    ...r.problems.map((p) => `    - ${p}`),
  ].join("\n");
}

main();
