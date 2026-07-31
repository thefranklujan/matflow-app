# MatFlow Stripe Launch Gate

Whether MatFlow may accept real money, and what is still missing before it can.

Every claim carries a status label: **Verified** (proven by code and tests in
this repository), **Partial**, **Missing**, **Planned**, **Unknown**, or
**Access Needed**.

**Nothing in this repository has ever contacted Stripe.** No Stripe object has
been created, modified, or read. Every Stripe-side claim below is therefore
**Access Needed** or **Unknown** until the test-mode lifecycle is actually run.
A passing unit test proves our code behaves correctly against a *mock*; it is
never evidence that Stripe behaves as we assumed.

Stripe documentation reviewed: **31 July 2026**. Every external claim links to
the official page it came from.

Last updated: 2026-07-31.

---

## 1. Verdict

| Motion | Verdict | Blocking reason |
|---|---|---|
| **Founder-led no-card trials** | **GO** | No payment path is touched. Registration is atomic and race-safe; the 30-day trial is set in-app, not by Stripe. |
| **Founder-assisted paid subscriptions** | **CONDITIONAL GO** | Only with Frank personally watching each of the first subscriptions end to end, and only after items 1–4 of section 14 are supplied. |
| **Unattended paid self-service** | **NO-GO** | Five gates are unmet: the test-mode lifecycle has never run, webhook idempotency has no event store, Customer Portal plan switching is unconfigured, live-mode configuration does not exist, and trial-to-paid instrumentation is Missing. |

The NO-GO is a statement about evidence, not a suspicion about the code. The
code paths are unit-tested and were corrected against official documentation
in this packet. They have simply never been exercised against Stripe.

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

**This packet moved MatFlow toward that model.** `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, and `invoice.payment_failed` now
re-retrieve the Subscription from Stripe and write *its* status, instead of
assuming a status from the event type.

| Item | Status |
|---|---|
| Checkout and invoice handlers re-read the Subscription as source of truth | **Verified** — tested |
| `customer.subscription.updated` / `.deleted` still write the event payload directly | **Partial** — a stale, out-of-order event can overwrite newer state |
| Out-of-order `updated`-after-`deleted` regression | **Missing** — documented by a deliberate failing-behavior test in [route.test.ts](src/app/api/webhooks/stripe/route.test.ts); the durable fix needs the event store from section 6 |

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
| Portal configured in test mode (switch plan + catalog) | **Access Needed** |
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

## 14. What Frank must supply

Ten items, in the order they unblock work. Items 1–4 unblock the test-mode
lifecycle; items 5–10 are required before any live charge.

1. **Stripe test-mode key** (`sk_test_` or `rk_test_`), from a dedicated
   sandbox rather than the settings-sharing default sandbox.
2. **Two test-mode recurring monthly prices** on **separate Products**: Basic
   $49 and Pro $99. The tooling deliberately cannot create these — a tool that
   can invent a price can silently invent an offer.
3. **Test-mode webhook signing secret**, from `stripe listen` for local runs.
4. **Approval to run the lifecycle**, at which point the twenty stages in
   `scripts/stripe-lifecycle.mjs` can be executed with `--execute-test-mode`.
5. **Customer Portal configured in test mode**: Switch plan on, product catalog
   set to the two prices above.
6. **Customer Portal configured in live mode** — a separate action, because
   portal configuration does not cross modes.
7. **Dunning decision**: retry schedule, and what a subscription becomes when
   recovery fails (`canceled`, `unpaid`, or stays `past_due`).
8. **Webhook idempotency migration approval** — the `StripeWebhookEvent` table
   that closes sections 6 and 7. No migration was created in this packet.
9. **PACKET-1 decision**: whether to backfill legacy `"cancelled"` rows to the
   canonical `"canceled"`.
10. **Production Stripe configuration**: account activation, live keys stored
    in Vercel, a live webhook endpoint over HTTPS with TLS 1.2+, and live
    price IDs confirmed to match the published $49/$99 offer.

Nothing in this list can be done from this repository, and none of it was
attempted.

**To run the preflight once items 1–3 exist** (it prints classifications only,
never values, and never contacts Stripe):

```bash
cp .env.stripe-test.example .env.stripe-test && npm run stripe:readiness:test
```

**To see the lifecycle plan without touching anything:**

```bash
npm run stripe:lifecycle -- --config .env.stripe-test
```

---

## 15. Tooling built in this packet

| File | Purpose |
|---|---|
| [src/lib/stripe-readiness.ts](src/lib/stripe-readiness.ts) | Pure preflight logic: configuration shape only, no values printed |
| [scripts/stripe-readiness.mjs](scripts/stripe-readiness.mjs) | CLI. Exit 0 ready, 1 incomplete, 87 live key refused, 88 forbidden file |
| [src/lib/stripe-lifecycle.ts](src/lib/stripe-lifecycle.ts) | The twenty stages and every refusal guard |
| [scripts/stripe-lifecycle.mjs](scripts/stripe-lifecycle.mjs) | Dry-run-by-default runner |
| [src/lib/stripe-lifecycle-stages.json](src/lib/stripe-lifecycle-stages.json) | Canonical stage list, read by both the module and the CLI |
| [src/lib/stripe-cli-parity.test.ts](src/lib/stripe-cli-parity.test.ts) | Spawns the real CLIs and asserts they agree with the TypeScript modules |
| [.env.stripe-test.example](.env.stripe-test.example) | Names and placeholders only |

The runners are dependency-free `.mjs` because Node 20 cannot import
TypeScript, so each carries a copy of the guard logic. The parity test is what
keeps the copies honest. `--execute-test-mode` is accepted by the guards but
exits non-zero on purpose: the mutating stages are unimplemented, so a green
run can never be mistaken for a completed lifecycle.

---

## 16. Corrections made in this packet

Both were found by auditing MatFlow's handlers against official Stripe
documentation, and both were entitlement-correctness defects.

**`checkout.session.completed` asserted `active` unconditionally.** It also
cleared `trialEndsAt` in the same write. A subscription that came back
`incomplete` — a failed or unauthenticated payment — would have been recorded
as a paying customer and stripped of its trial simultaneously. Now the handler
retrieves the Subscription and writes Stripe's status, and clears the trial only
when the status is `active` or `trialing`.

**`invoice.payment_failed` asserted `past_due` unconditionally.** On a
subscription's first invoice Stripe keeps the subscription `incomplete`, and the
failing invoice may not belong to a subscription at all. Now the handler
retrieves the subscription and writes its real status, and ignores invoices with
no subscription.

Neither correction touches `prisma/schema.prisma`, and no migration was created.
