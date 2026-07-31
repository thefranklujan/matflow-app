# MatFlow Owner Sales Readiness

Living document for selling MatFlow to academy owners. Every claim carries a
status label: **Verified** (proven by code and tests in this repository),
**Partial**, **Missing**, **Planned**, **Unknown**, or **Access Needed**.

Last updated: 2026-07-31.

---

## 1. The offer

| Item | Detail | Status |
|---|---|---|
| Student product | Free for students, iOS/Android + web | Verified |
| Owner product | Web SaaS (owner billing and dashboard are unavailable in the native student app) | Verified |
| Trial | 30 days, no card required | Verified — set at registration, `trialEndsAt` = +30 days |
| Basic | $49/month, up to 100 active members | Verified — server-enforced member limit |
| Pro | $99/month, unlimited active members | Verified |
| Annual plan | Not offered | Verified (deliberate) |
| Free forever for new academies | Not offered | Verified (deliberate) |

**Not sold promises** (do not imply these in a call): commerce/pro-shop as a
headline capability, academy member-payment processing, multi-location, and
guaranteed priority support.

### What Basic includes
Member management, instructors, class scheduling and attendance, belt
progression, announcements and waivers, video library, invite links, student
app access for members.

### What Pro adds
Unlimited active members, lead pipeline, drop-ins, events, competitions,
advanced analytics.

---

## 2. Owner funnel

| Stage | Route | Status |
|---|---|---|
| Marketing site | separate repository | Verified (not touched by this packet) |
| Owner sign-up | `/sign-up` — 3 steps, creates academy + owner membership atomically | Verified |
| Legacy onboarding form | `/onboarding` → redirect; `POST /api/onboarding` → 410 `ONBOARDING_RETIRED` | Verified — retired in this packet |
| Session + dashboard | `/app` | Verified |
| Activation | four setup milestones (below) | Verified |
| First live usage | first attendance record | Verified |
| Trial → paid | Stripe Checkout from `/app/billing` | **Partial** — code path is race-safe and the return experience now reports a truthful processing state, but the sandbox lifecycle is unproven (Access Needed) |
| Renewal / churn | — | Missing (no lifecycle instrumentation) |

---

## 3. Definitions (single source: `src/lib/activation.ts`)

**Setup started** — the academy record exists.

**Activation complete** — all four milestones are true:
1. **Profile complete**: description, city, and state are all non-empty.
2. **First real member**: active+approved member count exceeds the owner-only
   baseline of 1 (the owner is a Member of their own academy and never counts).
3. **At least one active instructor.**
4. **At least one active class schedule.**

**Live usage** — at least one attendance record exists. Deliberately separate
from activation: a fully configured academy that never checks anyone in is a
different conversation from one running classes.

**Paid** — subscription status `active` AND a price on the server allow-list
(Basic or Pro). An active subscription with any other price is a
**reconciliation issue**, never counted as revenue.

**Repeated value / habit** — **Missing**. Requires lifecycle/cohort
instrumentation that does not exist yet.

Activation is never inferred from trial status, subscription state, or academy
age.

---

## 4. What Frank can measure today

Founder queue at `/platform/sales` (platform-admin only), per real academy:

| Field | Status |
|---|---|
| Academy name, slug, created date, age in days | Verified |
| Owner name/email/phone from the single member carrying the registration owner marker, else **Unknown** | Verified — zero or multiple marked owners both read Unknown; earliest member is never a fallback |
| Subscription status and trial days remaining | Verified |
| Allow-listed plan, or reconciliation flag | Verified |
| Setup milestones completed (n/4) and activation yes/no | Verified |
| Live usage yes/no | Verified |
| Active members / instructors / classes | Verified |
| Check-ins in the last 30 days (period stated in the UI) | Verified |
| Latest ActivityLog action and timestamp per academy, or an explicit Unavailable when the lookup fails | Verified |
| Priority and recommended founder action | Verified |

Platform dashboard also reports: real academies, allow-listed paid count,
list-price gross MRR **estimate** (list prices only, not Stripe cash),
trials, active members, activated academies, 7/30-day check-ins.

### Priority ladder (in order)
1. Payment or billing reconciliation issue
2. Trial expired (negative days — never shown as upcoming)
3. Subscription canceled (never "no action needed")
4. Trial ending in 0–3 days
5. Trial ending in 4–7 days
6. Unactivated after 3 days
7. Activated without live attendance
8. Active paid academy
9. No immediate action

---

## 5. What remains unavailable

| Metric | Status | Why |
|---|---|---|
| Trial-to-paid conversion rate | Missing | No lifecycle/cohort instrumentation |
| Retention / churn | Missing | Subscription history is not stored locally |
| Repeated-value / habit metrics | Missing | Same |
| Stripe cash, fees, refunds, taxes, disputes | Access Needed | Requires Stripe API access |
| App Store analytics | Access Needed | Separate system; student app, not owner sales |
| Production subscription-status counts | Access Needed | Requires read-only production access |
| Marketing-site funnel analytics | Unknown | Separate repository |

---

## 6. Founder onboarding-call checklist

1. Confirm academy name, city, and what they teach.
2. Confirm roster size today (drives Basic vs Pro).
3. Screen-share: complete the profile together (milestone 1).
4. Add one real member or send the invite link (milestone 2).
5. Add the instructor who teaches most (milestone 3).
6. Build this week's schedule (milestone 4).
7. Show the kiosk/check-in flow and take one real check-in (live usage).
8. Show the student app so they can tell members what to download.
9. State the trial end date out loud and put the conversion call on the calendar.
10. Log the call outcome; confirm the queue now shows them activated.

---

## 7. Truthful demonstration sequence

Demonstrate only what exists:
1. Owner sign-up → dashboard in under two minutes.
2. Setup checklist with the four real milestones.
3. Members roster and invite link.
4. Schedule creation with inline validation.
5. Attendance: record a class, then show it on the dashboard and analytics.
6. Student experience: free app, schedule, training log, arrival check-in.
7. Billing page: trial status, Basic vs Pro, upgrade path.

Do **not** demo: commerce as a primary value, member payment processing,
multi-location, or priority support.

---

## 8. Trial outreach plan

| Day | Contact | Goal |
|---|---|---|
| 0 | Welcome email (automatic) | Confirm access; invite to a setup call |
| 1 | Personal note | Book the onboarding call |
| 3 | Check the queue | If unactivated, offer to do setup together |
| 7 | Value check | Confirm first check-ins; fix blockers |
| 14 | Mid-trial | Confirm roster size and the right plan |
| 21 | Conversion pre-frame | Name the date and price; answer objections |
| 27 | Conversion call | Convert, or agree a deliberate extension/exit |

---

## 9. Trial-conversion conversation guide

Open with their data: members added, classes scheduled, check-ins recorded.
- **Roster ≤ 100** → Basic $49. **Roster > 100** → Pro $99.
- "Too expensive": compare against one lost member per month.
- "Not using it yet": diagnose the blocked milestone; book a working session.
- "Need a feature we don't have": say plainly whether it exists. Never promise
  commerce, member payments, multi-location, or priority support.
- Close by sending them to `/app/billing` and confirming the subscription shows
  active with an allow-listed price.

---

## 10. Cancellation interview

1. What changed since sign-up?
2. Which of the four setup steps never got finished, and why?
3. Were classes actually being checked in?
4. What did you use instead?
5. What single thing would have kept you?
6. Offer: pause, downgrade, or a clean exit with data export expectations set
   honestly (export tooling status: **Missing**).

---

## 11. Win-back checklist

- Academy still exists and data is intact.
- Re-run the four milestones — is it still activated?
- Was the blocker price, setup, or a missing capability?
- Only re-approach when the specific blocker changed.
- Never offer a discount that contradicts published $49/$99 pricing.

---

## 12. Protected actions still required (Frank only)

Everything Stripe-related lives in **[MATFLOW-STRIPE-LAUNCH-GATE.md](MATFLOW-STRIPE-LAUNCH-GATE.md)**
section 14, which is the single list of what Frank must supply. It is not
repeated here.

Outside Stripe:

| Action | Status |
|---|---|
| Read-only production subscription-status count | Access Needed |
| Read-only orphan-academy audit (academies with zero members) | Access Needed |

---

## 13. Launch verdicts

| Motion | Verdict | Reasoning |
|---|---|---|
| **Founder-led no-card trials** | **GO** | Registration is validated, atomic, and race-safe; the trial is set automatically; activation is measurable; the founder queue shows who needs help. No payment path is touched. |
| **Founder-assisted paid sandbox verification** | **BLOCKED — not verified** | All twenty lifecycle stages are Blocked (passed 0, failed 0, blocked 20). The `MatFlow Billing QA` sandbox has not been created and the Stripe CLI has not been authenticated to it. Re-checked 31 July 2026. |
| **Founder-assisted live paid launch** | **CONDITIONAL GO** | Only with Frank personally watching each of the first subscriptions end to end, and only after the sandbox lifecycle has actually run green. It has not run at all yet. |
| **Unattended paid self-service** | **NO-GO** | Stays NO-GO even after a clean sandbox run, until the eight production approvals are separately granted. |

Reasoning, evidence, and the exact remaining steps:
**[MATFLOW-STRIPE-LAUNCH-GATE.md](MATFLOW-STRIPE-LAUNCH-GATE.md)**.
Nothing in this repository has ever contacted Stripe, so no Stripe-side claim
is Verified. Sandbox verification was **attempted and safely stopped** on
31 July 2026: the required Stripe browser authentication had not been done, so
no mutation was possible and none was attempted.

---

## 14. Proposed future analytics migration (design only — no schema change here)

To close the Missing metrics, a later approved packet could add:

- `GymLifecycleEvent` — `id`, `gymId`, `event` (`created`, `activated`,
  `first_attendance`, `trial_started`, `trial_ended`, `subscribed`,
  `canceled`), `occurredAt`, `metadata`. Enables trial-to-paid conversion and
  cohort retention without recomputing from mutable state.
- `StripeWebhookEvent` — `eventId` (unique), `type`, `receivedAt`,
  `processedAt` — the idempotency table already specified in PACKET-2.

Both are additive. **No migration was created or applied in this packet**, and
`prisma/schema.prisma` is unchanged.
