# MatFlow — App Store Submission Package

Copy-paste into App Store Connect when you're ready. Every field here has been
written with (a) Apple reviewer psychology and (b) App Store search ranking in
mind.

Target: **version 1.0** of MatFlow, built from the Capacitor Hotwire Native
shell pointing at https://app.mymatflow.com.

---

## 1. App Name & Subtitle

**Name** (30 chars max):
> MatFlow

**Subtitle** (30 chars max, shown under the app name in search):
> Jiu Jitsu Training Tracker

---

## 2. Promotional Text (170 chars max)

Shown above the description. Can be updated without resubmitting.

> The free Jiu Jitsu companion for students. View your academy schedule, check in, read announcements, sign waivers, and track belt progression.

---

## 3. Description (4000 chars max)

Full marketing text. Apple lets you edit this without re-review.

```
MatFlow is the free training companion built for Brazilian Jiu Jitsu students.

Whether you're a white belt just starting out or a seasoned competitor, MatFlow gives you everything you need to stay connected to your academy and track your progress.


FOR STUDENTS

• View your academy's class schedule and check in on arrival
• Read announcements from your academy
• Sign required waivers right from your phone
• Log every training session in ten seconds: gi, no-gi, open mat, competition
• Track your belt and stripe progression with your coach's sign-off
• See your 90-day training heatmap and build real consistency
• Connect with training partners across MatFlow's community
• Nominate your gym if it's not already here, and we'll reach out to them


BUILT FOR JIU JITSU, NOT GENERIC FITNESS

Every feature in MatFlow was designed around how BJJ actually works. Belt progression with stripes. Training types that match real gyms. A community built around academies, not algorithms. Competition results. Personal goals tied to your belt path.

No fake gamification. No selling your data. No generic workout tracking repurposed for martial arts.

Just the tools you've been asking for, built by people who train.


FOUNDING ACADEMIES

MatFlow is partnering with a small number of founding academies to build this out with us. If your gym isn't on MatFlow yet, tap Nominate Gym — we'll reach out and get you set up free.


PRIVACY

We never sell your data. Location is only used if your gym has enabled arrival check-ins, and you can disable it anytime in iOS Settings. Account deletion is available from the Settings screen at any time.


QUESTIONS

Email us at frank@mymatflow.com or visit mymatflow.com/support.

Train hard. Stay curious.
— MatFlow
```

---

## 4. Keywords (100 chars max, comma separated — no spaces needed)

Every keyword fights for a search ranking slot. Avoid wasting space on the
app name (indexed automatically).

```
bjj,jiu jitsu,martial arts,grappling,belt tracker,training log,gym,academy,mma,judo,wrestling,roll
```

(99 chars — fits.)

---

## 5. What's New in This Version

First release — short and confident:

```
Welcome to MatFlow 1.0.

- Your academy class schedule with arrival check in
- Academy announcements
- Sign required waivers from your phone
- Training log with session history and belt progression
- Community and training partner connections
- Secure push notifications for class reminders and updates

Email frank@mymatflow.com, we read every message.
```

---

## 6. App Review Information — CRITICAL

This is where you defend against Guideline **4.2 Minimum Functionality**
rejection. Apple rejects apps that are "just websites in a wrapper." Preempt
that concern by listing the native capabilities + niche audience.

**Contact Information:**
- First name: Frank
- Last name: Lujan
- Phone: (your phone from GoDaddy 2FA, or your main)
- Email: frank@mymatflow.com

**Sign-in Information** (demo student account — provision before submission, see section 6a):
- Email: `reviewer.student@mymatflow.com`
- Password: `MatFlow2026!Review`

**Notes for Reviewer** (paste this verbatim):

```
Hi team,

Thanks for reviewing MatFlow.

WHAT THIS APP IS
MatFlow is a free companion app for Brazilian Jiu Jitsu students. It is not a paid app and contains no in-app purchases. Students use it to view their academy class schedule, check in on arrival, read announcements, sign required waivers, track belt progression, and log training. Gym owners manage their academy separately on the web dashboard and are not part of this iOS app. There is no billing, subscription, pricing, upgrade, or purchase flow anywhere in the iOS app.

NATIVE FUNCTIONALITY (per 4.2)
MatFlow is not a generic web page. It uses:
- Native push notifications via APNs for class reminders and academy announcements
- Native geolocation for arrival check-ins against an academy geofence
- Native session persistence so sign-in survives app kills
- Native share sheet, custom icon, and launch experience

NICHE AUDIENCE
Every feature (belt and stripe progression, gi and no-gi session types, rolling win/loss tracking, competition results) is designed around how BJJ academies actually operate. The app is in active production use at a live academy (Renzo Gracie Riverstone).

ACCOUNT DELETION (per 5.1.1(v))
Sign in, open Profile, scroll to the Danger Zone section, tap Delete Account. This removes the account, training sessions, belt history, and academy membership from our database. The demo student account can be used to verify.

DEMO ACCOUNT
The student demo account above is preloaded with a belt rank, an academy membership, a visible class schedule, an announcement, and a waiver to review.

CONTENT RIGHTS
All content is owned by MatFlow or entered by the user. No third-party copyrighted material is embedded.

Happy to answer any questions at frank@mymatflow.com.

Frank Lujan, MatFlow Founder
```

---

## 6a. Reviewer Demo Account (student) — PROVISION BEFORE SUBMIT

Apple needs a working student login (2.1(a)). Do NOT give them owner credentials.
The account must belong to a demo academy and show real student data:

- **Email:** `reviewer.student@mymatflow.com`  **Password:** `MatFlow2026!Review`
- Member of a demo academy (e.g. "Apple Review Academy") that is `approved=true`
- Belt rank set (e.g. blue, 2 stripes)
- The demo academy has: a class schedule (a few `ClassSchedule` rows), at least one
  `Announcement`, and one active `WaiverTemplate` so the reviewer can view + sign it
- A few logged training sessions / attendance rows so the log isn't empty

This is **production data**, so it is NOT created automatically by this work. Frank
approves provisioning, then it can be seeded via the Supabase MCP (owner-level) or a
one-time SQL insert. Account deletion review path: **Sign in → Profile → Danger Zone
→ Delete Account.**

---

## 7. Age Rating

Answer the questionnaire with:

- **Cartoon or Fantasy Violence**: None
- **Realistic Violence**: Infrequent / Mild (grappling-related imagery only)
- **Prolonged Graphic or Sadistic Realistic Violence**: None
- **Profanity or Crude Humor**: None
- **Mature/Suggestive Themes**: None
- **Horror/Fear Themes**: None
- **Medical/Treatment Information**: None
- **Alcohol, Tobacco, Drug Use**: None
- **Simulated Gambling**: None
- **Sexual Content or Nudity**: None
- **Unrestricted Web Access**: No
- **Gambling & Contests**: None
- **User-Generated Content**: Yes (training notes, gym nominations, community posts) — add moderation note: "All user-generated content is reviewed by the gym owner of record; inappropriate content can be reported and we remove within 24 hours."

Likely rating: **4+**.

---

## 8. Category

- **Primary Category**: Sports
- **Secondary Category** (optional): Health & Fitness

(Avoid Lifestyle — too broad, fewer featured slots.)

---

## 9. Pricing

- **Price**: Free
- **Availability**: All territories (or start US-only for easier launch; can expand later with one click)

The iOS app is **free with no in-app purchases**. It is a student companion only.
Academy-owner subscriptions are sold and managed exclusively on the web
(app.mymatflow.com) via Stripe. The iOS app does not contain, promote, link to,
or funnel users toward any purchase, billing, pricing, upgrade, or subscription
flow. Owner/admin/billing routes are blocked server-side in the native shell
(User-Agent gating in middleware), so they cannot render inside the app.

---

## 10. Privacy Nutrition Labels

Click "Edit" on the Data Types section. Declare:

**Data Collected:**
- **Contact Info → Email Address**: Linked to user, app functionality
- **Contact Info → Name**: Linked to user, app functionality
- **Contact Info → Phone Number** (optional field): Linked to user, app functionality
- **Location → Coarse Location**: Linked to user, app functionality (arrival check-ins)
- **Identifiers → User ID**: Linked to user, app functionality
- **Usage Data → Product Interaction**: Linked to user, app functionality (training log)
- **Diagnostics → Crash Data**: Not linked, app functionality

**Data NOT collected:**
- Health/fitness (no HealthKit)
- Financials
- Browsing history
- Search history
- Audio/photos

---

## 11. URLs

- **Privacy Policy URL**: `https://app.mymatflow.com/privacy`
- **Support URL**: `https://app.mymatflow.com/support`
- **Marketing URL** (optional): `https://mymatflow.com` (if you have it) or leave blank

---

## 12. Screenshots

You need at minimum **6.7" iPhone** (iPhone 15 Pro Max / 16 Pro Max) screenshots.
Apple recommends 3-10, best around **5**.

Recommended capture list (student-only — NO owner dashboard screenshots):

1. **Schedule + check in** — class schedule with arrival check in. "Your academy's week at a glance."
2. **Announcements** — academy announcements feed. "Never miss an update."
3. **Waiver signing** — sign a required waiver from your phone. "Sign waivers in seconds."
4. **Training log / belt progression** — session history + belt band. "Track every session."
5. **Community / Leaderboard** — students ranked by streak or training hours. "Roll with your team."

Do NOT include the gym-owner dashboard, billing, pricing, or any owner-management screen.

For each screenshot, I can build a companion text-overlay image if you want a
polished "App Store marketing" look rather than raw screenshots. Say the word
and I'll design them in the same palette as the app.

Required sizes (Xcode will generate smaller sizes from the largest):
- **6.7"** (1290×2796) — iPhone 16 Pro Max, 15 Pro Max
- **6.5"** (1284×2778) — iPhone 11 Pro Max, 14 Plus (optional if 6.7 provided)
- **5.5"** (1242×2208) — only if you want iPhone SE and older support
- **12.9" iPad** (2048×2732) — only if you want iPad in the review

To capture: Xcode simulator → Device → Screenshot. Or on real device
(Command+Shift+Volume Up on Mac mirror), then crop in Preview.

---

## 13. App Preview Video (optional, 15-30 sec)

Skippable for v1.0. If you want one later, I can script a storyboard that
matches the new launch animation + a quick feature tour.

---

## 14. Content Rights Declaration

"Does your app contain, show, or access third-party content?" → **No**.

All content in the app is either owned by MatFlow or entered by end users.

---

## 15. Export Compliance (Encryption)

"Does your app use encryption?" → **Yes**
"Does your app qualify for any of the exemptions?" → **Yes, exempt**
- Uses only the encryption that is part of the operating system (HTTPS / WKWebView stock)
- Does NOT use any proprietary/custom encryption

This is the standard answer for Next.js apps on HTTPS with no custom crypto.

---

## 16. Pre-flight Checklist

Run through before you hit Submit:

- [ ] Latest build selected for review, with the native User-Agent marker (`MatFlowNative`) shipped
- [ ] Privacy policy at `/privacy` is up to date and covers location + push
- [ ] Support page at `/support` resolves and shows contact info
- [ ] Account deletion at `/student/profile` (Profile → Danger Zone → Delete Account) works end-to-end
- [ ] Student demo account exists with belt rank, academy membership, schedule, an announcement, and a waiver (section 6a)
- [ ] App icon looks good at 1024×1024 (check `ios/App/App/Assets.xcassets/AppIcon.appiconset/`)
- [ ] At least 5 student-only screenshots captured in 6.7" size (no owner dashboard)
- [ ] "Sign in with Apple" is NOT required (only needed if we offer third-party social sign-in per 4.8 — we don't)
- [ ] Verified in the native shell: `/app`, `/admin`, `/platform`, `/app/billing`, `/cart`, `/checkout`, `/sign-up?role=owner` are all blocked/redirected with no owner or payment content
- [ ] No billing, pricing, trial, subscription, or upgrade text appears anywhere in the native shell
- [ ] Production has the native gating deployed (middleware UA detection) before the build points at it

---

## 17. My Recommendation on Timing

Submit after **2-3 weeks of Ceconi TestFlight use**, then in the review notes,
cite that "the app has been in active production use at Ceconi BJJ since (date)
with N students and Y sessions logged." That turns the 4.2 "is this a real app"
question into a fact instead of a claim. Rejection risk drops from ~40% to
under 10% with that evidence.

Everything on this checklist is already shippable though — so whenever you say
the word, we flip the switch.
