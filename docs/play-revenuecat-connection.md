# Connect Play Console → RevenueCat (Android purchases)

Status (Aug 3, 2026):
- RevenueCat is fully provisioned: Play app `com.earningsninja.app`, entitlement `pro`, offering `default`, publishable key `goog_hsdwBCfpbMMbkaQrulzVYROiZiB`.
- First AAB build kicked off: https://expo.dev/accounts/inventor01/projects/earnings-ninja/builds/5ac82675-327c-4962-904f-49e1507c7ddb
- What's left is manual work in Play Console / Google Cloud / RevenueCat dashboard (steps below).

## 1. Upload the first AAB to Play Console
Account: earningsninjaapp@gmail.com

1. Wait for the EAS build above to finish, then download the `.aab` from that page.
2. Play Console → Create app (name: Earnings Ninja, package `com.earningsninja.app` is set by the AAB).
3. Testing → Internal testing → Create release → upload the AAB → save/roll out to internal testers.
   (Personal accounts also need the 12-testers / 14-day closed test before production — internal testing is enough for now.)

## 2. Create the products in Play Console (identifiers must match exactly)
RevenueCat expects these store identifiers:

| Play Console item | Type | Product ID | Base plan ID |
|---|---|---|---|
| Pro Monthly | Subscription | `pro_monthly` | `monthly` |
| Pro Yearly | Subscription | `pro_yearly` | `yearly` |
| Pro Lifetime | In-app product (one-time) | `pro_lifetime` | — |

Monetize → Products → Subscriptions: create `pro_monthly` with a base plan whose ID is exactly `monthly`; create `pro_yearly` with base plan `yearly`. Set prices, then **Activate** both the subscription and its base plan.
Monetize → Products → In-app products: create `pro_lifetime`, set price, **Activate**.

> The base-plan IDs matter: RevenueCat's products are `pro_monthly:monthly` and `pro_yearly:yearly` (subscriptionId:basePlanId).

## 3. Create the Google Cloud service account + JSON key
1. console.cloud.google.com (same Google account) → create/select a project.
2. APIs & Services → Enable **Google Play Android Developer API** (and **Google Play Developer Reporting API** if offered).
3. IAM & Admin → Service Accounts → Create service account (e.g. `revenuecat`). No GCP roles needed.
4. Open the service account → Keys → Add key → JSON → download the JSON file.

## 4. Grant the service account access in Play Console
Play Console → Users and permissions → Invite new users → paste the service account email (`…@…iam.gserviceaccount.com`).
Account permissions: **View app information and download bulk reports**, **View financial data**, **Manage orders and subscriptions**. Invite/Save.

## 5. Upload the JSON to RevenueCat
RevenueCat dashboard → Projects → Earnings Ninja → Apps → **Earnings Ninja (Android)** → Service credentials JSON → upload the JSON file → Save.

Notes:
- Google can take **up to 36 hours** to propagate new credentials; RevenueCat may show "Invalid credentials" until then. Purchases made in that window are still recorded once credentials validate.
- Done = the Android app page shows credentials **Valid / Connected**.
