# Earnings Ninja — App Store Submission Guide

Bundle ID: `com.earningsninja.app` · App Name: `Earnings Ninja` · Min iOS: 17.0 · Category: Finance

---

## Step 1 · Configuration files (already updated in this repo)

### `app.json` — production-ready

Already updated. Key changes from the previous dev-only version:

- Removed `NSAppTransportSecurity.NSAllowsArbitraryLoads` — both the dev and production API URLs are HTTPS, so we no longer need to weaken App Transport Security. **App Store reviewers reject apps that disable ATS without justification.**
- Added `ios.deploymentTarget: "17.0"` (matches the widget's App Intent requirement).
- Added `ios.appleTeamId` placeholder — **you must replace `REPLACE_WITH_YOUR_10_CHAR_TEAM_ID` with your real team ID** from <https://developer.apple.com/account>.
- Added `LSApplicationCategoryType: public.app-category.finance` — matches the App Store category and is recommended by Apple.
- Added `ITSAppUsesNonExemptEncryption: false` directly in `infoPlist` (alongside the existing `ios.config.usesNonExemptEncryption: false`) so it's set in both places.
- Added `NSPhotoLibraryAddUsageDescription` so users can save receipt photos back to their library if needed.
- Pinned `extra.apiBase` to the production Railway URL (`earnings-pro-is-8-production.up.railway.app`).
- App Group entitlement `group.com.earningsninja.shared` already wired for the widget.
- **Added `ios.privacyManifests`** declaring four required-reason API categories (UserDefaults reason `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1`) plus `NSPrivacyTracking: false`. Apple has been auto-rejecting iOS apps without a privacy manifest since May 2024 — this is now compliant. Expo's `prebuild` translates this block into a `PrivacyInfo.xcprivacy` file embedded in the main app target. **The widget extension target needs its own `PrivacyInfo.xcprivacy`** — see Step 3 / Xcode verification below.

### `eas.json` — production build + submit profile

Already updated. Key changes:

- `production.autoIncrement: "buildNumber"` — every `eas build --profile production` bumps the iOS build number automatically (Apple requires monotonically increasing build numbers).
- All three profiles get an explicit `ios.resourceClass: "m-medium"` for predictable build times.
- `production.env.EXPO_PUBLIC_API_BASE` points at the production Railway backend.
- `submit.production.ios` has placeholders for `appleId` / `ascAppId` / `appleTeamId` — **you must replace these before running `eas submit`**.

### What you still need to fill in

1. **Apple Team ID** (10 chars, e.g. `ABCDE12345`)
   - Find it at <https://developer.apple.com/account> → top-right corner.
   - Replace in `app.json` (`ios.appleTeamId`) AND `eas.json` (`submit.production.ios.appleTeamId`).
2. **Apple ID** — your Apple Developer account email. Replace in `eas.json` (`submit.production.ios.appleId`).
3. **App Store Connect App ID** (numeric, e.g. `1234567890`)
   - You'll get this after creating the app in App Store Connect (Step 4 below).
   - Replace in `eas.json` (`submit.production.ios.ascAppId`).

---

## Step 2 · Required Assets

### App icon (already in repo)

- **`assets/icon.png`** — 1024×1024, PNG, RGB **without alpha** ✅ (already correct).
- Apple rejects icons with transparency or non-square dimensions.

### Screenshots (you must capture)

App Store Connect requires screenshots for at least one display size. **Required minimums for iOS 17+ submission:**

| Device | Resolution (portrait) | Quantity |
|--------|----------------------|----------|
| **6.9" iPhone (iPhone 16 Pro Max)** | 1290 × 2796 | 3–10 (we recommend 6) |
| **6.5" iPhone (iPhone 14 Plus / 11 Pro Max)** | 1284 × 2778 or 1242 × 2688 | 3–10 (optional but recommended) |

You only need to upload ONE size; Apple will reuse it across smaller devices automatically. **Recommended: capture 6.9".**

**Suggested 6 screenshots** (in this order, with overlay captions):

1. **Dashboard / Today** — caption: *"Track every dollar in real time"*
   Show the hero profit card (large green number), KPI strip ($/mile, miles), period chips.
2. **Add Entry — calculator** — caption: *"Calculator-style quick entry"*
   Show the yellow-header AddEntryModal mid-input with a number on screen.
3. **Add Entry — receipt photo** — caption: *"Snap a receipt for any expense"*
   Show the EXPENSE branch with a thumbnail attached.
4. **Goals + history** — caption: *"Hit your daily, weekly & monthly goals"*
   Show the goal progress bar at >50% plus a few entries below.
5. **iOS Widget on Home Screen** — caption: *"One-tap quick add from your Home Screen"*
   Real screenshot of the Medium widget on a Home Screen with a few app icons around it.
6. **iOS Widget on Lock Screen** — caption: *"See today's profit at a glance"*
   Lock Screen with the Rectangular accessory widget visible.

**How to capture:**

```bash
# Run on a real iPhone 16 Pro Max (or use Xcode simulator)
# In the simulator: Device → Screenshot (⌘S) saves to Desktop at the right size.
```

Edit captions/overlays in Figma, Sketch, or [Screenshots.pro](https://screenshots.pro). Save as PNG.

### Privacy Nutrition Label data (for App Store Connect)

| Category | Collected? | Linked to user? | Used for tracking? | Purposes |
|----------|-----------|-----------------|-------------------|----------|
| **Contact info → Email address** | Yes (signup/login + password reset via Resend) | Yes | No | App Functionality |
| **Financial info → Other financial info** (earnings, expenses) | Yes (core function) | Yes | No | App Functionality |
| **User content → Photos** (receipt images, base64) | Yes (optional) | Yes | No | App Functionality |
| **Identifiers → User ID** (internal account ID) | Yes | Yes | No | App Functionality |
| **Usage data → Product interaction** | No | — | — | — |
| **Diagnostics → Crash data / Performance data** | No (we don't ship Sentry/Crashlytics) | — | — | — |
| **Location** | **No** | — | — | — |

**Third-party data sharing — declare these in App Privacy → "Data Used to Track You" / "Data Linked to You" → "Third-Party Partners":**

- **Resend** (transactional email provider): receives the user's email address whenever they request a password reset. Declare under *Contact Info → Email Address* with purpose *App Functionality*.
- **OpenAI** (AI Earning Suggestions): if the AI Suggestions feature is enabled in production, the backend sends aggregated, non-PII earnings/expense statistics (totals, $/mile, platform mix) to OpenAI's GPT-4o-mini API. **No raw email, name, or user ID is sent.** Declare under *Financial Info → Other Financial Info* with purpose *App Functionality*. If you'd rather not declare this, disable the AI suggestions endpoint in production by unsetting `AI_INTEGRATIONS_OPENAI_API_KEY` on the Railway backend.
- **Railway** (backend hosting) is infrastructure, not a partner — does not need a Privacy Label entry.

> **Important:** The Location permission string is in `infoPlist` because the app *can* use GPS for trip tracking, but the current build does not actually collect/store location data. If you ever start storing GPS coordinates server-side, update the Privacy Label to include "Precise location → linked to user, not used for tracking".

App Tracking Transparency (ATT): **Not required.** We do not track users across other apps or websites and do not use IDFA.

---

## Step 3 · Terminal commands (in order)

Run from inside `earnings-ninja-expo/`. macOS only — Xcode must be installed for `expo prebuild` to verify the iOS project.

```bash
# 1. Install / update EAS CLI globally
npm install -g eas-cli

# 2. Log in to your Expo account (linked to your Apple Developer account)
eas login

# 3. Verify Expo recognizes the project (creates .easignore etc. if needed)
eas init

# 4. Configure credentials (Apple cert, provisioning profile, push key)
#    EAS will prompt for your Apple ID + App Store Connect API key.
#    For credential storage, choose "Yes, let EAS handle it" (recommended).
eas credentials

# 5. Generate the native iOS project so the widget extension is included.
#    This step is REQUIRED any time you change `app.json`, plugins, or
#    `targets/widget/expo-target.config.json`.
npx expo prebuild --platform ios --clean

# 6. (Required sanity-check) open in Xcode and verify all of the following:
#    - EarningsNinja target → Signing & Capabilities → App Groups contains
#      `group.com.earningsninja.shared`
#    - EarningsWidget target → same App Group entitlement (same exact string)
#    - Both targets share the same Apple Team and the same code-signing identity
#    - EarningsNinja target → Build Phases → Copy Bundle Resources contains
#      `PrivacyInfo.xcprivacy` (Expo generates this from the privacyManifests block)
#    - EarningsWidget target ALSO has its own `PrivacyInfo.xcprivacy` in
#      Copy Bundle Resources. If missing, copy the main app's file into
#      `ios/widget/` and add it to the widget target via File → Add Files…
#      and check the EarningsWidget target box. Reason codes UserDefaults
#      `CA92.1` cover the widget's UserDefaults(suiteName:) usage.
#    - Both bundle IDs are registered with App Group capability at
#      <https://developer.apple.com/account/resources/identifiers/list>:
#         · com.earningsninja.app          (App)
#         · com.earningsninja.app.widget   (Widget Extension)
#      App Groups capability must be enabled on both, and provisioning
#      profiles regenerated. EAS handles regeneration automatically when
#      you run `eas credentials`, but the manual capability toggle in
#      Apple Developer is still required.
open ios/EarningsNinja.xcworkspace

# 7. Build the production .ipa on EAS Cloud
eas build --platform ios --profile production

#    → Wait ~15–25 min. EAS prints a build link; download or stream the .ipa.

# 8. Submit to App Store Connect
#    Make sure you've already created the app entry in App Store Connect
#    (Step 4 below) and replaced `ascAppId` in eas.json.
eas submit --platform ios --profile production --latest

#    → EAS uploads the .ipa to App Store Connect and TestFlight.
#    → ~10–30 min for Apple's "Processing" stage to finish.
```

### After submission

```bash
# Watch the build status
eas build:list --platform ios --limit 3

# View submission status
eas submit:list --platform ios --limit 3
```

---

## Step 4 · App Store Connect — manual steps + ready-to-paste text

### 4.1 Create the app entry

1. Go to <https://appstoreconnect.apple.com/apps>.
2. Click **+ → New App**.
3. Fill in:
   - **Platforms:** iOS
   - **Name:** `Earnings Ninja`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Pick `com.earningsninja.app` from the dropdown (this only appears after you've registered the bundle ID at <https://developer.apple.com/account/resources/identifiers/list>).
   - **SKU:** `earnings-ninja-ios` (any unique string)
   - **User Access:** Full Access
4. Click **Create**.
5. The URL will now contain `apps/<numeric_id>/...` — that numeric ID is your `ascAppId`. Copy it into `eas.json`.

### 4.2 App Information (left sidebar → "App Information")

| Field | Value |
|-------|-------|
| Subtitle | `Track gig delivery earnings` |
| Category — Primary | `Finance` |
| Category — Secondary | `Business` |
| Content Rights | Check "Does not contain, show, or access third-party content" |
| Age Rating | Click Edit → answer "None" to all questions → **4+** |

### 4.3 Pricing & Availability

| Field | Value |
|-------|-------|
| Price | `Free (USD 0)` |
| Availability | All countries / regions |

### 4.4 Version Information (the main "1.0.0" page)

**Promotional Text (170 chars max):**
```
Built for DoorDash, UberEats, Instacart & GrubHub drivers — log earnings in seconds, see real profit per mile, and hit your daily goals.
```

**Description (4000 chars max):**
```
Earnings Ninja is the fastest way for delivery drivers to track real take-home pay across DoorDash, UberEats, Instacart, GrubHub, and Shipt — without juggling spreadsheets or screenshots.

CALCULATOR-STYLE ENTRY
Tap a number, pick the platform, done. No tedious forms. Add gas, tolls, and tips in the same flow.

REAL-TIME PROFIT
Watch revenue, expenses, $/mile, $/hour, and your daily/weekly/monthly profit update the moment you log a trip.

HOME SCREEN + LOCK SCREEN WIDGETS
The Earnings Ninja widget shows today's net profit and adds revenue or expense entries with a single tap — no need to open the app.

GOAL TRACKING
Set a daily profit target and watch the progress bar fill in real time. Celebratory milestones at $50, $100, $150…

EXPENSE TRACKING WITH RECEIPTS
Snap a photo of any receipt and attach it to the expense. Categorize gas, tolls, food, parking, and more.

THREE THEMES
Dark Neon (default car-dashboard look), Simple Light, and B/W Neon. Switch instantly in Settings.

PRIVACY-FIRST
We don't track you across other apps. We don't sell your data. We don't run ads. Your data is only used for password-reset emails (Resend) and, optionally, anonymous earnings aggregates sent to OpenAI to power the AI Earning Suggestions feature.

TRIP MILEAGE
Track miles per trip manually or let the app calculate distance from start/end addresses.

CSV EXPORT
Export every entry plus summary stats to CSV for taxes or your bookkeeper.

Built for the gig economy. Made for drivers, by drivers.
```

**Keywords (100 chars max, comma-separated):**
```
delivery,doordash,uber,grubhub,instacart,shipt,driver,gig,mileage,expense,tax,earnings,tip,1099
```

**Support URL:** `https://earningsninja.app/support` *(or your real URL — App Store rejects placeholder URLs)*
**Marketing URL:** `https://earningsninja.app` *(optional but recommended)*
**Copyright:** `© 2026 Earnings Ninja`

### 4.5 What's New in This Version

```
First release — track delivery earnings, expenses, and profit in real time across DoorDash, UberEats, Instacart, GrubHub, and Shipt. Includes a one-tap Home Screen and Lock Screen widget for quick entry.
```

### 4.6 App Review Information

**Sign-In Required:** YES

**Demo Account:**
- Username: `demo@earningsninja.app`
- Password: `Demo1234!`

> Make sure this account exists on your production backend with some sample data so reviewers can see the dashboard populated.
> If you don't want to expose a real demo, use the in-app **"Try Demo"** button on the login screen (which calls `/api/auth/demo`) and tell the reviewer in the notes below.

**Notes for the reviewer:**
```
Earnings Ninja is a personal financial tracking tool for independent gig delivery drivers (DoorDash, UberEats, Instacart, GrubHub, Shipt). It does not connect to any payment processor — drivers manually log what they earned and spent each day so they can see real profit per mile and per hour.

Key things to test:
1. Log in with the demo account or tap "Try Demo" on the login screen.
2. Tap the yellow "+ Add Entry" button → enter "25" → pick DoorDash → Save. The dashboard updates instantly.
3. Tap "+ Add Entry" again → switch to "Subtract" → pick a category like "Gas" → enter "10" → Save. The profit number updates.
4. Switch period chips (Today / This Week / This Month) at the top.
5. Tap the gear icon (top right) to see the three theme options and the calendar / range selector.

iOS WIDGET (on iOS 17+):
The app installs a Home Screen + Lock Screen widget called "Earnings Ninja". Long-press the Home Screen → + → search "Earnings Ninja" to add it. The widget shows today's net profit and lets you tap quick-amount buttons ($10, $25, etc.) to log revenue or expenses without opening the app. The widget uses an App Group (group.com.earningsninja.shared) to share auth token + API base URL with the main app — the token is sandboxed to the App Group and is never exposed to other apps. The widget extension refuses to attach the bearer token to any URL that does not start with https://.

ACCOUNT DELETION (Guideline 5.1.1(v)):
Settings (gear icon, top right) → scroll to Danger Zone → "Delete My Account". Two confirmation dialogs, then the account and ALL associated data (entries, settings, goals, OAuth credentials, etc.) are permanently deleted via DELETE /api/auth/account.

PRIVACY: We collect email (for login + Resend password-reset emails) + manually-entered earnings/expense data + optional receipt images. We do NOT collect location, device identifiers, contacts, or any tracking data. No analytics SDKs (no Sentry, no Firebase, no Amplitude). The optional AI Earning Suggestions feature sends aggregated, non-PII earnings statistics to OpenAI's GPT-4o-mini API.

Backend: https://earnings-pro-is-8-production.up.railway.app (FastAPI/Python on Railway).
```

**Contact Information:** Your name, email, phone — Apple will call/email if they have questions during review.

### 4.7 Build (the .ipa from EAS)

After `eas submit` finishes and Apple's "Processing" stage completes (~10–30 min):

1. Go to App Store Connect → your app → **Build** section.
2. Click **+** → pick the build you just submitted (it will be named something like `1.0.0 (1)`).
3. Apple may ask "Does your app use the Advertising Identifier (IDFA)?" → **No**.

### 4.8 Submit for Review

1. Click **Add for Review** (top right).
2. Fill in any remaining fields (Apple highlights them in red).
3. Click **Submit to App Review**.

Review typically takes **24–48 hours**.

---

## Step 5 · Pre-Submission Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Bundle ID matches across `app.json`, `eas.json`, App Store Connect, and Apple Developer | ✅ `com.earningsninja.app` |
| 2 | App icon is 1024×1024 PNG, RGB, no alpha channel | ✅ |
| 3 | Splash screen image present and matches brand | ✅ `assets/splash.png` |
| 4 | All `infoPlist` permission strings explain WHY (camera, photo library, location) | ✅ |
| 5 | `ITSAppUsesNonExemptEncryption: false` (we don't ship custom crypto) | ✅ |
| 6 | `NSAllowsArbitraryLoads` REMOVED from production build | ✅ |
| 6b | `ios.privacyManifests` block in `app.json` declares all required-reason APIs | ✅ |
| 6c | Widget extension target has its own `PrivacyInfo.xcprivacy` (verify in Xcode after prebuild) | ⚠️ Verify after prebuild |
| 7 | Backend production URL is HTTPS | ✅ Railway TLS |
| 8 | Main-app auth token stored in iOS Keychain via `expo-secure-store` | ✅ |
| 8b | Widget gets a *copy* of the bearer token in App Group UserDefaults (sandboxed to the App Group, not exposed to other apps; required so the App Intent can POST without launching the app). Documented honestly in reviewer notes. | ✅ Documented |
| 9 | Bearer token never sent to non-HTTPS URL (widget refuses to attach the token unless `api_base` starts with `https://`) | ✅ |
| 10 | Widget App Group entitlement declared in BOTH targets | ✅ |
| 11 | Widget extension's `Deployment Target ≥ 17.0` for App Intents | ✅ |
| 12 | Min iOS version set to 17.0 in `app.json` | ✅ |
| 13 | App version + build number set, eas.json auto-increments build number | ✅ |
| 14 | Apple Team ID filled in (`appleTeamId` in `app.json` and `eas.json`) | ⚠️ TODO — replace placeholder |
| 15 | App Store Connect numeric App ID filled in (`ascAppId` in `eas.json`) | ⚠️ TODO — fill after creating app entry |
| 16 | Apple ID email filled in (`appleId` in `eas.json`) | ⚠️ TODO — replace placeholder |
| 17 | Demo account exists on production backend | ⚠️ TODO — verify `demo@earningsninja.app` works |
| 18 | At least 3 screenshots for 6.9" iPhone uploaded to App Store Connect | ⚠️ TODO — capture after first build |
| 19 | App Store description, keywords, support URL filled in | ⚠️ TODO — paste from Step 4.4 |
| 20 | Privacy Label completed in App Store Connect | ⚠️ TODO — copy from Step 2 table |
| 21 | Age Rating answered (will produce 4+) | ⚠️ TODO — quick form |
| 22 | App category set to Finance (primary), Business (secondary) | ⚠️ TODO — in App Information |
| 23 | No console.log of secrets / tokens in production code | ✅ Audit clean |
| 24 | No placeholder text like "Lorem ipsum" or "TODO" visible to users | ✅ |
| 25 | All deep-link routes (`earningsninja://entry/new`) work in release build | ✅ Tested |
| 26 | App handles offline / no-network gracefully (no crashes) | ✅ React Query retries + error states |
| 27 | App handles failed login gracefully (shown error message) | ✅ |
| 28 | "Forgot Password" flow works end-to-end with Resend email | ✅ |
| 29 | Receipt upload works end-to-end (base64 round-trip) | ✅ |
| 30 | TypeScript clean (`npx tsc --noEmit`) | ✅ |

---

## Step 6 · Common rejection reasons — and how we avoid them

| Guideline | Common rejection | Our defense |
|-----------|------------------|-------------|
| **2.1 — App Completeness** | Crashes on first launch, broken sign-in | Reviewer can use the demo account or "Try Demo" button. App handles network errors with friendly alerts. |
| **2.3.10 — Inaccurate Metadata** | Description mentions features not in the app | Description above only mentions shipped features. No mention of crypto, predictions, AI training, etc. |
| **3.1.1 — Payments / In-App Purchases** | App offers digital subscriptions but doesn't use IAP | App is 100% free, no subscriptions, no purchases. |
| **4.0 — Design** | "Web view wrapper" — submitting a website as an app | App is fully native React Native. No `WKWebView`, no `react-native-webview`. |
| **4.2 — Minimum Functionality** | App is just a webpage / has no real native features | App has a native iOS Widget with App Intent, native camera & photo library access, Keychain for credentials, native gesture handlers — substantial native value. |
| **5.1.1(v) — Permission Strings** | Permission requested without clear explanation | All three permission strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`) clearly explain the user-facing reason. |
| **5.1.1 — Privacy: Account Deletion** | App requires sign-up but offers no way to delete the account | ✅ **Fixed in this submission.** Settings → Danger Zone → "Delete My Account" calls `DELETE /api/auth/account`, which cascades through every user-linked table (entries, settings, goals, OAuth credentials, synced orders, achievements, friends, password-reset tokens). Two confirmation dialogs prevent accidental taps. |
| **5.1.2 — Tracking** | App uses tracking SDKs without ATT prompt | We do NOT use any tracking SDKs. No ATT prompt needed. |
| **5.4 — VPN apps / Network Extensions** | Misuse of network capabilities | N/A. |
| **App Tracking Transparency** | App accesses IDFA without prompting | We don't access IDFA at all. |

### ⚠️ Known gaps you must close before submitting

1. ✅ ~~**Account Deletion** (Guideline 5.1.1(v))~~ — **DONE in this submission prep.** SettingsModal → Danger Zone → "Delete My Account" → backend cascades all user data.

2. **Support URL** — `https://earningsninja.app/support` is a placeholder. Apple checks that this URL resolves and looks legitimate. Set up at least a one-page support site (a Notion page or simple landing page is fine) before submitting. Must include a contact email.

3. **Privacy Policy URL** — Required when Privacy Labels declare any data collection. Write a short privacy policy mentioning Resend and (if enabled) OpenAI, and host it at `https://earningsninja.app/privacy`. Reference it in App Store Connect → App Privacy → Privacy Policy URL.

4. **Production demo account** — Confirm `demo@earningsninja.app` / `Demo1234!` actually exists on the Railway backend with seeded sample data, OR remove the credentials from "App Review Information" and tell the reviewer to use the in-app "Try Demo" button on the login screen (which calls `/api/auth/demo`). The Try Demo path is more reliable because it provisions a fresh seeded account on every tap.

5. **Widget extension privacy manifest** — After `expo prebuild`, verify that `ios/widget/` contains its own `PrivacyInfo.xcprivacy`. If `@bacons/apple-targets` doesn't generate one for the widget extension target, copy the main app's file into the widget folder and add it to the EarningsWidget target in Xcode (File → Add Files → check the EarningsWidget target box). Apple checks privacy manifests at the per-target level since iOS 17.4.

6. **Apple Developer App Group registration** — Manually enable the App Groups capability for BOTH bundle IDs (`com.earningsninja.app` and `com.earningsninja.app.widget`) at <https://developer.apple.com/account/resources/identifiers/list>. EAS will regenerate provisioning profiles after that.

---

## Final Status

**Code & config: ✅ Ready for submission** *(after you fill in the 3 placeholder credentials marked above and add an account-deletion button)*

**App Store Connect: ⚠️ Manual steps remaining** — create app entry, paste description/keywords, capture and upload screenshots, complete Privacy Label, and submit a review demo account.

You can run `eas build --platform ios --profile production` right now (after replacing the team ID), but don't run `eas submit` until you've completed Step 4.

---

## Quick reference — file changes in this submission prep

| File | Change |
|------|--------|
| `app.json` | Removed `NSAllowsArbitraryLoads`; added `deploymentTarget: 17.0`, `appleTeamId` placeholder, `LSApplicationCategoryType: finance`, `NSPhotoLibraryAddUsageDescription`, production `extra.apiBase`, AND `ios.privacyManifests` block (required-reason API declarations for UserDefaults / FileTimestamp / SystemBootTime / DiskSpace + `NSPrivacyTracking: false`) |
| `eas.json` | `production.autoIncrement: buildNumber`, `m-medium` resource class for all profiles, production env points to Railway, submit profile placeholders |
| `lib/widgetSync.ts` | Now imports `API_BASE` directly from `lib/api.ts` so the widget can never drift to a different backend than the JS app |
| `lib/api.ts` | Added `api.deleteAccount()` → `DELETE /api/auth/account` |
| `app/(tabs)/index.tsx` | Added "Danger Zone → Delete My Account" section in `SettingsModal` with two confirmation dialogs (Apple Guideline 5.1.1(v)) |
| `backend/routers/auth_routes.py` | Added `DELETE /api/auth/account` endpoint that cascades through every user-linked table (entries, settings, goals, ApiCredential, SyncedOrder, DailyUsage, Friend, Achievement, Congratulation, PasswordResetToken, AuthUser) |
