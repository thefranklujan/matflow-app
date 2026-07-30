# MatFlow Phase 2 — Background geofenced arrival notification (DESIGN ONLY)

Status: **Planned — requires Frank's explicit approval before any implementation.**
Phase 1 (foreground proximity check-in) is the prerequisite and ships first.
Grounded in current Apple documentation (developer.apple.com: "Choosing the
location services authorization to request", "Requesting authorization to use
location services", "Monitoring the user's proximity to geographic regions",
"Declaring your actionable notification types", App Review Guidelines).

## Outcome
When a student physically approaches their academy with the app closed or
backgrounded, iOS delivers a local notification: "You're near [academy] —
attending class?" with **Check in** / **Not now** actions. "Check in"
deep-links into the Phase 1 arrival sheet, which performs the normal
foreground proximity verification + attestation + confirmed check-in. The
notification is a shortcut into Phase 1 — it never creates attendance by
itself.

## Honest boundary behavior (set expectations in copy and marketing)
- Radius: **approximately 150 m** (Core Location region monitoring's practical
  floor is ~100–200 m). We do NOT promise "exactly 500 feet".
- Region-entry delivery is **opportunistic**: iOS may deliver late, coalesce,
  or skip events (Low Power Mode, poor cell/Wi-Fi environment, device
  restart). Copy must never promise instant or guaranteed alerts.

## Authorization model
- Explicit **in-app opt-in screen first** (Settings → "Arrival reminders"):
  what it does, that it needs "Always" location, battery note, and an off
  switch. Only after the user enables it do we request authorization.
- Request **When In Use first**, then upgrade to **Always** (Apple's
  recommended incremental flow; iOS itself shows the Always upgrade prompt
  later at a moment of its choosing). Region monitoring requires Always.
- If the user grants only When In Use: the feature stays off with an honest
  in-settings status line; Phase 1 keeps working. No nagging loops.
- Revocation: the settings toggle stops monitoring (`stopMonitoring` for the
  region) and the UI reflects the OS-level permission if it was withdrawn.

## Notification design
- **Local** notification (no server/push involvement) from the region-entry
  callback. Actionable category `ARRIVAL_CHECKIN` with actions:
  `CHECK_IN` (foreground: opens the app) and `NOT_NOW` (background: dismiss +
  writes the same 45-minute client debounce Phase 1 uses).
- Deep link: `matflow://arrival-checkin` (or the universal link equivalent)
  routes to /student with a flag that triggers the Phase 1 evaluate() flow —
  reusing ALL of Phase 1's server verification. No trust is placed in the
  region event itself.
- Debounce: one arrival notification per gym per 45 minutes; none while the
  app is foregrounded (Phase 1 already covers foreground).

## Implementation choice (evaluate both; recommendation below)
1. **Small custom Capacitor plugin** (~150 lines Swift): CLLocationManager +
   `startMonitoring(for: CLCircularRegion)` for exactly ONE region (the
   member's gym), `UNUserNotificationCenter` local notification on
   `didEnterRegion`, category registration in the plugin. Pros: no new
   third-party dependency, exact fit, App Review story is simple, well under
   the 20-region iOS limit. Cons: we own the Swift maintenance.
2. **Maintained third-party plugin** (e.g. Transistorsoft background-
   geolocation [paid license] or community geofence plugins): Pros: battle-
   tested edge cases. Cons: cost or maintenance risk, far more capability
   than needed (continuous tracking machinery we must keep disabled), heavier
   review surface.
   **Recommendation: option 1 (custom, single-region, notification-only).**
   If option 2 is ever chosen instead, a security and maintenance review of
   the specific plugin (advisories, release cadence, native code audit,
   dependency chain) is REQUIRED before it is added — no plugin is selected
   on popularity alone.
- **No continuous background tracking, ever.** No `location` background mode
  in UIBackgroundModes unless the chosen API is documented to require it —
  region monitoring with `startMonitoring(for:)` does NOT require the
  background-location mode; the system launches the app for region events.
  (Verify against the docs at implementation time; do not add modes
  speculatively.)

## Native/config changes (all protected-area; part of the approval)
- Info.plist: `NSLocationAlwaysAndWhenInUseUsageDescription` purpose string
  updated to name the actual feature ("MatFlow uses your location to remind
  you to check in when you arrive at your academy. Location is never stored.")
  — both keys already exist and must be re-worded, not added.
- AppDelegate/plugin registration for the notification category + deep link.
- Privacy policy: add the arrival-reminder location use + "never stored".
- App Store privacy answers: Location → App Functionality, not linked to
  identity beyond the account, not used for tracking.
- App Review notes: explain the single-geofence reminder, the opt-in flow,
  and that location never leaves the device except the one-shot foreground
  check the user confirms (Guideline 2.5.4/5.1.1 posture: we do not use
  background location for anything except the user-visible reminder).

## Battery & limits
Single monitored region, no significant-change service, no continuous
updates → negligible battery impact (region monitoring is the OS's own
low-power path). Monitored-region budget: 1 of 20.

## QA matrix (device, not simulator-only)
| State | Expected |
|---|---|
| Foreground inside region | Phase 1 sheet (no notification) |
| Background → enter region | local notification with actions |
| App terminated → enter region | iOS relaunches in background; notification fires |
| "Not now" action | dismissed + 45-min debounce honored |
| "Check in" action | app opens → Phase 1 sheet → server-verified check-in |
| Permission = When In Use only | feature off; honest settings status; no nags |
| Permission revoked in iOS Settings | monitoring stopped; toggle reflects it |
| Device restart | region persists (iOS re-registers monitored regions) — verify |
| Low Power Mode | possibly delayed delivery — copy already honest |
| Offline at region entry | notification still fires (local); tapping Check in shows Phase 1's offline retry state until connectivity returns |

## Rollback
Feature-flag the opt-in screen (server-driven flag); disabling the flag hides
the opt-in and a migration-free client update stops monitoring on next launch.
App Store rollback = standard phased-release halt; no data migrations involved.

## Location assurance limitation (applies to Phase 1 today and Phase 2)
The Phase 1 arrival token proves only that **the server accepted
client-supplied coordinates** from an authenticated session and derived an
inside-the-geofence decision from them. It does NOT cryptographically prove
the coordinates came from untampered device GPS — a jailbroken device or a
modified client could submit fabricated coordinates. All product copy,
marketing, and internal docs must describe check-in verification accordingly
("confirmed from the student's reported location", never "GPS-proven").
Hardware-backed integrity (Apple DeviceCheck / App Attest, or Play Integrity
on Android) would be a SEPARATE security decision with its own design,
server-side verification, and failure-mode handling — it is deliberately not
part of Phase 2 and must not be overclaimed as a Phase 2 benefit.

## Approval gate
Implementing ANY of this requires Frank's explicit go because it touches:
Info.plist purpose strings, native Swift, App Store privacy answers, and an
App Store release. Nothing in Phase 1 depends on it.
