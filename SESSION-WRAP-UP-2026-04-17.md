# MatFlow Session Wrap-Up — 2026-04-17

Native iOS app built, tested, and submitted to TestFlight. Web app hardened with Apple 5.1.1(v) compliance (account deletion) and a full notification stack.

## ✅ Shipped this session

### Native iOS app (Capacitor wrapper)

- **Bundle ID:** `com.craftedsystems.matflow`
- **Team ID:** `287LMVY6W6`
- **Pattern:** Thin native shell around `app.mymatflow.com` (same approach as Basecamp's Hotwire Native). Web updates = instant app updates.
- **Built on:** Xcode 26.3, Capacitor 8, OneSignalXCFramework 5.5
- **In TestFlight:** Build 7 (auto-distributed to your Internal tester group, "MatFlow Team")
- **Icon:** Black bg + red square with 3 white bars + "MatFlow" wordmark + belt color band (white/blue/purple/brown/black)

### OneSignal push

- **App ID:** `ca291bda-c85e-4be3-9127-599c362268d9`
- **APNs Key:** `7DZ5D5Z3C7` (.p8 uploaded to OneSignal)
- **Web + native SDKs linked** via session.userId as external_id
- **Verified:** 3 iOS subscribers, 2 valid (native), 1 legacy invalid PWA
- **Real push delivery tested** on your iPhone — banner + badge working

### Notification triggers (all persist to inbox + fire push)

| Trigger | URL | Route file |
|---|---|---|
| New announcement | `/student?tab=announcements` | `admin/announcements/route.ts` |
| New join request | `/app/requests` | `student/requests/route.ts` |
| Join request approved | `/student` | `admin/requests/[id]/approve/route.ts` |
| Belt promotion | `/student/profile` | `admin/members/[id]/promote/route.ts` |
| New waiver template | `/student/waiver` | `admin/waivers/route.ts` |
| Test notification | `/student/notifications` | `notifications/test/route.ts` |

### In-app notification inbox

- `Notification` table in prod DB (schema applied via Supabase MCP)
- `/student/notifications` + `/app/notifications` routes with per-kind icons, mark-as-read, unread badges
- Bell icon in sidebar/mobile tab bar with red unread badge
- Top banner across all pages when unread > 0
- iOS home-screen icon badge count via `navigator.setAppBadge()`

### Apple 5.1.1(v) compliance

- `/api/auth/account-delete` with two-step `DELETE` confirm
- UI: `/student/profile` → Danger zone, `/app/settings` → Danger zone
- Gym owner guard: first Member of a gym is blocked from self-delete (orphaning protection)
- **Cookie-clear bug fixed** (cookies().delete() wasn't reliable on Next.js 15)

### Required pages

- `/privacy` — Privacy policy (publicly accessible)
- Purpose strings in Info.plist: NSLocationWhenInUse, NSLocationAlwaysAndWhenInUse (SDK-referenced), NSCameraUsage, NSPhotoLibraryUsage
- `ITSAppUsesNonExemptEncryption=false` so future builds auto-clear Export Compliance

### App Store Connect configured

- Bundle + App Apple ID + SKU registered
- Subtitle: "Jiu Jitsu gym management"
- Primary Category: Sports / Secondary: Health & Fitness
- TestFlight Test Information complete with demo credentials + review notes
- Ceconi BJJ Pilot external group created (0 testers until approved)
- MatFlow Team internal group with Frank added + auto-distribute on

### Demo account for Apple reviewers

```
Email: apple-review@mymatflow.com
Password: ReviewMe2026!
```

## ⏳ Waiting on Apple

**External beta review for Build 1** — in Apple's queue. Will likely be rejected because Build 1 is missing account deletion (committed later in Build 4). Expected Apple feedback: "Guideline 5.1.1(v) — add account deletion."

**Recovery plan:** When Apple rejects Build 1, resubmit Build 7 (which has all fixes). Apple generally approves the resubmit within hours once the cited issue is addressed.

Alternatively you can cancel the Build 1 submission manually and submit Build 7 fresh via App Store Connect → TestFlight → Ceconi BJJ Pilot → Builds → Select Build 7 → Save.

## 🔨 Still to build (for next session)

### Geofencing near-gym trigger (foreground)

Requires:
- Schema change: add `lat`, `lng` columns to `Gym` (or reuse existing city/state via Google Geocoding)
- Client-side: on app open, `@capacitor/geolocation` check vs home gym coords
- If within 200m, show prominent "Log today's training?" CTA + fire push
- Estimated: 1-2 hours

### Android / Play Store

Requires:
- Firebase project creation (needs Frank's Google account via browser)
- Google Play Developer account (~$25 one-time fee)
- FCM push key upload to OneSignal
- Signed AAB build + Play Console submission
- Play Review: hours vs Apple's days
- Estimated: 2-3 hours

### App Store public submission (after pilot)

Requires:
- iPhone 6.5" screenshots (at least 3)
- App description + keywords
- Support URL
- Apple Review queue: 1-3 days typical
- Estimated: 3-5 days including review wait

### Remaining notification triggers

- Class reminders (15 min before class start)
- Community post replies
- Attendance streak milestones
- Competition results
- Join-request rejected
- Estimated: 1 hour for all five

## 🧪 E2E verification run tonight

- ✅ Privacy page returns 200 publicly
- ✅ Sign-up flow creates Student + returns valid session
- ✅ Session endpoint authenticates correctly
- ✅ Empty inbox returns correctly
- ✅ Test notification creates inbox row + pushes to OneSignal
- ✅ Mark-all-read flips unread to 0
- ✅ Account deletion blocks without DELETE confirmation
- ✅ Account deletion succeeds with DELETE, DB student record removed
- ✅ Fixed: cookie wasn't clearing on deletion — now it does
- ✅ All 5 push triggers audited for correct external_id routing
- ✅ Full production build completes with 0 errors
- ✅ Real push delivered to your iPhone lock screen end-to-end

## 🚀 Ceconi BJJ pilot — ready TODAY on web

Text Gabriela:

> Gabriela — MatFlow is ready. Sign in at app.mymatflow.com as the Ceconi BJJ owner. Your students can join at app.mymatflow.com/join/ceconi-bjj. Schedule, announcements, attendance, waivers all work. The iOS native app with real push is in Apple beta review — I'll send your students a TestFlight invite link tomorrow once approved. In the meantime the web version has full functionality.

## 📱 Your phone — TestFlight build 7 ready

Check your email for the latest TestFlight invite from Apple. Install via the TestFlight iOS app. The new icon (stacked red square + MatFlow wordmark + belt bar) should be on your home screen.

## Commits pushed (in order)

All on the `main` branch of `thefranklujan/matflow-app`:

```
96176f1 Fix account deletion: cookie wasn't clearing, user stayed signed in
8d952f5 Icon v3: stacked red-square + MatFlow wordmark + belt band
fc1003f Switch app icon to black-background + MatFlow wordmark + belt band
44c4043 Add in-app account deletion (Apple 5.1.1(v))
64c13c1 Add MatFlow icons to iOS/Android + deep-link click handler + absolute URLs
47a226b Wire APNs entitlement + background modes + native push in iOS wrapper
8d44f70 Add Capacitor iOS + Android wrappers with OneSignal native SDK
40f448f Wire OneSignal external_id in both native wrapper and web modes
30c04ec Add /privacy policy page
1e69346 Add full OneSignal push notification stack with toasts and unread badges
```

Plus the App Store Connect + TestFlight configuration work (all server-side on Apple's end).
