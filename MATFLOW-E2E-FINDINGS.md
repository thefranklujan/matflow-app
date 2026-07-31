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
| 10 | P2 | Next.js 15.5.x dev server | `next dev` intermittently throws `Invariant: Expected clientReferenceManifest to be defined` under the E2E env; E2E therefore runs `next build && next start`. Dev-only, not independently resolved. | Track upstream; re-test on Next upgrades. |

## Closed 2026-07-31 (hardening sprint)

| # | Sev | Finding | Root cause | Fix + evidence |
|---|-----|---------|-----------|----------------|
| 8 | P2 | Sign-up / student sign-up / forgot / reset forms had unassociated labels and were outside the axe gate. | Labels were rendered as plain `<label>` siblings with no `for`/`id`; no page had a semantic `h1`; in-text links were color-only. | All 15 labels wired with unique `htmlFor`/`id`; `autocomplete` (given-name/family-name/email/new-password) and `inputMode` added; error regions carry `role="alert"` with `aria-describedby` from the inputs; success/status panels use `role="status" aria-live="polite"`; each page has an `h1`; in-text links underlined. Evidence: `e2e/auth-forms.spec.ts` (10 tests incl. label wiring, unique ids, accessible names, announced errors, retained values, autocomplete) + axe extended to all four surfaces — **zero serious/critical**. No password-visibility toggles exist in these forms, so that requirement was N/A. |
| 9 | P3 | Owner schedule Add-Class gave no inline validation feedback and could surface a generic server error. | The route only checked presence and `typeof dayOfWeek === "number"`; anything else fell through to a 500. The client ignored non-OK responses entirely. | New `src/lib/schedule-validation.ts` (pure, server-authoritative): day 0–6 integer, strict `HH:mm`, start≠end (midnight-crossing still allowed), trimmed/length-bounded classType/instructor/topic/locationSlug, slug charset, bounded instructorId. Route validates **before any DB work** and returns stable 400 `{error, code, field}`; instructor ids are re-checked against the authenticated academy. Client renders a `role="alert"` region, keeps entered values, blocks duplicate submits, and clears stale errors. Evidence: 33 unit tests (`schedule-validation.test.ts` 20, route contract 13) + 2 E2E (inline error with retained values; four invalid API bodies create zero rows). |
| 11 | P2 | Owner-selected academy color rendered directly on the kiosk could fail contrast. | The kiosk used `gym.primaryColor` raw for text, icons, borders, and spinner strokes over `#080808`. | New `src/lib/brand-color.ts`: hex normalization (3- and 6-digit), WCAG relative luminance, contrast ratio, `readableTextColor`, and `accessibleAccent` which blends away from the background until it clears 4.5:1 — **preserving the owner's saved color**, deriving safety at render time only. `PATCH /api/admin/settings` now rejects invalid `primaryColor`/`secondaryColor` with a stable 400 `INVALID_COLOR` **before any Prisma write** (empty/null still clears secondaryColor). Evidence: 16 unit tests covering black, white, MatFlow tan, saturated red, bright green, dark-navy and beige academy fixtures, invalid values, shorthand, near-threshold pairs, and custom backgrounds. |
| — | **P0 (new, found by this sprint's coverage)** | `/student/sign-up` was unreachable: it 307-redirected anonymous visitors to `/sign-in` in production, breaking the entire student acquisition funnel that the landing page links to twice. | The page sits under `src/app/student/`, whose portal `layout.tsx` calls `redirect("/sign-in")` when there is no session. Next.js composes parent layouts, so the guard applied to the public sign-up page. | Authenticated student routes moved into a `(portal)` route group (`src/app/student/(portal)/…`), leaving `sign-up` outside the guarded layout. Route-group parentheses do not change URLs — every `/student/*` URL is byte-identical, confirmed in the build manifest. Evidence: new regression test asserting an anonymous visitor reaches `/student/sign-up` with the form visible, plus the pre-existing 10-page student portal suite still green. |


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
- Suite (2026-07-31): `npm test` **219 passed**; `npm run test:e2e:functional`
  **179 passed / 1 skipped**; `npm run test:e2e:visual` **26 passed**;
  `npm run test:e2e` **204 passed / 1 skipped**; `npm run lint` 0/0;
  `npm run build` clean. `npm audit --omit=dev`: 0 critical, 2 high (documented
  sharp exception, unchanged); full audit 19, no regression.
- Baselines are committed for BOTH platforms: `*-visual-darwin.png` (local) and
  `*-visual-linux.png` (CI, taken from the Ubuntu runner's own screenshots —
  never copied from macOS).
- The two production `npm audit` highs (sharp via next's pinned optional
  `^0.34.3`) remain the documented exception from the security packet.
