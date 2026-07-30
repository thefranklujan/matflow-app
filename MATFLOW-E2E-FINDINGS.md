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

## Gate results
- axe: **zero serious/critical** across landing, sign-in, privacy, support,
  7 owner pages, 4 student pages, 2 platform pages, and the open arrival sheet
  (sheet scan scoped to the dialog; the dimmed backdrop otherwise contributes
  unrelated contrast noise).
- Suite: 182 passed / 1 skipped (cross-tenant probe is desktop-only by design) / 0 failed,
  including visual baselines passing on a clean second run.
- The two production `npm audit` highs (sharp via next's pinned optional
  `^0.34.3`) remain the documented exception from the security packet.
