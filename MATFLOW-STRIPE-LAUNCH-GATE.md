# MatFlow Stripe Launch Gate

Whether MatFlow may accept real money, and what is still missing before it can.

Every claim carries a status label: **Verified** (proven by code and tests in
this repository), **Partial**, **Missing**, **Planned**, **Unknown**, or
**Access Needed**.

**Nothing in this repository has ever contacted Stripe.** No Stripe object has
been created, modified, or read. Every Stripe-side claim below is therefore
**Access Needed** or **Unknown** until the sandbox lifecycle is actually run.
A passing unit test proves our code behaves correctly against a *mock*; it is
never evidence that Stripe behaves as we assumed.

The tooling to run that lifecycle exists (section 16) and is blocked on one
thing only: the dedicated **MatFlow Billing QA** sandbox does not exist yet, and
creating it plus authenticating the Stripe CLI to it both require Frank at a
browser. Section 14 is the exact list.

**Checked again on 31 July 2026.** The Stripe CLI configuration on this machine
was last modified 20 July and still contains only its original profile, which
holds a **live-mode key**. No `stripe login` has been run since, and no sandbox
profile exists. `.env.stripe-test` has now been created from the template and
is waiting on values. Nothing was mutated.

Stripe documentation reviewed: **31 July 2026**. Every external claim links to
the official page it came from.

Last updated: 2026-07-31.

---

## 1. Verdicts

Four separate motions, because they carry very different risk.

| Motion | Verdict | Blocking reason |
|---|---|---|
| **Founder-led no-card trials** | **GO** | No payment path is touched. Registration is atomic and race-safe; the 30-day trial is set in-app, not by Stripe. |
| **Founder-assisted paid sandbox verification** | **BLOCKED — not verified** | Passed 0, failed 0, blocked 20. Tooling, guards, catalog rules, and portal support are built and unit-tested, so the only missing input is the sandbox itself — items 1–2 of section 14, both of which need Frank at a browser. |
| **Founder-assisted live paid launch** | **CONDITIONAL GO** | Only with Frank personally watching each of the first subscriptions end to end, and only after the sandbox lifecycle has actually run green. Today it has not run at all. |
| **Unattended paid self-service** | **NO-GO** | Unchanged, and stays NO-GO even after a clean sandbox run until the eight production approvals in section 17 are separately granted. |

The NO-GO is a statement about evidence, not a suspicion about the code. The
code paths are unit-tested and were corrected twice against official
documentation. They have simply never been exercised against Stripe.

---

## 2. Test mode versus live mode

Stripe keys are per-mode: `sk_test_`/`rk_test_` versus `sk_live_`/`rk_live_`,
and objects in one mode are unreachable from the other — a test-mode price can
never be part of a live payment
([keys](https://docs.stripe.com/keys), [testing environments](https://docs.stripe.com/test-mode)).

**The dangerous exception is Dashboard settings, not objects.** Stripe warns
that changing settings in the default test-mode sandbox may also change them
in live mode. Purpose-created sandboxes isolate settings; the legacy default
one does not. This is the sharpest footgun in the whole integration, because it
means "I was only testing" is not automatically true of configuration changes.

| Item | Status |
|---|---|
| Tooling refuses any `sk_live_`/`rk_live_` key with a distinct exit code (87) | **Verified** — `src/lib/stripe-readiness.ts`, `src/lib/stripe-lifecycle.ts`, parity-tested against the real CLIs |
| Tooling refuses to read `.env.production` (exit 88) | **Verified** |
| Test-mode keys exist for MatFlow | **Access Needed** |
| A dedicated sandbox (not the settings-sharing default) is used | **Access Needed** |

Recent change worth a decision: Stripe now recommends **restricted keys
(`rk_`) over unrestricted secret keys** for new and existing integrations, and
notes that accounts created before May 2026 may have none
([keys](https://docs.stripe.com/keys)). MatFlow currently reads
`STRIPE_SECRET_KEY`; both prefixes are accepted by the preflight.

---

## 3. Test cards to use

From [Stripe's testing reference](https://docs.stripe.com/testing). Any future
expiry and any 3-digit CVC are accepted. Test cards work only in a sandbox.

| Purpose | Card |
|---|---|
| Success | `4242424242424242` |
| Generic decline | `4000000000000002` |
| Insufficient funds | `4000000000009995` |
| 3D Secure required, authentication succeeds | `4000000000003220` |
| 3D Secure required, then declines | `4000008400001629` |

Note that `4242424242424242` is also the "3DS supported but unenrolled" card,
so it will **not** exercise the authentication path. Use `4000000000003220`
for that. Stripe's Services Agreement prohibits testing in live mode with real
card details.

---

## 4. Local webhook testing

`stripe listen --forward-to localhost:3000/api/webhooks/stripe` prints the
signing secret on startup — there is no Dashboard secret for local listening
([webhooks](https://docs.stripe.com/webhooks)). That secret differs from a
registered endpoint's secret; swapping environments without swapping
`STRIPE_WEBHOOK_SECRET` is the classic local-to-production break.

`stripe trigger <event>` simulates events. With the CLI in play, Checkout
redirects to `success_url` immediately instead of waiting up to ten seconds for
the webhook, so local timing does not represent production.

| Item | Status |
|---|---|
| Stripe CLI installed (1.43.8) | **Verified** |
| Preflight checks for the CLI before declaring readiness | **Verified** |
| `stripe listen` has been run against MatFlow | **Access Needed** |

---

## 5. Webhook signature verification

Stripe signs every event with a `Stripe-Signature` header (timestamp plus
HMAC-SHA256 signatures) and requires the **raw request body** — any framework
that reparses or mutates the body breaks verification. The official libraries
use a **5-minute** default tolerance, and Stripe explicitly warns never to set
tolerance to `0`, which disables the recency check entirely
([webhooks](https://docs.stripe.com/webhooks)).

| Item | Status |
|---|---|
| Raw body used (`await request.text()`, never `request.json()`) | **Verified** — [route.ts](src/app/api/webhooks/stripe/route.ts) |
| Verification via `constructEvent` with the endpoint secret | **Verified** |
| Missing signature or missing secret returns 400 with zero writes | **Verified** — tested |
| Invalid signature returns 400 with zero writes | **Verified** — tested |
| Default 5-minute tolerance (not overridden) | **Verified** |
| Signature verification exercised against a real Stripe signature | **Access Needed** |

---

## 6. Duplicate deliveries and idempotency

Stripe retries failed deliveries for up to three days in live mode and states
that endpoints "might occasionally receive the same event more than once". Its
official recommendation is verbatim: **log the event IDs you have processed and
skip already-logged events**
([webhooks](https://docs.stripe.com/webhooks)).

Stripe does not use the terms "at-least-once" or "at-most-once" anywhere in its
webhook documentation, so this document does not attribute them to Stripe. The
two documented facts — automatic retries until a 2xx, and acknowledged repeat
delivery — are what the design must survive.

| Item | Status |
|---|---|
| Handlers are idempotent in **outcome** (they write a terminal state, not an increment) | **Verified** — tested |
| Processed-event-ID store, as Stripe recommends | **Missing** — needs a `StripeWebhookEvent` table and therefore an approved migration |
| Concurrent duplicate delivery of the same session | **Unknown** — Stripe warns handlers may be called concurrently with the same Checkout Session ID |

Stripe also notes that two *distinct* event objects can be generated for the
same underlying change, so event-ID deduplication alone is insufficient;
identity must also consider `data.object` plus `event.type`.

---

## 7. Event ordering

Stripe states plainly that it **does not guarantee events arrive in the order
they were generated**, and its go-live checklist makes "does not require event
notifications to occur in a specific order" a hard requirement. The official
remedy is to re-read current state from the API rather than infer it from
arrival order; snapshot payloads are an "eventually-consistent snapshot" that
"can be stale by the time you process it"
([webhooks](https://docs.stripe.com/webhooks),
[event destinations](https://docs.stripe.com/event-destinations)).

**MatFlow now follows that model completely.** Every subscription-bearing event
is treated as a trigger only: the handler re-reads the Subscription from Stripe
and writes that. The event payload's status is never used.

| Item | Status |
|---|---|
| All checkout, subscription, and invoice handlers re-read the Subscription | **Verified** — tested |
| A stale `updated` arriving after a newer `deleted` no longer resurrects the subscription | **Verified** — tested; this was a real regression and is now asserted, not documented as a gap |
| Duplicate delivery converges on identical state | **Verified** — tested |
| Stored price always comes from the current subscription, never the event | **Verified** — tested |
| A Stripe read failure returns 500 so Stripe retries | **Verified** — tested |
| Behavior against genuinely out-of-order Stripe deliveries | **Access Needed** — proven only against mocks so far |

Re-reading costs one API call per event. That is the price of correctness here,
and Stripe's own guidance recommends it.

---

## 8. Idempotency keys on API requests

Stripe retains idempotency keys for **24 hours**, returns the original stored
response on replay (including 500s), and raises an `idempotency_error` when the
same key arrives with different parameters. Concurrent reuse yields
`idempotency_key_in_use` / HTTP 409
([idempotent requests](https://docs.stripe.com/api/idempotent_requests),
[error codes](https://docs.stripe.com/error-codes)).

| Item | Status |
|---|---|
| Customer creation uses a server-owned key derived from `gymId` | **Verified** — `ensureCustomer()` in [stripe.ts](src/lib/stripe.ts) |
| Checkout creation uses a server-owned, 30-second time-bucketed key per gym | **Verified** |
| The client never supplies a key, customer, price, or amount | **Verified** |
| Idempotency conflict is mapped to a 409 with a recoverable message | **Verified** — tested |
| Real Stripe idempotency behavior under concurrency | **Access Needed** |

The 30-second bucket sits well inside Stripe's 24-hour retention, so a replayed
key always resolves against a live record rather than a pruned one.

---

## 9. Subscription statuses

The complete set is `trialing`, `active`, `incomplete`, `incomplete_expired`,
`past_due`, `canceled`, `unpaid`, `paused`
([subscriptions overview](https://docs.stripe.com/billing/subscriptions/overview)).

Three facts that matter more than the list:

- `active` **does not** mean every invoice is paid — other invoices may be open,
  void, or uncollectible.
- Stripe says to **revoke access when a subscription is `unpaid`**, not only
  when it is `canceled`.
- `incomplete` has a hard 23-hour edge: if the customer returns after that,
  create a new subscription rather than reviving the old one.

| Item | Status |
|---|---|
| Stripe's status is stored verbatim, including statuses we do not model | **Verified** — tested |
| Paid entitlement requires `active` **and** an allow-listed price | **Verified** |
| `unpaid` revokes paid entitlement | **Verified** — it is not `active`, so it never grants |
| `incomplete` no longer masquerades as `active` | **Verified** — corrected in this packet, tested |
| Legacy `"cancelled"` (British spelling) rows in production | **Access Needed** — PACKET-1 backfill decision |

---

## 10. Checkout Sessions

Sessions expire after 24 hours by default (configurable from 30 minutes to 24
hours). Critically, **`checkout.session.completed` does not prove the payment
succeeded**: Stripe's fulfillment guide gates on `payment_status`, delayed
payment methods settle later via `checkout.session.async_payment_succeeded`, and
in subscription mode the resulting subscription can be `incomplete`
([how Checkout works](https://docs.stripe.com/payments/checkout/how-checkout-works),
[fulfillment](https://docs.stripe.com/checkout/fulfillment)).

**This was a real defect in MatFlow and was corrected in this packet.** The
handler previously wrote `subscriptionStatus: "active"` unconditionally on
`checkout.session.completed` and cleared `trialEndsAt` at the same time. An
academy whose payment required authentication and never completed would have
been granted paid entitlement *and* stripped of its trial.

| Item | Status |
|---|---|
| Status derived from the retrieved Subscription, never assumed | **Verified** — tested |
| `checkout.session.async_payment_succeeded` handled | **Verified** — tested |
| Trial cleared only when the subscription actually supersedes it | **Verified** — tested |
| A session with no subscription grants nothing | **Verified** — tested |
| `checkout.session.expired` handled | **Missing** — not currently needed, since no inventory is reserved |
| Real checkout completion | **Access Needed** |

Stripe also notes that when a `success_url` is set and a
`checkout.session.completed` endpoint exists, Checkout waits up to ten seconds
for the server to respond before redirecting. A slow handler is visible latency
for the paying customer.

---

## 11. Customer Portal

Plan switching requires two things in the Dashboard: **Switch plan** turned on
(it is **off** by default) and a **product catalog** listing the prices
customers may move to. Stripe states that portal configurations are maintained
separately per mode — "one for live mode and one for each sandbox" — so
configuring the sandbox portal does **not** configure the live one
([configure portal](https://docs.stripe.com/customer-management/configure-portal),
[integrate portal](https://docs.stripe.com/customer-management/integrate-customer-portal)).

| Item | Status |
|---|---|
| App creates portal sessions and handles portal outage with a 502 | **Verified** — tested |
| Optional `STRIPE_PORTAL_CONFIGURATION_ID` pins a known configuration; unset leaves production behavior unchanged | **Verified** — tested both ways |
| Provisioning scopes the portal catalog to exactly the two approved prices | **Verified** — code and rules unit-tested; never executed |
| Portal configured in test mode (switch plan + catalog) | **Access Needed** — one command once the sandbox exists |
| Portal configured in **live** mode | **Access Needed** — separate action; sandbox configuration does not carry over |

Constraints that affect the $49/$99 offer directly: at most **10 products** may
be selectable for switching; a price switch requires **matching `tax_behavior`**
and is blocked entirely if `tax_behavior` is `unspecified`; and Stripe forbids
two prices sharing the same product and recurring interval, so Basic and Pro
must be **separate Products**, not two prices on one product.

---

## 12. Failed payments and dunning

After a failed payment Stripe retries on a schedule configured under Billing →
Revenue recovery → Retries; the recommended default is **8 attempts over 2
weeks**. When recovery is exhausted, a Dashboard setting decides whether the
subscription becomes `canceled`, becomes `unpaid`, or stays `past_due`
([smart retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)).

Two traps worth stating plainly:

- **Stripe never retries after a hard decline** (lost card, stolen card,
  `authentication_required`, and others). The retry stays scheduled and
  `attempt_count` keeps incrementing, but no charge is attempted. A rising
  `attempt_count` is therefore **not** evidence that Stripe is still trying.
- Retries use the **subscription's** `default_payment_method` in preference to
  the customer's. Updating only the customer default is the classic "I changed
  my card and it still failed" bug.

| Item | Status |
|---|---|
| `invoice.payment_failed` writes Stripe's real status, not an assumed `past_due` | **Verified** — corrected in this packet, tested |
| Invoices unrelated to a subscription no longer alter subscription status | **Verified** — tested |
| Owner-facing recovery UI for `past_due` | **Verified** — billing page states the condition and routes to the portal |
| Dunning schedule chosen and configured | **Access Needed** |
| Terminal behavior (cancel / unpaid / stay past_due) chosen | **Access Needed** — a business decision, not a code default |

---

## 13. Preventing duplicate subscriptions

Stripe offers a native guard for Checkout, but it is a **Dashboard feature with
a hard dependency**: it works only while the customer portal login link stays
enabled, and disabling that link silently re-enables duplicate subscriptions.
Its definition of "already subscribed" covers `active`, `past_due`, `unpaid`,
and `paused` — notably **not** `trialing`
([limit subscriptions](https://docs.stripe.com/payments/checkout/limit-subscriptions)).

Stripe's underlying model permits multiple subscriptions per customer by
design, and I could not verify any documented server-side equivalent of this
guard for API-created subscriptions. MatFlow therefore does not rely on it.

MatFlow enforces its own five layers before creating a Checkout Session
([billing route](src/app/api/billing/route.ts)):

1. Stored subscription status in our database.
2. Exactly one Stripe customer per gym, created under an idempotency key
   derived from `gymId`.
3. A direct query to Stripe for any live subscription, run **per status** with
   `limit 1` so a customer with many historical subscriptions cannot hide a
   live one beyond the first page.
4. At most one open Checkout Session per gym: reused for the same plan, expired
   first when the owner picked a different one.
5. A server-owned, time-bucketed idempotency key, with conflicts surfaced as a
   recoverable 409.

| Item | Status |
|---|---|
| Five-layer duplicate prevention | **Verified** — tested |
| Live-subscription check covers `trialing` and `incomplete`, which Stripe's own guard omits | **Verified** — stricter than the Dashboard feature |
| Behavior under real concurrent checkout attempts | **Access Needed** |

---

## 14. What Frank must supply to run the sandbox lifecycle

Four items, and only the first two need Frank at a keyboard. Everything else is
already built and waiting.

**1. Create the sandbox.** In the Stripe Dashboard, open the account picker →
**Switch to sandbox** → **Create sandbox** → name it exactly
`MatFlow Billing QA` → choose **Create from scratch**.

Create from scratch matters: Stripe warns that the *default* test-mode sandbox
shares settings with live mode, so changing a setting there can change it in
production. A purpose-created sandbox is fully isolated.

**2. Authenticate the CLI to it.** Run `stripe login`, and during the browser
authorization **select the MatFlow Billing QA sandbox**, not the live account.

This step matters more than it looks. This machine's default Stripe CLI profile
currently holds a **live-mode key**, so the CLI is one careless command away
from production. Nothing in this repository will use that profile.

**3. Pin and provision** — these are single commands:

```bash
cp .env.stripe-test.example .env.stripe-test && chmod 600 .env.stripe-test
```

Put the sandbox test key in that file, then:

```bash
npm run stripe:sandbox -- --pin && npm run stripe:sandbox -- --provision-sandbox-catalog
```

`--pin` records a one-way fingerprint of the sandbox account; every mutating
command afterwards refuses to touch any other account. `--provision-sandbox-
catalog` creates or reuses MatFlow Basic ($49) and MatFlow Pro ($99) on separate
Products with matching tax behavior, plus a portal configuration scoped to
exactly those two prices, and writes the ids into the git-ignored file without
printing them.

**4. Approve the lifecycle run**, which then exercises checkout, duplicate
prevention, plan switching, payment failure, cancellation, and resubscription.

| Item | Status |
|---|---|
| Sandbox `MatFlow Billing QA` exists | **Access Needed** — Frank, browser |
| Stripe CLI authenticated to that sandbox | **Access Needed** — Frank, browser |
| Fingerprint pinned | **Planned** — one command, blocked on the above |
| Catalog and portal provisioned | **Planned** — one command, blocked on the above |
| Lifecycle executed | **Missing** — has never run |

---

## 15. Lifecycle stage evidence

Twenty stages are defined in `src/lib/stripe-lifecycle-stages.json`. **All twenty
remain `Blocked`**, for the single reason that the sandbox does not exist.

No stage has an alias, a Stripe observable, a local observable, or a cleanup
result, because no stage has run. This table is filled in from the run manifest
after an actual execution and not before; anything else would be fabricated
evidence.

| Stage group | Stages | Status | Alias | Stripe observed | Local observed | Cleanup | Remaining risk |
|---|---|---|---|---|---|---|---|
| Preflight and catalog validation (1–4) | 4 | **Blocked** | — | — | — | — | Sandbox not created or pinned |
| Tenant and customer setup (5–7) | 3 | **Blocked** | — | — | — | — | Same |
| Checkout and activation (8–12) | 5 | **Blocked** | — | — | — | — | Same |
| Duplicate prevention and idempotency (13–14) | 2 | **Blocked** | — | — | — | — | Same |
| Plan switching (15–16) | 2 | **Blocked** | — | — | — | — | Same |
| Failure, cancellation, recovery (17–20) | 4 | **Blocked** | — | — | — | — | Same |

**Passed 0 · Failed 0 · Blocked 20.**

The manifest treats `partial`, `manual`, `blocked`, and `skipped` as failures
for the overall verdict, so a run cannot be summarized as verified unless every
stage genuinely passed.

### What has been proven locally, without Stripe

These are the only lifecycle-adjacent claims with real evidence today. All were
exercised against the actual CLI scripts, not mocks of them.

| Behavior | Evidence |
|---|---|
| A live-mode key is refused with exit 87, before any network call | Run directly against the scripts |
| `.env.production` is refused with exit 88 without being read | Run directly |
| A file that is not mode 600 is refused | Run directly |
| An unpinned or mismatched sandbox is refused with exit 89 | Unit-tested; fails closed when unpinned |
| A freshly copied template is refused, naming every unfilled key | Run directly; see section 19 |
| The CLI scripts agree with the TypeScript modules across the whole matrix | `src/lib/stripe-cli-parity.test.ts`, 28 cases |

---

## 16. Tooling

| File | Purpose |
|---|---|
| [src/lib/stripe-readiness.ts](src/lib/stripe-readiness.ts) | Configuration-shape preflight; prints classifications, never values |
| [scripts/stripe-readiness.mjs](scripts/stripe-readiness.mjs) | CLI. Exit 0 ready, 1 incomplete, 87 live key refused, 88 forbidden file |
| [src/lib/stripe-lifecycle.ts](src/lib/stripe-lifecycle.ts) | The twenty stages and every execution guard |
| [scripts/stripe-lifecycle.mjs](scripts/stripe-lifecycle.mjs) | Dry-run planner |
| [src/lib/stripe-sandbox-guard.ts](src/lib/stripe-sandbox-guard.ts) | One-way sandbox fingerprint; fails closed when unpinned |
| [src/lib/stripe-catalog.ts](src/lib/stripe-catalog.ts) | Price/product matching and the portal-switchability rules |
| [src/lib/stripe-manifest.ts](src/lib/stripe-manifest.ts) | Run manifest, resume logic, alias-only redaction |
| [scripts/stripe-sandbox.mjs](scripts/stripe-sandbox.mjs) | The only script that mutates Stripe. `--pin`, `--provision-sandbox-catalog`, `--execute-test-mode` |
| [src/lib/subscription-reconcile.ts](src/lib/subscription-reconcile.ts) | Re-reads Stripe and resolves the owning academy safely |
| [src/lib/stripe-cli-parity.test.ts](src/lib/stripe-cli-parity.test.ts) | Spawns the real CLIs and asserts they match the TypeScript modules |
| [.env.stripe-test.example](.env.stripe-test.example) | Names and placeholders only |

Secrets live only in `.env.stripe-test` and `.stripe-test-objects.json`, both
git-ignored and both required to be mode 600 — the runner refuses to start
otherwise. Stripe ids never appear in reports; aliases like `basic_price` and
`test_customer_1` are used instead.

Exit codes are deliberately distinct so a refusal is never mistaken for a pass:
**87** live credential, **88** forbidden env file, **89** sandbox mismatch or
unpinned, **1** incomplete or refused.

CI never needs Stripe credentials. Everything in the automated suite is mocked
or dry-run; sandbox execution is an explicit local command.

---

## 17. Production approvals still required

Even after a completely clean sandbox run, unattended paid self-service stays
**NO-GO** until Frank separately approves each of these. None was attempted in
this packet.

1. Durable `StripeWebhookEvent` migration (processed-event storage).
2. Production subscription-status audit and the legacy `"cancelled"` backfill decision.
3. Live Products and Prices, confirmed to match the published $49/$99 offer.
4. Live Customer Portal configuration — a separate action, because portal configuration does not cross modes.
5. Live webhook endpoint and its signing secret.
6. Production Vercel environment variables.
7. Dunning policy: retry schedule, and what a subscription becomes when recovery fails.
8. Tax and refund operational decisions.

---

## 18. Corrections made from documentation review

Four defects, all found by auditing MatFlow's handlers against official Stripe
documentation rather than by a test failing. All four were entitlement or
tenancy correctness problems.

**`checkout.session.completed` asserted `active` unconditionally** and cleared
`trialEndsAt` in the same write. A subscription that came back `incomplete` — a
failed or unauthenticated payment — would have been recorded as a paying
customer and stripped of its trial simultaneously.

**`invoice.payment_failed` asserted `past_due` unconditionally.** On a
subscription's first invoice Stripe keeps it `incomplete`, and the failing
invoice may not belong to a subscription at all.

**Subscription events trusted the payload.** A stale `updated` arriving after a
newer `deleted` would resurrect a cancelled subscription and restore paid access
to a churned academy. Handlers now re-read Stripe, making arrival order
irrelevant.

**`invoice.payment_failed` used `updateMany` keyed on the Stripe customer id.**
A customer id is not a tenant key. If two academies ever shared one, a single
failed payment would have marked both `past_due`. Ownership now resolves to
exactly one academy, or the write is refused and Stripe is asked to retry.

Alongside these, the billing return page stopped implying that returning from
Checkout means the payment succeeded; it now reports a bounded processing state
and waits for server-derived truth.

None of these touched `prisma/schema.prisma`, and no migration was created.

---

## 19. Fail-open found and closed (31 July 2026)

Exercising the tooling with a real `.env.stripe-test` surfaced a defect that
only appears in the normal first-run state.

`.env.stripe-test` is created by copying `.env.stripe-test.example`, so a file
full of `REPLACE_ME` placeholders is the ordinary intermediate state, not an
exotic one. Those placeholders are non-empty strings, and `sk_test_REPLACE_ME`
is even shaped like a valid test key. The gate therefore treated the whole
template as configured: `npm run stripe:lifecycle` **exited 0 and printed "Dry
run"**, as though the run were ready to go. The sandbox runner only caught it by
making a doomed API call and reporting `StripeAuthenticationError`, which
describes the symptom rather than the cause.

For tooling whose entire purpose is to fail closed, reporting ready on an
unconfigured file is the wrong failure direction.

Placeholders are now treated as absent everywhere: in key classification, price
resolution, app-URL classification, and database-locality checks. A copied
template is refused with a single `UNFILLED_PLACEHOLDER` line naming every key
still to be filled, and the sandbox runner refuses before opening a connection.
Key names are printed because they are not secrets; values never are.

Two of the three fixes were caught by the parity test rather than by hand: the
CLI copies of `classifySecretKey` and `isLocalDatabaseUrl` did not route through
the placeholder-aware check, so the CLI still accepted a placeholder key and a
placeholder database URL after the TypeScript side had been corrected. That is
the drift the parity test exists to catch, and it caught it.
