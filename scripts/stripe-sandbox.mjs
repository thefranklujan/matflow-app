#!/usr/bin/env node
/**
 * MatFlow Stripe SANDBOX runner.
 *
 * This is the only script in the repository that mutates Stripe, and it will
 * only ever do so inside the one approved sandbox.
 *
 *   npm run stripe:sandbox -- --pin                          # verify + pin the sandbox
 *   npm run stripe:sandbox -- --provision-sandbox-catalog    # products, prices, portal
 *   npm run stripe:sandbox -- --execute-test-mode            # run the lifecycle
 *
 * Safety posture, in order of precedence:
 *
 *   1. A live-mode key is refused outright (exit 87), before anything else.
 *   2. The account must match the pinned sandbox fingerprint (exit 89).
 *      "I meant to be in test mode" is not a safety property; the machine's
 *      default Stripe CLI profile is authenticated to a live-capable account.
 *   3. Every mutating command additionally requires an explicit flag.
 *
 * No Stripe id, key, or account identifier is ever printed. Reports use the
 * aliases recorded in the git-ignored manifest.
 *
 * IMPORTANT: as of this commit the mutating paths below have NEVER been run —
 * the approved sandbox does not exist yet. Treat every result as unproven
 * until an actual run says otherwise.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import Stripe from "stripe";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.stripe-test");
const MANIFEST_FILE = path.join(REPO_ROOT, ".stripe-test-objects.json");

const EXIT_OK = 0;
const EXIT_REFUSED = 1;
const EXIT_LIVE_REFUSED = 87;
const EXIT_SANDBOX_MISMATCH = 89;

const APPROVED_SANDBOX_NAME = "MatFlow Billing QA";
const SANDBOX_METADATA_KEY = "matflow_sandbox_qa";
const SANDBOX_METADATA_VALUE = "v1";
const PLANS = {
  basic: { product: "MatFlow Basic", unitAmount: 4900 },
  pro: { product: "MatFlow Pro", unitAmount: 9900 },
};
const CURRENCY = "usd";
const INTERVAL = "month";
const TAX_BEHAVIOR = "exclusive";

/* ------------------------------- utilities ------------------------------- */

function fingerprintAccount(accountId) {
  return createHash("sha256").update(`matflow-sandbox-guard:v1:${accountId.trim()}`).digest("hex").slice(0, 32);
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
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

/** Rewrite one key in .env.stripe-test without ever printing the value. */
function writeEnvValue(key, value) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split("\n") : [];
  let replaced = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) { replaced = true; return `${key}=${value}`; }
    return line;
  });
  if (!replaced) next.push(`${key}=${value}`);
  fs.writeFileSync(ENV_FILE, next.join("\n").replace(/\n+$/, "") + "\n", { mode: 0o600 });
  fs.chmodSync(ENV_FILE, 0o600);
  console.log(`  wrote ${key} to .env.stripe-test (value not shown)`);
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(MANIFEST_FILE, 0o600);
}

function recordObject(manifest, record) {
  manifest.objects = manifest.objects.filter((o) => o.alias !== record.alias);
  manifest.objects.push(record);
  saveManifest(manifest);
}


/** Template placeholders are NOT filled-in values. Kept in sync with
 * src/lib/stripe-readiness.ts; src/lib/stripe-cli-parity.test.ts spawns this
 * file and asserts the two agree. */
const PLACEHOLDER_PATTERNS = [/REPLACE_ME/i, /USER:PASSWORD/i];
function isPlaceholder(v) {
  return typeof v === "string" && PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

function classifyKey(value) {
  if (typeof value !== "string" || value.trim() === "") return "missing";
  if (isPlaceholder(value)) return "placeholder";
  const v = value.trim();
  if (/^(sk|rk)_test_/.test(v)) return "test";
  if (/^(sk|rk)_live_/.test(v)) return "live";
  return "unrecognized";
}

/* --------------------------------- guards -------------------------------- */

/**
 * Establish a Stripe client bound to a PROVEN sandbox.
 *
 * `requirePin` is false only for --pin itself, which is the command that
 * establishes the pin in the first place.
 */
async function openSandbox(env, { requirePin = true } = {}) {
  const mode = classifyKey(env.STRIPE_SECRET_KEY);
  if (mode === "live") {
    console.error("Refusing to continue: a LIVE Stripe key is configured. This tooling never runs against live mode.");
    process.exit(EXIT_LIVE_REFUSED);
  }
  // Caught before any network call: an unfilled template must not cost a
  // doomed round trip to Stripe, and the message must say what is actually
  // wrong rather than "authentication failed".
  if (mode === "placeholder") {
    console.error("STRIPE_SECRET_KEY is still the template placeholder. Fill in .env.stripe-test with sandbox values first.");
    process.exit(EXIT_REFUSED);
  }
  if (mode !== "test") {
    console.error(`STRIPE_SECRET_KEY is ${mode}; a sandbox test-mode key is required.`);
    process.exit(EXIT_REFUSED);
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });

  // A harmless read that also proves which account the key belongs to.
  let account;
  try {
    account = await stripe.accounts.retrieve();
  } catch (err) {
    console.error(`Could not read the Stripe account: ${err?.type ?? "request failed"}`);
    process.exit(EXIT_REFUSED);
  }

  const current = fingerprintAccount(account.id);
  const pinned = env.STRIPE_SANDBOX_FINGERPRINT?.trim();

  if (!pinned) {
    if (requirePin) {
      console.error(`No approved sandbox is pinned. Run --pin while authenticated to "${APPROVED_SANDBOX_NAME}" first.`);
      process.exit(EXIT_SANDBOX_MISMATCH);
    }
    return { stripe, currentFingerprint: current, pinned: null };
  }
  if (pinned !== current) {
    console.error(`The current Stripe account is NOT the approved "${APPROVED_SANDBOX_NAME}" sandbox. Refusing to act.`);
    process.exit(EXIT_SANDBOX_MISMATCH);
  }
  return { stripe, currentFingerprint: current, pinned };
}

/* -------------------------------- commands ------------------------------- */

async function cmdPin(env) {
  console.log(`Pinning the approved sandbox ("${APPROVED_SANDBOX_NAME}")...\n`);
  const { currentFingerprint, pinned } = await openSandbox(env, { requirePin: false });

  if (pinned && pinned !== currentFingerprint) {
    console.error("A DIFFERENT sandbox is already pinned. Refusing to silently re-point this repository.");
    console.error("Clear STRIPE_SANDBOX_FINGERPRINT by hand if the change is deliberate.");
    process.exit(EXIT_SANDBOX_MISMATCH);
  }
  if (pinned === currentFingerprint) {
    console.log("  Already pinned to this account. Nothing to do.");
    return EXIT_OK;
  }

  writeEnvValue("STRIPE_SANDBOX_FINGERPRINT", currentFingerprint);
  console.log(`\n  Pinned. Only this account may be mutated from now on.`);
  console.log("  Confirm in the Stripe Dashboard that this key belongs to the sandbox named above.");
  return EXIT_OK;
}

/**
 * Create or reuse the sandbox catalog.
 *
 * Idempotent by construction: it searches for an object carrying this tooling's
 * metadata marker before creating anything, and refuses to guess when more than
 * one candidate matches.
 */
async function cmdProvisionCatalog(env) {
  console.log("Provisioning the sandbox catalog...\n");
  const { stripe, currentFingerprint } = await openSandbox(env);

  const manifest = loadManifest() ?? {
    version: 1,
    runLabel: "catalog",
    sandboxFingerprint: currentFingerprint,
    stages: [],
    objects: [],
  };

  const resolved = {};
  for (const [plan, spec] of Object.entries(PLANS)) {
    // Products: match on our own metadata marker, never on name alone.
    const products = await stripe.products.search({
      query: `metadata['${SANDBOX_METADATA_KEY}']:'${SANDBOX_METADATA_VALUE}' AND metadata['matflow_plan']:'${plan}' AND active:'true'`,
      limit: 3,
    });
    if (products.data.length > 1) {
      console.error(`  More than one sandbox product matches ${plan}. Reconcile the sandbox before continuing.`);
      process.exit(EXIT_REFUSED);
    }

    let product = products.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: spec.product,
        metadata: { [SANDBOX_METADATA_KEY]: SANDBOX_METADATA_VALUE, matflow_plan: plan },
      });
      console.log(`  created product alias=${plan}_product`);
    } else {
      console.log(`  reused product alias=${plan}_product`);
    }
    recordObject(manifest, { alias: `${plan}_product`, kind: "product", id: product.id, disposable: false });

    // Prices: only an EXACT match is reusable. Amount, currency, interval, and
    // tax behavior all have to agree, or the lifecycle would prove nothing.
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const exact = prices.data.filter(
      (p) =>
        p.unit_amount === spec.unitAmount &&
        p.currency?.toLowerCase() === CURRENCY &&
        p.recurring?.interval === INTERVAL &&
        p.tax_behavior === TAX_BEHAVIOR,
    );
    if (exact.length > 1) {
      console.error(`  More than one active ${plan} price matches. Reconcile the sandbox before continuing.`);
      process.exit(EXIT_REFUSED);
    }

    let price = exact[0];
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: CURRENCY,
        unit_amount: spec.unitAmount,
        recurring: { interval: INTERVAL },
        tax_behavior: TAX_BEHAVIOR,
        metadata: { [SANDBOX_METADATA_KEY]: SANDBOX_METADATA_VALUE, matflow_plan: plan },
      });
      console.log(`  created price alias=${plan}_price`);
    } else {
      console.log(`  reused price alias=${plan}_price`);
    }
    recordObject(manifest, { alias: `${plan}_price`, kind: "price", id: price.id, disposable: false });
    resolved[plan] = price;
  }

  if (resolved.basic.product === resolved.pro.product) {
    console.error("  Basic and Pro resolved to the same product; the portal cannot switch between them.");
    process.exit(EXIT_REFUSED);
  }

  writeEnvValue("STRIPE_BASIC_PRICE_ID", resolved.basic.id);
  writeEnvValue("STRIPE_PRO_PRICE_ID", resolved.pro.id);

  // Portal configuration, scoped to exactly the two prices above.
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const owned = configurations.data.filter((c) => c.metadata?.[SANDBOX_METADATA_KEY] === SANDBOX_METADATA_VALUE);
  if (owned.length > 1) {
    console.error("  More than one sandbox portal configuration exists. Reconcile before continuing.");
    process.exit(EXIT_REFUSED);
  }

  const features = {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products: [
        { product: resolved.basic.product, prices: [resolved.basic.id] },
        { product: resolved.pro.product, prices: [resolved.pro.id] },
      ],
    },
  };

  let configuration = owned[0];
  if (configuration) {
    configuration = await stripe.billingPortal.configurations.update(configuration.id, { features });
    console.log("  updated portal configuration alias=sandbox_portal");
  } else {
    configuration = await stripe.billingPortal.configurations.create({
      features,
      business_profile: { headline: "MatFlow sandbox QA" },
      metadata: { [SANDBOX_METADATA_KEY]: SANDBOX_METADATA_VALUE },
    });
    console.log("  created portal configuration alias=sandbox_portal");
  }
  recordObject(manifest, { alias: "sandbox_portal", kind: "portal_configuration", id: configuration.id, disposable: false });
  writeEnvValue("STRIPE_PORTAL_CONFIGURATION_ID", configuration.id);

  console.log("\n  Catalog ready. The default (live) portal configuration was not touched.");
  return EXIT_OK;
}

/**
 * Run the lifecycle.
 *
 * Not implemented as an unattended script on purpose. The lifecycle needs a
 * running local app, `stripe listen` forwarding, and browser interaction for
 * hosted Checkout and the Customer Portal — none of which can be assembled
 * safely without the sandbox existing first. Exiting non-zero here guarantees
 * a green run can never be mistaken for a completed lifecycle.
 */
async function cmdExecute(env) {
  await openSandbox(env);
  console.error(
    "\nGuards passed, but the mutating lifecycle stages are not implemented yet.\n" +
      `They are blocked on the "${APPROVED_SANDBOX_NAME}" sandbox existing and being pinned.\n` +
      "See MATFLOW-STRIPE-LAUNCH-GATE.md for the exact remaining steps.\n" +
      "No stage may be reported as Verified until an actual run says so.",
  );
  return EXIT_REFUSED;
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  const argv = process.argv.slice(2);
  const env = { ...readEnvFile(ENV_FILE) };

  if (!fs.existsSync(ENV_FILE)) {
    console.error(".env.stripe-test not found. Copy .env.stripe-test.example and fill in sandbox values.");
    process.exit(EXIT_REFUSED);
  }
  const mode = fs.statSync(ENV_FILE).mode & 0o777;
  if (mode !== 0o600) {
    console.error(`.env.stripe-test must be mode 600 (currently ${mode.toString(8)}). Run: chmod 600 .env.stripe-test`);
    process.exit(EXIT_REFUSED);
  }

  if (argv.includes("--pin")) process.exit(await cmdPin(env));
  if (argv.includes("--provision-sandbox-catalog")) process.exit(await cmdProvisionCatalog(env));
  if (argv.includes("--execute-test-mode")) process.exit(await cmdExecute(env));

  console.log("MatFlow Stripe sandbox runner. Nothing was created, modified, or deleted.\n");
  console.log("  --pin                          verify and pin the approved sandbox");
  console.log("  --provision-sandbox-catalog    create or reuse products, prices, portal config");
  console.log("  --execute-test-mode            run the lifecycle (requires a pinned sandbox)");
  process.exit(EXIT_OK);
}

main();
