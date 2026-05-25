# Earnings Ninja — App Store Connect Submission Checklist

A working list of every item that has to be in place before the app can be uploaded to App Store Connect and submitted for review. Items marked **[USER]** require the human (App Store Connect access, real Apple Developer account, screenshots from a real device) — they cannot be done from the agent environment.

---

## 1. Apple Developer account & identifiers

- [USER] Active Apple Developer Program membership ($99/yr) under the team that will own the app.
- [USER] Replace `appleTeamId` in `earnings-ninja-expo/app.json` (currently `REPLACE_WITH_YOUR_10_CHAR_TEAM_ID`) with the real 10-character Team ID.
- [USER] Register the App ID `com.earningsninja.app` in the Apple Developer portal with the following capabilities enabled:
  - **Sign In with Apple**
  - **App Groups** (`group.com.earningsninja.shared` — already in `app.json`, required by the iOS Widget)
  - **WidgetKit / Widget Extension** (auto-handled via `@bacons/apple-targets`)
- [USER] Create an App ID for the widget extension target if Xcode prompts for one during EAS build.

## 2. App Store Connect record

- [USER] Create the app record in App Store Connect with the same bundle id (`com.earningsninja.app`).
- [USER] Choose category: **Finance** (matches `LSApplicationCategoryType` in `app.json`).
- [USER] Set the app's primary language and price tier (free).

## 3. Metadata (App Information)

- [USER] App name: `Earnings Ninja`
- [USER] Subtitle (≤30 chars): suggested *"Driver Earnings & Profit"*
- [USER] Promotional text (≤170 chars, editable post-launch)
- [USER] Description: pull copy from the landing site (`landing/src/App.tsx`) — features list and honest-math angle.
- [USER] Keywords (≤100 chars, comma-separated): suggested *"doordash,ubereats,instacart,grubhub,delivery driver,gig,mileage,profit,1099,taxes"*
- [USER] Support URL: the FastAPI `/support` page served by the backend.
- [USER] Privacy Policy URL: the FastAPI `/privacy` page served by the backend.
- [USER] Marketing URL (optional): the landing site root.

## 4. Screenshots

App Store Connect requires screenshots at **two display sizes** for iPhone (6.7" and 6.5" or 6.1" — 6.7" alone satisfies the rest):

- [USER] iPhone 6.7" (1290×2796) — minimum 3, maximum 10.
- [USER] iPhone 6.5" / 6.1" (1284×2778 or 1179×2556) — optional but recommended.
- [USER] iPad Pro 12.9" — only if the app supports iPad. **It does not** (`supportsTablet: false`), so skip.
- Recommended screens to capture (matches the landing-site showcase):
  1. Dashboard with neon KPIs
  2. Add-entry calculator (Order branch)
  3. Add-entry expense branch with receipt thumbnail
  4. History list / day picker
  5. Goal-progress hero card
  6. Settings → theme switcher (showcases all three themes)
  7. (optional) Home Screen with the widget tile

## 5. App Privacy ("Nutrition Label")

In App Store Connect → App Privacy, declare exactly what is collected. Based on the current codebase:

- **Identifiers**: Email address (when the user signs up with email/password, or when SIWA returns a non-relay email) → linked to identity, used for App Functionality.
- **Financial Info**: Other Financial Info (the user's own earnings/expenses they log) → linked to identity, used for App Functionality. *Not* used for tracking.
- **Location**: Coarse Location → linked to identity, used for App Functionality (only when the user opts into GPS trip tracking).
- **Photos**: Photos → linked to identity, used for App Functionality (only when the user attaches a receipt).
- **Usage Data**: None (no analytics SDKs).
- **Diagnostics**: None.
- **Tracking**: No — the app does not track users across other companies' apps/sites.

## 6. Sign In with Apple

- Backend endpoint: `POST /api/auth/apple` (verifies identity token against Apple's JWKS, see `backend/routers/auth_routes.py`).
- Client: button rendered in `earnings-ninja-expo/app/login.tsx`, gated on `AppleAuthentication.isAvailableAsync()` (iOS 13+).
- App.json: `ios.usesAppleSignIn: true` and `expo-apple-authentication` listed in `plugins`.
- [USER] Verify the App ID in the Apple Developer portal has the **Sign In with Apple** capability enabled before the first EAS build.

## 7. Encryption export compliance

- `ITSAppUsesNonExemptEncryption: false` is already declared in `app.json → ios.infoPlist`. No additional ERN/CCATS filing required as long as the app only uses Apple's standard cryptography (HTTPS / SIWA / SecureStore).

## 8. Build & upload

- [USER] Install EAS CLI: `npm i -g eas-cli`, then `eas login`.
- [USER] From `earnings-ninja-expo/`: `eas build --platform ios --profile production`.
- [USER] On first build EAS will prompt to either upload an existing distribution certificate / provisioning profile or generate one — pick "Let EAS handle it" unless you already have a cert.
- [USER] After the build finishes, upload it to App Store Connect: `eas submit --platform ios --latest`.

## 9. Required testing before submission

- [USER] TestFlight internal test with at least one real device for each of: email signup, email login, Sign In with Apple, forgot-password flow, GPS trip tracking permission prompt, receipt photo attach, widget tile add-from-home-screen.
- [USER] Confirm that the offline entry queue works: turn airplane mode on, add an entry, turn airplane mode off — the entry should appear in the dashboard after a few seconds.

## 10. Review notes

In the App Review notes field, include:

- A demo account credential so the reviewer doesn't have to sign up (or note that the **"🚗 Try Demo Mode"** button on the login screen creates one for them).
- One-line explanation of why the app requests location: *"Used only when the driver enables GPS trip tracking from the dashboard; mileage is computed on-device and never sent to a third party."*

---

## Deferred / future

- **Receipt object storage** (KI follow-up): currently receipts are stored as base64 inline in the `entries.receipt_url` column, capped at ~2 MB per entry (see `backend/schemas.py`). Long-term we should move to S3 / R2 / Replit Object Storage and store only the URL — needs a provider choice and a migration script that walks existing entries.
- **Per-credential rate limiting** (KI follow-up): the `/auth/login` limit is currently per-IP (10/min). Once we deploy behind a CDN/proxy that exposes the real client IP we should add a second, per-credential limit (e.g. 5 wrong passwords per email per hour) — slowapi's `key_func` can't read the request body so this needs a small custom middleware.
