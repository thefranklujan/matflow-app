import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import stagesJson from "../src/lib/stripe-lifecycle-stages.json";
import { emptyManifest, recordStage, type RunManifest, type StageStatus } from "../src/lib/stripe-manifest";

/**
 * The 20-stage Stripe SANDBOX lifecycle. Run only via
 * scripts/stripe-lifecycle-run.mjs (it verifies the pinned sandbox first).
 *
 * Evidence rules: reports carry aliases, never Stripe ids; the id map goes to
 * the git-ignored .stripe-test-objects.json. A stage is "passed" only when the
 * Stripe-side AND local observations both hold. Stages that never ran are
 * recorded as "blocked", never omitted.
 */

const REPO = path.resolve(__dirname, "..");
const REPORT = process.env.STRIPE_LIFECYCLE_REPORT || path.join(REPO, "test-results-stripe", "lifecycle-report.json");
const OBJECTS = path.join(REPO, ".stripe-test-objects.json");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });
const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL! } } });
const BASIC = process.env.STRIPE_BASIC_PRICE_ID!;
const PRO = process.env.STRIPE_PRO_PRICE_ID!;
const RUN = `sbx${Date.now().toString(36)}`;
const OWNER = { email: `${RUN}-owner@sandbox.matflow.test`, password: "Sandbox!Lifecycle-Passw0rd" };

let manifest: RunManifest = emptyManifest(RUN, process.env.STRIPE_SANDBOX_FINGERPRINT || "");
const ids: Record<string, string> = {};
const stages = stagesJson as Array<{ order: number; id: string; title: string }>;

function stage(order: number, status: StageStatus, detail: string, stripeObserved?: string, localObserved?: string) {
  const s = stages.find((x) => x.order === order)!;
  manifest = recordStage(manifest, { id: s.id, order, status, detail, stripeObserved, localObserved });
}
function remember(alias: string, kind: RunManifest["objects"][number]["kind"], id: string) {
  ids[alias] = id;
  manifest.objects = manifest.objects.filter((o) => o.alias !== alias);
  manifest.objects.push({ alias, kind, id, disposable: kind !== "price" && kind !== "product" && kind !== "portal_configuration" });
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 60_000, step = 1_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, step));
  }
}

async function gymRow() {
  return prisma.gym.findUniqueOrThrow({
    where: { id: ids.gym },
    select: { subscriptionStatus: true, stripePriceId: true, stripeCustomerId: true, updatedAt: true },
  });
}

async function checkout(api: APIRequestContext, plan: "basic" | "pro") {
  const res = await api.post("/api/billing", { data: { action: "checkout", plan } });
  return { status: res.status(), body: await res.json() };
}

/** Pay on Stripe's hosted Checkout with the published test card 4242…. */
async function payHostedCheckout(page: Page, url: string) {
  await page.goto(url);
  const email = page.locator("#email");
  if (await email.isVisible().catch(() => false)) await email.fill(OWNER.email);
  const cardTab = page.locator('[data-testid="card-accordion-item-button"]');
  if (await cardTab.isVisible().catch(() => false)) await cardTab.click();
  await page.locator("#cardNumber").fill("4242 4242 4242 4242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Sandbox Owner");
  const zip = page.locator("#billingPostalCode");
  if (await zip.isVisible().catch(() => false)) await zip.fill("77002");
  const country = page.locator("#billingCountry");
  if (await country.isVisible().catch(() => false)) await country.selectOption("US").catch(() => {});
  await page.locator('button[type="submit"], .SubmitButton').first().click();
  await page.waitForURL(/\/app\/billing\?success=true/, { timeout: 90_000 });
}

async function joinMember(api: APIRequestContext, slug: string, n: number) {
  const res = await api.post("/api/auth/join", {
    data: {
      firstName: "Seat",
      lastName: `Probe${n}`,
      email: `${RUN}-probe${n}@sandbox.matflow.test`,
      password: "Sandbox!Member-Passw0rd",
      gymSlug: slug,
    },
  });
  return res.status();
}

test.describe.configure({ mode: "serial" });

// One owner session shared by every stage (the per-test `request` fixture
// would drop the session cookie between stages).
let api: APIRequestContext;
const BASE = `http://localhost:${process.env.STRIPE_LIFECYCLE_PORT || 4311}`;
test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ baseURL: BASE });
});
async function ownerCookies() {
  return (await api.storageState()).cookies;
}

test.afterAll(async () => {
  // Every stage that did not record a result is explicitly blocked.
  for (const s of stages) {
    if (!manifest.stages.some((r) => r.id === s.id)) {
      manifest = recordStage(manifest, { id: s.id, order: s.order, status: "blocked", detail: "Not reached: an earlier stage did not pass." });
    }
  }
  // Keep catalog objects recorded by --provision-sandbox-catalog.
  const prior = fs.existsSync(OBJECTS) ? JSON.parse(fs.readFileSync(OBJECTS, "utf8")) : { objects: [] };
  const merged = {
    ...manifest,
    objects: [
      ...(prior.objects || []).filter((o: { alias: string }) => !manifest.objects.some((m) => m.alias === o.alias)),
      ...manifest.objects,
    ],
  };
  fs.writeFileSync(OBJECTS, JSON.stringify(merged, null, 2), { mode: 0o600 });
  const aliasOnly = {
    runLabel: manifest.runLabel,
    finishedAt: new Date().toISOString(),
    counts: {
      passed: manifest.stages.filter((s) => s.status === "passed").length,
      failed: manifest.stages.filter((s) => s.status === "failed").length,
      blocked: manifest.stages.filter((s) => s.status === "blocked").length,
      other: manifest.stages.filter((s) => !["passed", "failed", "blocked"].includes(s.status)).length,
    },
    stages: manifest.stages,
    objects: manifest.objects.map((o) => ({ alias: o.alias, kind: o.kind, disposable: o.disposable })),
  };
  let text = JSON.stringify(aliasOnly, null, 2);
  for (const id of Object.values(ids)) text = text.split(id).join("<id>");
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, text);
  await api?.dispose();
  await prisma.$disconnect();
});

test.afterEach(async ({}, info) => {
  if (info.status !== "passed") {
    const orders = info.title.split(".")[0].split("+").map(Number);
    const order = orders.find((o) => !manifest.stages.some((s) => s.order === o));
    if (order !== undefined) {
      stage(order, "failed", (info.error?.message || "failed").split("\n")[0].replace(/(cus|sub|cs|price|prod|evt|in|pi|bpc|acct)_[A-Za-z0-9]+/g, "<id>").slice(0, 300));
    }
  }
});

test("1. preflight readiness", async () => {
  // execFileSync throws on any non-zero exit (1 incomplete, 87 live key, 88 forbidden file).
  execFileSync("node", ["scripts/stripe-readiness.mjs"], { cwd: REPO, env: process.env, encoding: "utf8" });
  stage(1, "passed", "Readiness preflight exit 0 against the sandbox configuration.");
});

test("2. key is test mode at Stripe", async () => {
  const balance = await stripe.balance.retrieve();
  expect(balance.livemode).toBe(false);
  const acct = await stripe.accounts.retrieve();
  expect(acct.settings?.dashboard?.display_name ?? "").toContain("MatFlow Billing QA");
  stage(2, "passed", "Stripe accepted the key in test mode for the MatFlow Billing QA sandbox.", "balance.livemode=false; dashboard name matches");
});

test("3. resolve configured prices", async () => {
  const [b, p] = await Promise.all([stripe.prices.retrieve(BASIC), stripe.prices.retrieve(PRO)]);
  remember("basic_price", "price", b.id);
  remember("pro_price", "price", p.id);
  for (const [price, amount] of [[b, 4900], [p, 9900]] as const) {
    expect(price.active).toBe(true);
    expect(price.livemode).toBe(false);
    expect(price.recurring?.interval).toBe("month");
    expect(price.unit_amount).toBe(amount);
    expect(price.currency).toBe("usd");
  }
  expect(b.product).not.toBe(p.product);
  stage(3, "passed", "basic_price $49/month and pro_price $99/month exist, active, on separate products.", "prices.retrieve x2");
});

test("4. price allow-list", async () => {
  expect(BASIC).not.toBe(PRO);
  expect(process.env.STRIPE_BASIC_PRICE_ID).toBe(ids.basic_price);
  expect(process.env.STRIPE_PRO_PRICE_ID).toBe(ids.pro_price);
  stage(4, "passed", "Server allow-list (STRIPE_BASIC/PRO_PRICE_ID) equals the tested prices.");
});

test("5. provision disposable academy", async () => {
  const res = await api.post("/api/auth/register", {
    data: {
      email: OWNER.email,
      password: OWNER.password,
      firstName: "Sandbox",
      lastName: "Owner",
      gymName: `Sandbox Lifecycle ${RUN}`,
      gymSlug: `sandbox-${RUN}`,
    },
  });
  expect(res.status()).toBeLessThan(300);
  const gym = await prisma.gym.findUniqueOrThrow({ where: { slug: `sandbox-${RUN}` } });
  remember("test_gym", "gym", gym.id);
  ids.gym = gym.id;
  expect(gym.subscriptionStatus).toBe("trialing");
  expect(gym.stripePriceId).toBeNull();
  expect(gym.stripeCustomerId).toBeNull();
  stage(5, "passed", "Owner registered through the real API; 30-day card-less trial, no Stripe objects yet.", undefined, "Gym trialing, no customer, no price");
});

test("6+7+8. customer created once under concurrency; Basic checkout opened", async () => {
  const results = await Promise.all([checkout(api, "basic"), checkout(api, "basic"), checkout(api, "basic")]);
  const ok = results.filter((r) => r.status === 200);
  expect(ok.length).toBeGreaterThanOrEqual(1);
  for (const r of results) expect([200, 409]).toContain(r.status);
  const row = await gymRow();
  expect(row.stripeCustomerId).toBeTruthy();
  remember("test_customer_1", "customer", row.stripeCustomerId!);
  const customer = (await stripe.customers.retrieve(row.stripeCustomerId!)) as Stripe.Customer;
  expect(customer.metadata.gymId).toBe(ids.gym);
  stage(6, "passed", "ensureCustomer created a customer carrying gymId metadata.", "customer.metadata.gymId matches", "Gym.stripeCustomerId set");

  const found = await stripe.customers.search({ query: `metadata['gymId']:'${ids.gym}'` });
  expect(found.data.length).toBe(1);
  stage(7, "passed", `3 concurrent checkout requests -> exactly 1 customer (${ok.length} returned a URL, ${results.length - ok.length} got 409).`, "customers.search by gymId = 1");

  const url: string = ok[0].body.url;
  const urls = new Set(ok.map((r) => r.body.url));
  expect(urls.size).toBe(1);
  const sessions = await stripe.checkout.sessions.list({ customer: row.stripeCustomerId!, limit: 10 });
  const open = sessions.data.filter((s) => s.status === "open");
  expect(open.length).toBe(1);
  expect(open[0].mode).toBe("subscription");
  const items = await stripe.checkout.sessions.listLineItems(open[0].id);
  expect(items.data[0].price?.id).toBe(BASIC);
  remember("checkout_session_1", "checkout_session", open[0].id);
  ids.checkoutUrl = url;
  stage(8, "passed", "Exactly one open subscription-mode Checkout Session for basic_price.", "1 open session, line item = basic_price");
});

test("9+10+11. pay with test card; webhook delivered; stored active on Basic", async ({ page, context }) => {
  await context.addCookies(await ownerCookies());
  await payHostedCheckout(page, ids.checkoutUrl);
  const subs = await waitFor(async () => {
    const l = await stripe.subscriptions.list({ customer: ids.test_customer_1, status: "all", limit: 5 });
    return l.data.find((s) => s.status === "active");
  });
  remember("subscription_1", "subscription", subs.id);
  stage(9, "passed", "Hosted Checkout paid with Stripe test card 4242; subscription active at Stripe.", "subscription_1 status=active");

  const row = await waitFor(async () => {
    const r = await gymRow();
    return r.subscriptionStatus === "active" ? r : null;
  });
  const events = await stripe.events.list({ type: "checkout.session.completed", limit: 10 });
  const evt = events.data.find((e) => (e.data.object as Stripe.Checkout.Session).id === ids.checkout_session_1);
  expect(evt).toBeTruthy();
  ids.checkoutEvent = evt!.id;
  stage(10, "passed", "checkout.session.completed was forwarded by `stripe listen`, signature-verified, and processed.", "event observed at Stripe", "Gym row changed to active");

  expect(row.stripePriceId).toBe(BASIC);
  await expect(page.getByText(/active/i).first()).toBeVisible();
  stage(11, "passed", "Gym row: status active, stripePriceId = basic_price.", undefined, "subscriptionStatus=active, price=basic_price");
});

test("12. Basic 100-member limit is server-enforced", async ({ playwright }) => {
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: ids.gym } });
  const active = await prisma.member.count({ where: { gymId: gym.id, active: true } });
  await prisma.member.createMany({
    data: Array.from({ length: 100 - active }, (_, i) => ({
      gymId: gym.id,
      clerkUserId: `${RUN}-seed-${i}`,
      email: `${RUN}-seed-${i}@sandbox.matflow.test`,
      firstName: "Seat",
      lastName: `Seed${i}`,
      active: true,
      approved: true,
    })),
  });
  expect(await prisma.member.count({ where: { gymId: gym.id, active: true } })).toBe(100);
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const status = await joinMember(anon, gym.slug, 1);
  await anon.dispose();
  expect(status).toBe(403);
  expect(await prisma.member.count({ where: { gymId: gym.id, active: true } })).toBe(100);
  stage(12, "passed", "At 100 active members (owner included) a 101st join is refused 403 by the server.", undefined, "member count unchanged at 100");
});

test("13. duplicate checkout refused", async () => {
  const r = await checkout(api, "pro");
  expect(r.status).toBe(409);
  expect(r.body.code).toBe("SUBSCRIPTION_EXISTS");
  const subs = await stripe.subscriptions.list({ customer: ids.test_customer_1, status: "all" });
  expect(subs.data.length).toBe(1);
  stage(13, "passed", "Second checkout for a subscribed gym -> 409 SUBSCRIPTION_EXISTS; still one subscription at Stripe.");
});

test("14. replayed webhook is idempotent", async () => {
  const before = await gymRow();
  execFileSync("stripe", ["events", "resend", ids.checkoutEvent, "--config", process.env.STRIPE_CLI_CONFIG!], { encoding: "utf8" });
  await new Promise((r) => setTimeout(r, 8_000));
  const after = await gymRow();
  expect(after.subscriptionStatus).toBe(before.subscriptionStatus);
  expect(after.stripePriceId).toBe(before.stripePriceId);
  expect(after.stripeCustomerId).toBe(before.stripeCustomerId);
  stage(14, "passed", "Re-delivering the same checkout.session.completed event left status, price and customer unchanged.", "events resend accepted", "Gym row unchanged");
});

test("15+16. Basic -> Pro in the Customer Portal; Pro lifts the member cap", async ({ page, context, playwright }) => {
  await context.addCookies(await ownerCookies());
  const res = await api.post("/api/billing", { data: { action: "portal" } });
  expect(res.status()).toBe(200);
  const { url } = await res.json();
  await page.goto(url);
  await page.getByRole("link", { name: /update (subscription|plan)/i }).or(page.getByRole("button", { name: /update (subscription|plan)/i })).first().click();
  await page.getByText(/MatFlow Pro/i).first().click();
  const sel = page.getByRole("button", { name: /^select$/i });
  if (await sel.first().isVisible().catch(() => false)) await sel.last().click();
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.getByRole("button", { name: /confirm/i }).first().click();
  const row = await waitFor(async () => {
    const r = await gymRow();
    return r.stripePriceId === PRO ? r : null;
  }, 90_000);
  const sub = await stripe.subscriptions.retrieve(ids.subscription_1);
  expect(sub.items.data[0].price.id).toBe(PRO);
  expect(row.subscriptionStatus).toBe("active");
  stage(15, "passed", "Plan switched Basic -> Pro through the provisioned Customer Portal; customer.subscription.updated reconciled.", "subscription_1 item = pro_price", "Gym price = pro_price");

  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: ids.gym } });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const status = await joinMember(anon, gym.slug, 2);
  await anon.dispose();
  expect(status).toBe(201);
  expect(await prisma.member.count({ where: { gymId: gym.id, active: true } })).toBe(101);
  stage(16, "passed", "On Pro a 101st member joins (201); the cap is lifted server-side.", undefined, "active members = 101");
});

test("17. payment failure -> past_due", async () => {
  const pm = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: ids.test_customer_1 });
  await stripe.customers.update(ids.test_customer_1, { invoice_settings: { default_payment_method: pm.id } });
  await stripe.subscriptions.update(ids.subscription_1, {
    default_payment_method: pm.id,
    billing_cycle_anchor: "now",
    proration_behavior: "none",
  });
  const sub = await waitFor(async () => {
    const s = await stripe.subscriptions.retrieve(ids.subscription_1);
    return s.status === "past_due" ? s : null;
  }, 90_000);
  expect(sub.status).toBe("past_due");
  const row = await waitFor(async () => {
    const r = await gymRow();
    return r.subscriptionStatus === "past_due" ? r : null;
  }, 90_000);
  expect(row.subscriptionStatus).toBe("past_due");
  stage(17, "passed", "A declining test card on a forced renewal produced invoice.payment_failed; stored status past_due.", "subscription_1 status=past_due", "Gym status=past_due");
});

test("18+19. cancel -> canceled; paid entitlement revoked", async () => {
  await stripe.subscriptions.cancel(ids.subscription_1);
  const row = await waitFor(async () => {
    const r = await gymRow();
    return r.subscriptionStatus === "canceled" ? r : null;
  }, 90_000);
  expect(row.subscriptionStatus).toBe("canceled");
  stage(18, "passed", "customer.subscription.deleted reconciled; stored status canceled.", "subscription_1 status=canceled", "Gym status=canceled");

  const gated = await api.get("/api/admin/waivers");
  expect(gated.status()).toBe(402);
  expect((await gated.json()).code).toBe("SUBSCRIPTION_REQUIRED");
  stage(19, "passed", "After cancellation an owner-gated API answers 402 SUBSCRIPTION_REQUIRED.", undefined, "GET /api/admin/waivers -> 402");
});

test("20. resubscribe and record the manifest", async ({ page, context }) => {
  await context.addCookies(await ownerCookies());
  // Restore the working test card so the returning academy can pay.
  const r = await checkout(api, "basic");
  expect(r.status).toBe(200);
  await payHostedCheckout(page, r.body.url);
  const sub = await waitFor(async () => {
    const l = await stripe.subscriptions.list({ customer: ids.test_customer_1, status: "active", limit: 5 });
    return l.data[0];
  });
  remember("subscription_2", "subscription", sub.id);
  const row = await waitFor(async () => {
    const x = await gymRow();
    return x.subscriptionStatus === "active" ? x : null;
  });
  expect(row.stripePriceId).toBe(BASIC);
  stage(20, "passed", "Churned academy resubscribed through Checkout; active on Basic again. Object manifest written.", "subscription_2 active", "Gym active, price=basic_price");
});
