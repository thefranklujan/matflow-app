# MatFlow academy readiness — builder evidence for Codex review

Date: 2026-10-24. Builder: Claude Code. This is builder evidence only; Codex
performs independent acceptance and Frank makes the release decision.
Nothing was deployed, pushed, sent to real people, or charged.

## 1. Repositories, branches, SHAs

| Repo | Path | Branch | Start (= audited) | Final | State |
|---|---|---|---|---|---|
| App | `/Users/franklujan/Crafted & Company/Code/matflow-app` | `codex/matflow-academy-readiness` | `5f64206` | see `git log 5f64206..HEAD` (final = tip of the branch (commit "Builder evidence package")) | committed locally, **not pushed** |
| Marketing | `/Users/franklujan/Crafted & Company/Code/matflow-landing` | `codex/matflow-academy-readiness` | `8b81391` | `70a3ea4` | committed locally, **not pushed** |

Both repos were clean on `main` at the audited SHAs when work started; no
pre-existing uncommitted work, unpushed commits, or worktrees existed. `main`
is untouched in both. Not pushed because a branch push can trigger a Vercel
preview deployment and the assignment forbids deploying.

Test rig: a new disposable Postgres 16 cluster owned by this run at
`/Users/franklujan/builds/matflow-readiness-20261024/pg`, `localhost:5561`,
databases `matflow_test` (Vitest) and `matflow_e2e` (Playwright), trust auth,
synthetic data only. Env in `…/testenv.sh`; no `.env*` exists in the app repo,
external keys are blank, integrations mocked. Unit and browser suites never ran
against the same database. Stop it with
`pg_ctl -D /Users/franklujan/builds/matflow-readiness-20261024/pg stop`.

## 2–4. Behavior changed, files, reproductions, regressions

Status per acceptance ID: **passed** = local evidence below, **blocked** =
needs an outside prerequisite, **not run**.

### Packet A — community data loss (commit `15e6ea5`)
Reproduced pre-fix (`evidence/A-prefix-repro.log`): owner signup took
community/member/post **1/1/1 → 0/0/0**.
- `src/lib/local-auth.ts`: owner registration no longer claims nominations or deletes groups.
- `src/lib/nomination-claim.ts` (new): read-only same-name review matches with location agreement; founder claim of **explicit nomination ids** in one transaction, idempotent, never revives rejected requests, never deletes/moves community content, refuses location conflicts unless explicitly overridden.
- `src/app/api/platform/nominations/claim/route.ts`: new body `{targetGymId, nominationIds[], allowLocationMismatch?}`; legacy name-only body → 400.
- `src/app/platform/nominations/*`: "Pending review" notice, explicit ids, second confirmation on location mismatch, truthful result message.
- `src/app/student/(portal)/gyms/page.tsx`: same-name communities stay listed, labeled "Pending review".

| ID | Status | Evidence |
|---|---|---|
| A1 | passed | `src/lib/nomination-claim.integration.test.ts` (posts, comments, likes, reports, both memberships intact after signup and after claim) |
| A2 | passed | same file: Dallas community vs Miami academy → 409 `LOCATION_MISMATCH`, nothing changed; name-only body refused |
| A3 | passed | same file: retry + 2 concurrent claims → 1 join request; rejected request not revived |
| A4 | passed | same file: injected failure → nomination still `new`, 0 join requests |
| A5 | passed | same file: non-founder → 403, data unchanged |
| A6 | passed | integration (membership readable) + `e2e/academy-readiness.spec.ts` A6 (pending-review card visible) |

### Packet B — waiver revisions (commit `be3856f`)
Reproduced pre-fix (`evidence/B-prefix-repro.log`): after v2→v3 content edit,
GET `signed=true`, POST v3 **400 "Already signed"**.
- `src/lib/waiver.ts` (new): status by current active template + current version (`unsigned` / `previous_version_signed` / `current_signed` / `none_required`); signing requires the shown version; per-template `pg_advisory_xact_lock` shared by sign and edit; membership re-checked (active+approved); duplicates idempotent; owner counts helper.
- `src/app/api/members/waiver/route.ts`, new `src/app/api/student/academy/[gymId]/waiver/route.ts`; `src/app/api/admin/waivers/route.ts` (create in a transaction, edit under the lock, revision notification with deep link `/student/academy?gym=<id>#waiver`).
- `src/components/waiver/WaiverPanel.tsx` (shared UI with the four states and a stale-version conflict state); `/app/waiver`, `/members/waiver` use it; owner `/app/waivers` shows current-version counts.
- Drop-in signing unchanged (its snapshot/version pair comes from one row read).

| ID | Status | Evidence |
|---|---|---|
| B1, B2 | passed | `src/lib/waiver.integration.test.ts` (v1 row byte-identical after revision) + e2e B1/B4/B7 |
| B3 | passed | 6 concurrent submissions → 1 row; sign racing an edit never mismatches snapshot/version |
| B4 | passed | stale version → 409 `WAIVER_UPDATED` with new text, 0 rows; missing version treated as stale; UI shows new text and clears agreement (e2e) |
| B5 | passed | title-only edit keeps version and signed state, no notification |
| B6 | passed | other tenant 403 / 404, revoked member 403 `MEMBERSHIP_INACTIVE` |
| B7 | passed | notification url asserted; student route signs from that link (integration + e2e) |
| B8 | passed | `countCurrentSignatures` test; screenshot 07 |
| inactive/replaced | passed | signing a replaced template → 409 `WAIVER_INACTIVE` |

Delivery note: inbox row + push *attempt*; provider acceptance ≠ delivered/read. Push was mocked/blank in all tests.

### Packet C — academy progress and student experience (commits `0fef46c`, `30ac93d`)
Reproduced defect (code-level, per audit): promotion changed Member only while the notification opened `/student/profile`; Open Gym 307-redirected back to `/student`.
- New `/student/academy` page: identity, chooser for multiple memberships, next 7 days of classes with "I'm going", waiver panel, verified rank + history (personal rank shown separately), announcements, published videos (http(s) links only).
- `src/lib/student-membership.ts`: added `studentMemberships`, `resolveStudentMembershipForGym`, `requireStudentMembershipForGym` (active+approved, looked up from the session's studentId per request). Existing `requireStudentMembership` unchanged.
- `switch-gym`: requires active+approved membership, 303 to `/student/academy?gym=`.
- Home: only current memberships, published videos only, "Open academy". Nav: "My Academy". Profile: "Personal belt" label + explanation.
- Promotion is one transaction; notification → `/student/academy?gym=<id>#progress`. Personal rank is never written.
- Security finding fixed (`30ac93d`): video `embedUrl` rendered only with http(s); create/update reject other schemes.

| ID | Status | Evidence |
|---|---|---|
| C1 | passed | `src/lib/academy-access.integration.test.ts` + e2e C1 + screenshot 06 |
| C2 | passed | integration (two memberships, distinct ranks/history). UI chooser covered by code, not by a 2-membership e2e fixture |
| C3 | passed | integration (303 location) + e2e (click, URL, Back) |
| C4 | passed | waiver sign e2e; video empty state rendered; video list with data **not run** in e2e (no fixture videos) |
| C5 | passed | e2e C5 + screenshot 03 |
| C6 | passed | integration (revoked/stranger) + e2e (other gym id → no content, API 403) |
| C7 | passed | e2e C7: native user agent opens the academy view with no prices/trial CTA; `/app/billing` and `/app/settings` never render (redirected out of owner areas) |
| C8 | passed | e2e C8 (390px, no overflow, no unnamed controls, keyboard Enter on plan toggle) + axe gate on `/student/academy` (member and no-membership) |

Known limitation: the student shell renders page content twice (desktop and mobile trees, pre-existing). Section ids `#waiver`/`#progress` therefore exist twice; on mobile the hash may not scroll. Input ids are per-instance.

### Packet D — commitments and reminders (commit `29d8cb4`)
Reproduced pre-fix (`evidence/D-prefix-repro.log`): commitment written exactly as the schedule UI writes it (`BJJ@18:00`, browser-local midnight) → **0 reminders**.
- `src/lib/class-commitment.ts` (new): occurrence identity = gym + academy-local date (UTC midnight) + `type@HH:MM` + location; legacy raw types resolve only when exactly one class matches, otherwise `ambiguous` (excluded, counted); legacy non-midnight dates read in the academy timezone.
- `src/lib/class-reminders.ts` (new) + cron route: exact occurrence match, today/tomorrow window (00:10 classes), skips canceled/rescheduled classes and inactive members, dedup via Notification rows (occurrence-unique url) under an advisory lock; push attempted only for newly inserted rows.
- `src/app/api/cron/class-reminders` and `trial-expiring`: unset `CRON_SECRET` now refuses (previously matched `"Bearer undefined"`).
- Writers normalized: member commit route stores canonical dates; `ScheduleClient` sends `YYYY-MM-DD`. New student commit API validates an active class of that gym and an upcoming occurrence (≤14 days).

| ID | Status | Evidence |
|---|---|---|
| D1 | passed | `src/lib/class-reminders.integration.test.ts`, `class-commitment.test.ts`, e2e D |
| D2 | passed | 18:00 vs 19:30 separate; legacy raw ambiguous excluded and counted; unique legacy resolved |
| D3 | passed | only committed members of that occurrence; other tenant not reminded |
| D4 | passed | 3 concurrent runs + retry → 1 inbox row, 1 push attempt |
| D5 | passed (partial by design) | canceled, rescheduled, revoked → none. **Per-category opt-out does not exist in the schema**; device-level opt-out is enforced by the provider only |
| D6 | passed | Nov 1 2026 DST end (CST), 00:10 class reminded at 23:53 previous evening |
| D7 | passed | commit creates no Attendance; UI labels it a plan |

Semantics: at most one push attempt per student per occurrence from this job; a provider timeout after commit is not retried (can miss, cannot double). Not exactly-once delivery. **Automated reminders stay out of sales claims** until the real push provider is verified.

### Packet E — funnel and claims (app commit `a5b4f2a`, `7cb56cb`; landing `b64d9fd…70a3ea4`)
- App: homepage lead "Run your BJJ classes and keep students connected", CTA "Start 30-day trial" with post-trial price; signup owner card no longer mentions revenue; billing "Most Popular" → "For academies over 100 members"; Basic "Up to 100 active members, including your own owner account".
- Landing (19 files): academy page hero/CTAs ("Start 30-Day Trial" → `app.mymatflow.com/sign-up`, "Get a Walkthrough" → existing `mailto:` contact), free-student route, post-trial explainer, kiosk/reminder/commerce/"all-in-one" claims removed, "Free for small academies" removed in EN+PT, metadata and JSON-LD fixed, comparisons re-verified with vendor pages on Oct 24 (Kicksite, Gymdesk, BJJLink matched the spec; Zen Planner/TeamUp left as dated July 2026), member-dues limitation in every comparison, PT toggle and table contrast repairs.

| ID | Status | Evidence |
|---|---|---|
| E1 | passed (local) | app copy + landing copy agree on 30-day/$49/$99/seat definition |
| E2 | passed (local) | relative links resolve; external hosts only app domain and vendors. **Production smoke not run** (no deploy) |
| E3 | passed in edited scope | see landing commits. **Open:** stale `Landing/` folder in the landing repo still has old claims (not linked, maybe reachable) |
| E4 | passed (local) | 390/1440 checks in `evidence/landing/`; app axe gate green |
| E5 | passed | no analytics/consent/vendor changes |

### Packet F — export (commit `c1e8fc3`)
- `src/lib/academy-export.ts`, `/api/admin/export` (owner, current owner access), `/api/platform/gyms/[gymId]/export` (platform admin support path), Settings → Your data card, `docs/ACADEMY-EXPORT.md` (format + retrieval + support procedure).

| ID | Status | Evidence |
|---|---|---|
| F1 | passed | `src/lib/academy-export.integration.test.ts`: two tenants, zero cross-tenant ids/names, no journals, hashes, clerk ids, kiosk codes, Stripe ids |
| F2 | passed | manifest counts equal array lengths; all references resolve; signed snapshot ≠ current text preserved |
| F3 | passed | unauthenticated 401, locked-out owner 402 with support message, student session denied (e2e), non-admin support path 403 |
| F4 | passed | record fingerprint identical before/after; only an activity-log audit row (counts only) is written |
| F5 | passed | `docs/ACADEMY-EXPORT.md`; e2e downloads through the real UI |

### Packet G — runtime and Stripe (commit `a4eb9cb`)
- Node 25's default Web Storage global shadowed jsdom's `localStorage`. Vitest workers now get `--no-experimental-webstorage` on Node ≥ 22. No test deleted, skipped or loosened. `.nvmrc` = 22; CI moved from Node 20 (EOL) to 22. Vercel production runtime not inspected or changed.
- Stripe: offline readiness (`evidence/G-stripe-readiness.log`) → NOT READY, exit 1 (no test key, webhook secret, price ids, app URL, Stripe CLI). Lifecycle dry-run printed 20 stages, nothing mutated. Existing billing/webhook unit tests pass (mocked).

**Billing lifecycle: BLOCKED. Passed 0 · Failed 0 · Blocked 20.** No sandbox exists and the Stripe CLI is not installed here. Per the gate doc the machine's default Stripe CLI profile reportedly holds a live key; nothing here used it.

## 5. Commands and counts (all local, synthetic)

| Check | Runtime | Result |
|---|---|---|
| Baseline `npm test` before changes | Node 22.23.2 | 485 passed / 36 files |
| `npm test` final | Node 22.23.2 | **521 passed / 42 files** (`evidence/final-unit-node22.log`) |
| `npm test` final, no flags | Node 25.8.0 | **521 passed / 42 files** (`evidence/final-unit-node25.log`) |
| `npm run test:coverage` | Node 22 | 521 passed, thresholds met (lines 10.03%, branches 71.67%) |
| `npm run lint -- --max-warnings 0` | Node 22 and 25 | 0 errors, 0 warnings |
| `npx playwright test` (setup + desktop + mobile + visual, includes `next build`) | Node 22 | **240 passed, 1 skipped** (pre-existing intentional mobile duplicate) (`evidence/final-e2e-all.log`) |
| Visual baseline | darwin | 1 baseline updated after inspecting the diff (`owner-billing-375`, copy only; `evidence/visual-owner-billing-375-diff.png`). **Linux baseline for it must be regenerated from the CI runner** — CI visual step will fail on that one image until then |
| `tsc --noEmit` | — | only the two pre-existing errors in `BillingReturnNotice.test.tsx` and `subscription-reconcile.test.ts` |

Observation types: unit/integration = real local Postgres with mocked push/email/auth session; browser = real Next production build on localhost:4310 against `matflow_e2e`, external network blocked; **no sandbox, no live observations**.

## 6. Screenshots (actual implementation, synthetic fixture data)
`/Users/franklujan/builds/matflow-readiness-20261024/evidence/screens/` —
`01` student home "Open academy", `02` academy fresh, `03` no membership,
`04` student gyms pending review, `05` founder nominations pending review,
`06` academy after promotion + waiver revision, `07` owner waiver counts,
`08` owner settings export, `09` owner billing, `10` student profile personal-rank label;
each at 1440 and 390. Landing screenshots in `evidence/landing/`.

## 7. Security/privacy checks on changed routes
Server-side authorization on every new route (founder email list, owner access, student + active membership); client ids only select. Cross-tenant, revoked and non-founder denials are tested (A5, B6, C6, F3). Export: explicit selects, no-store attachment, no PII in logs. Fixed: `javascript:` video links; cron routes accepting requests when `CRON_SECRET` is unset. Not a security certification.

## 8. Decisions needed from Frank
1. **Stripe sandbox** (gate §14 items 1–2, browser): create `MatFlow Billing QA` sandbox and authenticate a Stripe CLI to it. Then the 20-stage lifecycle can run.
2. **Schema proposals** in `docs/SCHEMA-PROPOSALS-2026-10.md` (community↔academy link, waiver unique index, commitment `scheduleId` + backfill, reminder ledger, notification preferences). None applied.
3. **Locked-out owner self-export** (today: support-assisted only).
4. **Vercel Node runtime** (Node 20 deprecated on Vercel from Oct 1, 2026; project setting unchanged).
5. **Kiosk**: build code issuance/recovery or keep it out of the offer.
6. **Landing `Landing/` folder**: delete/redirect (still has "Free for small academies", Free tier, kiosk claims). City pages promise "we reach out to the owner" — outreach commitment kept as is.
7. Owner account counts toward Basic's 100 and is included in the waiver "active members" denominator — consistent with current seat policy; change only by decision.

## 9. Sandbox evidence
None. Blocked stages: all 20 (preflight 1–4, tenant/customer 5–7, checkout/activation 8–12, duplicate/idempotency 13–14, plan switching 15–16, failure/cancel/recovery 17–20). Local mocks and real payment evidence are not combined anywhere.

## 10. Sales/demo docs
`MATFLOW-OWNER-SALES-READINESS.md` updated (zero-traction note, seat definition, not-sold list incl. kiosk/reminders/dues, demo sequence without kiosk, My Academy, export). `docs/ACADEMY-EXPORT.md` holds the export/support procedure.

## 11. Rollback
Code: each packet is its own commit; `git revert <sha>` per packet, or abandon the branch (main untouched). No migration was applied, so there is no data rollback. Note reverting A restores the destructive auto-claim; reverting B restores the "Already signed" defect. Proposed migrations each list their own rollback.

## 12. Proposed verdicts (Codex/Frank decide)
| Motion | Proposed | Why |
|---|---|---|
| Discovery / demo | **Ready after review**, with synthetic data and the truthful demo sequence | Demo surfaces exist and are covered; no unsupported claims in edited scope |
| Pilot onboarding (no card) | **Ready after Codex acceptance + a deploy decision** | A, B, C, F blockers fixed locally with regressions; D safe but reminders not provider-verified |
| Founder-assisted paid activation | **Not ready — billing lifecycle blocked** | 0/20 sandbox stages run |
| Unattended self-service | **No-go** | Sandbox plus the eight production approvals in the Stripe gate §17 |
