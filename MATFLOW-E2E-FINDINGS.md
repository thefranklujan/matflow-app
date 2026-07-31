# MatFlow E2E Findings Register

Persisted findings from the Playwright E2E / accessibility / responsive /
visual-baseline packet (2026-07-30). Severity scale: P0 blocker, P1 serious,
P2 cosmetic/minor, P3 enhancement. Status: Open / Fixed / Documented exception.

## Fixed in this packet

| # | Sev | Role / Page | Finding | Fix |
|---|-----|-------------|---------|-----|
| 1 | P1 | All shells | Icon-only buttons had no accessible name (axe critical `button-name`): sidebar/student-shell collapse toggle, owner + student schedule month arrows, training-log delete buttons. | `aria-label` added to each. |
| 2 | P1 | Forms, app-wide | Unlabeled form controls (axe critical `label`/`select-name`): sign-in email/password, owner settings (name/colors/phone/website/timezone/logo), attendance date + filters, schedule Add-Class selects, student profile (photo/names/email/phone/belt/stripes/home gym/training since), geofence radius slider, share-link input. | `htmlFor`/`id` pairs or `aria-label`s throughout. |
| 3 | P1 | App-wide, dark theme | Muted text failed WCAG 4.5:1 (axe serious `color-contrast`): `text-gray-500` (~3.6:1) and `text-gray-600` (~2.3:1) on the dark surfaces — 538 occurrences. | Both bumped to `text-gray-400` (~6.8:1). NOTE FOR FRANK: this brightens all muted text one notch and flattens the 500/600 hierarchy; mechanical accessibility fix, veto/re-tune welcome. |
| 4 | P1 | Student portal + platform + support | Hardcoded red `#dc2626` used as small text on dark (~3.4:1). | Text usages moved to `#ef4444` (~5.5:1); backgrounds/accents untouched. Platform avatar `bg-orange-500` → `bg-orange-700` for white initials. Unread banner solid red darkened `#dc2626`→`#b91c1c`. |
| 5 | P2 | /sign-in | No heading element on the page; account link distinguishable only by color; labels unassociated. | "Sign in to your account" is now an `h1`; link underlined; labels wired. |
| 6 | P2 | /privacy, /support | Links inside text blocks relied on color alone. | Underlined. |
| 7 | P3 | E2E infra | Streak-milestone notifications persisted across seeds and shifted student screenshots; parallel workers raced journey mutations; orphaned `next start` processes served stale builds (400s on hashed chunks) causing phantom failures. | Seed wipes fixture notifications; suite runs `workers: 1`; `reuseExistingServer: false`. |

## Open

| # | Sev | Role / Page | Finding | Recommendation |
|---|-----|-------------|---------|----------------|
| 8 | P2 | Sign-up / student sign-up / forgot / reset forms | Same unassociated-label pattern as the old sign-in form (these pages are not in the axe gate yet). | Apply the same `htmlFor`/`id` treatment; add the pages to `e2e/a11y.spec.ts` SURFACES. |
| 9 | P3 | Owner /app/schedule | Add-Class form gives no inline validation feedback. | Small validation message region. |
| 10 | P2 | Next.js 15.5.x dev server | `next dev` intermittently throws `Invariant: Expected clientReferenceManifest to be defined` under the E2E env; E2E therefore runs `next build && next start`. Dev-only. | Track upstream; re-test on Next upgrades. |
| 11 | P2 | Per-gym branding | Gym `primaryColor` is user-chosen and rendered as text/accents; a dark choice can break contrast at runtime (fixture default was fine; hardcoded reds are fixed). | Add a luminance guard or auto-derive an accessible text variant when owners pick brand colors. |


## Accessibility sweep audit (commit ec1a69e) — 2026-07-30

**Result: VERIFIED, with one narrow correction shipped.**

Method: mechanical diff of all 135 files in ec1a69e, plus representative
screenshots (owner dashboard/schedule/analytics/attendance/members/billing/
settings desktop + mobile, student dashboard/schedule/profile, platform
dashboard, public sign-in) taken from BOTH the committed baselines and the
Linux CI artifact.

| Check | Result |
|---|---|
| Every changed surface is dark-background | Verified. The only `bg-white` uses are swatches/toggles/badges that carry explicit dark text (`text-black`, `text-[#ef4444]`), plus the belt-color maps — none pair `text-gray-400` with a light background. |
| No `text-gray-400` on a light surface | Verified. The `bg-gray-500/20 text-gray-400` badge pattern is a 20%-opacity chip over the dark page, not a light surface. |
| Disabled/placeholder/tertiary text still distinguishable | Verified in screenshots: placeholders ("Optional", "https://yourgym.com") and metadata ("Slug cannot be changed") remain visibly dimmer than body copy. |
| Semantic hierarchy preserved | Partial by design: 500 and 600 collapsed into 400, so the two dimmest tiers are now one. `text-gray-300` (233 uses) and white headings still separate three levels. Frank may re-introduce a distinct dimmest tier that still clears 4.5:1. |
| Status colors still communicate | Verified: green/amber/red/blue status chips and belt colors unchanged. |
| Red change affected text only | Verified: `text-[#dc2626]` → `#ef4444`; `bg-[#dc2626]` backgrounds untouched except the unread banner (deliberate, white-on-red contrast). |
| Label/id associations unique and valid | Verified: no duplicate ids among the introduced `signin-*` / `set-*` ids. |
| Icon-button labels describe the real action | Verified by reading each call site (collapse/expand navigation, previous/next month, delete session, upload logo/photo). |
| No functional change inside the commit | Verified: every added line in ec1a69e touches only className / aria-label / htmlFor / id / heading tag / underline. Zero logic, handler, or data changes. |
| No customer-facing wording altered | Verified: the only text change is the sign-in `<p>` becoming an `<h1>` with identical copy. |

**Correction shipped in this packet:** owner Settings rendered the Primary/
Secondary color pair as a fixed `grid-cols-2` and clipped the second field at
375 px (pre-existing, not caused by the sweep). Now `grid-cols-1 sm:grid-cols-2`,
and `/app/settings` + `/student/profile` were added to the responsive spec so
it cannot regress.

## Gate results
- axe: **zero serious/critical** across landing, sign-in, privacy, support,
  7 owner pages, 4 student pages, 2 platform pages, and the open arrival sheet
  (sheet scan scoped to the dialog; the dimmed backdrop otherwise contributes
  unrelated contrast noise).
- Suite: 184 passed / 1 skipped (cross-tenant probe is desktop-only by design) / 0 failed.
  Functional (159) and visual (27) also pass independently via
  `npm run test:e2e:functional` / `npm run test:e2e:visual`.
- Baselines are committed for BOTH platforms: `*-visual-darwin.png` (local) and
  `*-visual-linux.png` (CI, taken from the Ubuntu runner's own screenshots —
  never copied from macOS).
- The two production `npm audit` highs (sharp via next's pinned optional
  `^0.34.3`) remain the documented exception from the security packet.
