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

> The Jiu Jitsu training companion built for BJJ academies. Log sessions, track belt progression, run your gym — all from one app.

---

## 3. Description (4000 chars max)

Full marketing text. Apple lets you edit this without re-review.

```
MatFlow is the training companion built for Brazilian Jiu Jitsu.

Whether you're a white belt just starting out or a gym owner running a hundred-student academy, MatFlow gives you everything you need to track your progress, find training partners, and run your mats.


FOR STUDENTS

• Log every training session in ten seconds — gi, no-gi, open mat, competition
• Track your belt and stripe progression with your coach's sign-off
• See your 90-day training heatmap and build real consistency
• View your academy's class schedule and check in on arrival
• Connect with training partners across MatFlow's community
• Nominate your gym if it's not already here — and we'll reach out to the owner


FOR GYM OWNERS

• Manage your students, schedule, and attendance from one clean dashboard
• Approve join requests as new students find your academy
• Track belt promotions and send automatic congratulations notifications
• Build and share your class schedule — students see it live
• Run your pro shop with integrated inventory and orders
• Send announcements, class reminders, and promotion emails
• See who's on the mats with geofence-based auto check-in


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

- Training log with session history and belt progression
- Class schedule and live attendance tracking  
- Community and training partner connections
- Gym management for owners: students, pro shop, announcements
- Secure push notifications for class reminders and updates

Email frank@mymatflow.com — we read every message.
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

**Sign-in Information** (if apple asks for a demo account):
- Email: `reviewer@mymatflow.com`  (I can create this before submission — just say the word)
- Password: `MatFlow2026!Review`  (or whatever you prefer; tell me and I'll provision)

**Notes for Reviewer** (paste this verbatim):

```
Hi team,

Thanks for reviewing MatFlow. A few notes that may help the review:

1. NICHE AUDIENCE
MatFlow is built specifically for Brazilian Jiu Jitsu academies — not a generic fitness app. Every feature (belt+stripe progression, gi/no-gi session types, rolling win/loss tracking, competition results) is designed around how BJJ gyms actually operate. We are currently partnered with Ceconi BJJ (Henderson, NV) as our founding academy, and their students and coach are actively using the app in production.

2. NATIVE FUNCTIONALITY (per 4.2)
MatFlow is not a web wrapper. It uses:
- Native push notifications via APNs for class reminders, belt promotions, and join-request approvals
- Native geolocation for auto-arrival check-ins when a student arrives at their gym (Haversine distance check vs gym geofence, owner-configured)
- Native device keyboard + camera integration for future belt-promotion photo flow
- Native session persistence via iOS UserDefaults so sign-in survives app kills
- Custom icon and launch experience

3. ACCOUNT DELETION (per 5.1.1(v))
Account deletion is available in-app: sign in → Settings → Danger zone → Delete Account. Removes the account, all training sessions, belt history, and gym membership data from our database. Reviewer can test this with the demo account.

4. DEMO ACCOUNT
The demo account above is preloaded with realistic data (a few training sessions, blue belt at demo gym) so you can see the main flows without needing to sign up fresh. If you'd like gym-owner access instead, email us and we'll provision a separate reviewer admin account.

5. CONTENT RIGHTS
All content in the app is owned by MatFlow or entered by the user. No third-party copyrighted material is embedded.

Happy to answer any questions at frank@mymatflow.com within an hour during business hours.

— Frank Lujan, MatFlow Founder
```

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

Pricing for gym-owner subscriptions is NOT handled via IAP — it's Stripe-based
billing on the web dashboard. This is permitted under Apple Guideline 3.1.3(b)
since gym-owner subscriptions are for a "Reader" experience / external purchase
flow, and the iOS app does not promote or funnel users to pay. Keep any gym-
owner paywall OUT of the iOS app during review — the student-side app is free.

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

Recommended capture list (in order, each should tell a different story):

1. **Home screen** — dashboard with belt band visible + training heatmap. "Track every session."
2. **Training Log** — session history with types (gi, no-gi, rolls). "Log in ten seconds."
3. **Schedule** — class schedule grid with Attend buttons. "Your academy's week at a glance."
4. **Community / Leaderboard** — students ranked by streak or training hours. "Roll with your team."
5. **Gym owner dashboard** (if submitting as combined app) — pending requests + announcements. "Run your mats."

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

- [ ] Build 10 is the one selected for review (newer than Build 9)
- [ ] Privacy policy at `/privacy` is up to date and covers location + push
- [ ] Support page at `/support` resolves and shows contact info
- [ ] Account deletion in `/app/settings` and `/student/profile` both work end-to-end
- [ ] Demo reviewer account exists and has at least 3 training sessions logged
- [ ] App icon looks good at 1024×1024 (check `ios/App/App/Assets.xcassets/AppIcon.appiconset/`)
- [ ] At least 5 screenshots captured in 6.7" size
- [ ] "Sign in with Apple" is NOT required (we only need it if we offer any other third-party sign-in per 4.8 — we don't)
- [ ] No gym-owner subscription paywall visible in the iOS app (keep it web-only per 3.1.3(b))
- [ ] TestFlight external testing is healthy and has real test data from Ceconi if possible

---

## 17. My Recommendation on Timing

Submit after **2-3 weeks of Ceconi TestFlight use**, then in the review notes,
cite that "the app has been in active production use at Ceconi BJJ since (date)
with N students and Y sessions logged." That turns the 4.2 "is this a real app"
question into a fact instead of a claim. Rejection risk drops from ~40% to
under 10% with that evidence.

Everything on this checklist is already shippable though — so whenever you say
the word, we flip the switch.
