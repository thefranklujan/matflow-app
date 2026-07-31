#!/usr/bin/env node
/**
 * Stripe test-mode subscription lifecycle runner.
 *
 * DRY RUN BY DEFAULT. Without --execute-test-mode this process creates,
 * modifies, and deletes nothing: it prints the plan and exits.
 *
 *   npm run stripe:lifecycle                      # dry run, inherited env
 *   npm run stripe:lifecycle -- --config .env.stripe-test
 *   node scripts/stripe-lifecycle.mjs --config .env.stripe-test --execute-test-mode
 *
 * The flag is --config, not --env-file: Node itself consumes --env-file
 * (v20.6+) before the script ever sees it.
 *
 * Refuses, always: live secret keys, a production NEXT_PUBLIC_APP_URL, a
 * non-local test database, a missing webhook secret, and missing or identical
 * price IDs. It never creates Stripe products or prices — prices are a
 * business decision made once by a human in the Dashboard.
 *
 * Exit codes: 0 ok, 1 refused/incomplete, 87 live credential refused,
 * 88 forbidden env file.
 */

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const STAGES_FILE = path.join(REPO_ROOT, "src/lib/stripe-lifecycle-stages.json");
const MANIFEST_FILE = path.join(REPO_ROOT, ".stripe-test-objects.json");

const EXIT_OK = 0;
const EXIT_REFUSED = 1;
const EXIT_LIVE_REFUSED = 87;
const EXIT_FORBIDDEN_FILE = 88;

const TEST_IDENTITY_DOMAIN = "stripe-test.matflow.test";

/**
 * Guard logic is intentionally duplicated from src/lib/stripe-lifecycle.ts so
 * this runner needs no build step and no dependencies. src/lib/stripe-cli-parity.test.ts
 * spawns this file and asserts the two agree, so the copies cannot drift.
 */
function classifySecretKey(value) {
  if (typeof value !== "string" || value.trim() === "") return "missing";
  const v = value.trim();
  if (/^(sk|rk)_test_/.test(v)) return "test";
  if (/^(sk|rk)_live_/.test(v)) return "live";
  return "unrecognized";
}

function classifyAppUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return "missing";
  const v = value.trim().toLowerCase();
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(v)) return "localhost";
  if (v.includes("vercel.app") || v.includes("-preview") || v.includes("staging")) return "preview";
  return "production";
}

function isLocalDatabaseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  let host;
  try {
    host = new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function present(v) {
  return typeof v === "string" && v.trim() !== "";
}

function planLifecycle(env, opts) {
  const secretKeyMode = classifySecretKey(env.STRIPE_SECRET_KEY);
  const appUrl = classifyAppUrl(env.NEXT_PUBLIC_APP_URL);
  const databaseIsLocal = isLocalDatabaseUrl(env.E2E_DATABASE_URL);
  const mode = opts.execute ? "execute" : "dry-run";
  const stages = JSON.parse(fs.readFileSync(STAGES_FILE, "utf8"));

  if (secretKeyMode === "live") {
    return {
      mode, secretKeyMode, appUrl, databaseIsLocal, stages,
      refusals: [{ code: "LIVE_KEY", message: "A LIVE Stripe secret key is configured. This harness never runs against live mode." }],
      allowed: false, exitCode: EXIT_LIVE_REFUSED,
    };
  }

  const refusals = [];
  if (secretKeyMode !== "test") {
    refusals.push({ code: "NOT_A_TEST_KEY", message: `STRIPE_SECRET_KEY is ${secretKeyMode}; a test-mode key is required.` });
  }
  if (!present(env.STRIPE_WEBHOOK_SECRET)) {
    refusals.push({ code: "MISSING_WEBHOOK_SECRET", message: "STRIPE_WEBHOOK_SECRET is missing; webhook signatures could not be verified." });
  }
  if (!present(env.STRIPE_BASIC_PRICE_ID) || !present(env.STRIPE_PRO_PRICE_ID)) {
    refusals.push({ code: "MISSING_PRICE_IDS", message: "Both STRIPE_BASIC_PRICE_ID and STRIPE_PRO_PRICE_ID are required; the harness never creates prices." });
  } else if (env.STRIPE_BASIC_PRICE_ID.trim() === env.STRIPE_PRO_PRICE_ID.trim()) {
    refusals.push({ code: "IDENTICAL_PRICE_IDS", message: "Basic and Pro price IDs are identical; the plan-switch stages would prove nothing." });
  }
  if (appUrl === "production") {
    refusals.push({ code: "PRODUCTION_APP_URL", message: "NEXT_PUBLIC_APP_URL points at production; webhooks would be delivered to real customers' app." });
  }
  if (!databaseIsLocal) {
    refusals.push({ code: "PRODUCTION_DATABASE", message: "E2E_DATABASE_URL is missing or not a localhost database; the harness only mutates the isolated test database." });
  }
  if (!present(env.STRIPE_SANDBOX_FINGERPRINT)) {
    refusals.push({ code: "MISSING_SANDBOX_FINGERPRINT", message: "No approved sandbox fingerprint is pinned; the target account cannot be proven." });
  }
  if (!present(env.STRIPE_PORTAL_CONFIGURATION_ID)) {
    refusals.push({ code: "MISSING_PORTAL_CONFIGURATION", message: "STRIPE_PORTAL_CONFIGURATION_ID is missing; plan switching could not be proven against a known catalog." });
  }

  const allowed = refusals.length === 0;
  return { mode, secretKeyMode, appUrl, databaseIsLocal, stages, refusals, allowed, exitCode: allowed ? EXIT_OK : EXIT_REFUSED };
}

function formatPlan(plan) {
  const lines = [
    `MatFlow Stripe lifecycle — ${plan.mode.toUpperCase()} (no values printed)`,
    "",
    `  Secret key mode ......... ${plan.secretKeyMode}`,
    `  App URL ................. ${plan.appUrl}`,
    `  Test database is local .. ${plan.databaseIsLocal ? "yes" : "no"}`,
    "",
  ];
  if (plan.refusals.length > 0) {
    lines.push("  REFUSED:");
    for (const r of plan.refusals) lines.push(`    - [${r.code}] ${r.message}`);
    lines.push("");
  }
  lines.push(`  Stages (${plan.stages.length}):`);
  for (const stage of plan.stages) {
    lines.push(`    ${String(stage.order).padStart(2, " ")}. [${stage.kind.toUpperCase().padEnd(6)}] ${stage.title}`);
    lines.push(`        proves: ${stage.proves}`);
  }
  lines.push("");
  lines.push(
    plan.mode === "dry-run"
      ? "  Dry run: nothing was created, modified, or deleted. Pass --execute-test-mode to run for real."
      : plan.allowed
        ? "  Execution permitted by guards."
        : "  Execution BLOCKED by the refusals above.",
  );
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = { envFile: null, execute: false, runLabel: "gate1" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config" || argv[i] === "--stripe-env") args.envFile = argv[++i];
    else if (argv[i] === "--execute-test-mode") args.execute = true;
    else if (argv[i] === "--label") args.runLabel = argv[++i];
  }
  return args;
}

/** Minimal KEY=VALUE reader. Values are never printed or logged. */
function readEnvFile(file) {
  const out = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let env = process.env;
  if (args.envFile) {
    const resolved = path.resolve(REPO_ROOT, args.envFile);
    const name = path.basename(resolved);
    if (/^\.env\.production(\..*)?$/.test(name) || name === ".env.prod") {
      console.error(`Refusing to read ${name}: this harness never loads production configuration.`);
      process.exit(EXIT_FORBIDDEN_FILE);
    }
    if (!fs.existsSync(resolved)) {
      console.error(`Env file not found: ${args.envFile}`);
      process.exit(EXIT_REFUSED);
    }
    env = readEnvFile(resolved);
  }

  const plan = planLifecycle(
    {
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
      STRIPE_BASIC_PRICE_ID: env.STRIPE_BASIC_PRICE_ID,
      STRIPE_PRO_PRICE_ID: env.STRIPE_PRO_PRICE_ID,
      NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
      E2E_DATABASE_URL: env.E2E_DATABASE_URL,
      STRIPE_SANDBOX_FINGERPRINT: env.STRIPE_SANDBOX_FINGERPRINT,
      STRIPE_PORTAL_CONFIGURATION_ID: env.STRIPE_PORTAL_CONFIGURATION_ID,
    },
    { execute: args.execute },
  );

  console.log(formatPlan(plan));

  if (plan.exitCode === EXIT_LIVE_REFUSED) {
    console.error("\nRefusing to continue: live-mode credentials must never be used by this tooling.");
    process.exit(EXIT_LIVE_REFUSED);
  }
  if (!plan.allowed) process.exit(EXIT_REFUSED);

  if (!args.execute) {
    console.log(`\nTest identities would use @${TEST_IDENTITY_DOMAIN} (non-routable).`);
    console.log(`Created objects would be recorded in ${path.basename(MANIFEST_FILE)} (git-ignored) for cleanup.`);
    process.exit(EXIT_OK);
  }

  // --execute-test-mode passed and every guard allowed it. The mutating
  // implementation is deliberately not present yet: it is gated on Frank
  // supplying test-mode keys and price IDs (see MATFLOW-STRIPE-LAUNCH-GATE.md).
  // Exiting non-zero here means a green run can never be mistaken for a
  // completed lifecycle.
  console.error(
    "\n--execute-test-mode was accepted by the guards, but the mutating stages are not implemented.\n" +
      "This is intentional: the lifecycle has never been run, and no result may be reported as Verified.\n" +
      "See MATFLOW-STRIPE-LAUNCH-GATE.md for what Frank must supply first.",
  );
  process.exit(EXIT_REFUSED);
}

main();
