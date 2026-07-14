# Delivery Driver Earnings Dashboard

## Overview
This project is a mobile-first application for delivery drivers ("Earnings Ninja"). It helps drivers track earnings, expenses, mileage, and profit across multiple gig platforms (DoorDash, UberEats, Instacart, GrubHub), with real-time financial insights, AI-powered earning suggestions, and a "Car Dashboard Aesthetic" UI with neon-glowing KPIs. Components: Expo iOS app (`earnings-ninja-expo/`, the primary product, in App Store review), FastAPI backend (`backend/`, production on Railway), React web app (`frontend/`), and marketing landing site (`landing/`).

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
Two-theme system ("Dark" default — neon Car-Dashboard look; "Light" — clean white keeping the brand neon accents/glows). Key UI: calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars, celebratory alerts, multi-platform data entry, expense tracking with emoji categories, receipt image uploads, neon-glow shadows and micro-animations, GPS trip tracking, mass selection/bulk deletion, CSV export, swipe gestures for daily navigation, and a calendar modal with multi-day range selection.

### Technical Implementations
Real-time KPI dashboards, profit goal tracking, time period filtering, multi-platform entry, expense tracking, base64 receipt uploads, GPS mileage, entry management (mass select/bulk delete/reset/edit), AI earning suggestions, OAuth order syncing for Uber Eats and Shipt (hourly background jobs, duplicate prevention), transaction search, CSV export, password reset via Resend email, and a native iOS Widget (display-only, tap opens the app).

### System Design Choices
Backend: FastAPI (Python 3.11) + SQLAlchemy. Frontend: React 18 + TypeScript + Vite + Tailwind. State: TanStack React Query + Theme Context. Theme persistence via AsyncStorage (mobile) / localStorage (web). On Expo the neon-yellow accent splits into `PRIMARY` (neon `#facc15` for fills/glows/borders) and `PRIMARY_TXT` (readable gold `#a16207` in Light, identical neon in Dark). Signed amounts for expenses/cancellations; dynamic profit calculations. OAuth 2.0 + bcrypt; APScheduler hourly sync jobs; `expo-secure-store` for tokens; iOS Widget via App Groups shared UserDefaults.

## External Dependencies
- **OpenAI GPT-4o-mini**: AI Earning Suggestions.
- **FastAPI / SQLAlchemy / Uvicorn / APScheduler / httpx / bcrypt / pytz / aiosmtplib**: backend stack.
- **Resend**: password-reset email service.
- **Tailwind CSS / TanStack React Query / Vite**: web frontend stack.
- **expo-image-picker, react-native-gesture-handler, @expo/vector-icons, expo-secure-store, expo-linking, expo-audio, expo-notifications, expo-application**: Expo app.
- **@bacons/apple-targets**: iOS Widget Extension config plugin.
- **react-native-purchases / react-native-purchases-ui**: RevenueCat subscriptions (entitlement `pro`, offering `default`).
- **@replit/revenuecat-sdk**: server-side, only in `scripts/seedRevenueCat.ts` (never imported by the client).

## Deployment & OTA rules (IMPORTANT — operational)
- The mobile app talks to the **deployed** backend (Railway), so frontend-only changes ship over-the-air; do not assume local backend changes are live.
- **JS/UI/logic changes** → `cd earnings-ninja-expo && eas update --branch preview --message "..."` (OTA-deployable).
- **Native changes** (new native dep, icon/splash, `app.json` plugin/permission, SDK bump, widget target, buildNumber) → `eas build --platform ios --profile testflight --auto-submit` (NOT OTA; OTA only reaches the new build forward).
- OTA uses `runtimeVersion: { policy: "fingerprint" }`. An update only reaches a build whose native fingerprint matches; **`eas.json` and `ios.buildNumber` are fingerprint sources** — `autoIncrement` lives on `production` only. Detail: `.agents/memory/eas-ota-not-landing.md`.
- Standard pre-ship checks for mobile work: `npx tsc --noEmit` (exit 0) + `npx expo export --platform ios` (exit 0).
- `eas` CLI needs `GIT_CEILING_DIRECTORIES=/home/runner EAS_NO_VCS=1`; `eas build` can exit -1 silently yet still register — verify via `eas build:list --json`. Submissions checkable via Expo GraphQL.

## Current App Store status (Jul 14)
- **Build 26** (`ec6204a0`, `ios.buildNumber` "26") FINISHED + submitted to ASC — carries the Cal-AI trial-forward paywall. Supersedes build 25 (compliant billed-first paywall, was in review after the Jul 13 3.1.2(c) rejection of build 24).
- RevenueCat: fully provisioned (project `proj08f4330c`, entitlement `pro`, offering `default` with `$rc_lifetime`/`$rc_annual`/`$rc_monthly`); production `appl_` key baked into `testflight`/`production` profiles; Apple Paid Applications agreement ACTIVE. Detail: `.agents/memory/revenuecat-integration.md`.

## Outstanding [USER ACTION] items
- **ASC resubmission**: add IAP review screenshots ("Ready to Submit"), attach the 3 IAPs to the app version, select **build 26**, submit for review. Also create `pro_lifetime` ($79.99 non-consumable) as a separate IAP in ASC if not done.
- **Configure the 7-day free trial** (intro offer) on `pro_yearly` in ASC — the trial-forward paywall UI only appears when a real free trial exists; intro offers surface automatically via `product.introPrice`.
- Enable the **Sign In with Apple** capability on App ID `com.earningsninja.app` in the Apple Developer portal (needed at runtime).
- **Add `REVENUECAT_SECRET_API_KEY` (v1 secret key) to Railway** — without it, referral free-month grants are skipped (fail-soft; referrals still recorded, slot pending).

## Recent Changes (condensed — full detail in git history + `.agents/memory/`)
- **Jul 13–14 — Cal-AI trial-forward paywall → build 26**: after build 24's 3.1.2(c) rejection, build 25 shipped a billed-price-dominant paywall; the FallbackPaywall was then rebuilt per the user's Cal AI reference: trial headline, 3-step trial timeline (Today / Day N-2 reminder / Day N billing with billed amount), pill plan cards with "{N} DAYS FREE" ribbon, "✓ No Payment Due Now", CTA "Start My N-Day Free Trial" with billed footnote directly under it. ALL trial UI is conditional on a real ASC free trial (falls back to billed-first layout + grouped benefits card). Billed price remains the dominant price element on three surfaces. Shipped as native build 26. `.agents/memory/paywall-billed-price-prominence.md`.
- **Jun 26–27 — RevenueCat Pro + referrals shipped (builds 8–13 saga resolved)**: RevenueCat SDK integrated (`lib/revenuecat.tsx`, entitlement `pro`, fails OPEN without native module); CSV Export + Advanced Analytics gated behind Pro; referral program ("both get 1 free month", referrer cap 3, atomic guards, fail-soft RC v1 REST grants — `.agents/memory/referral-grant-concurrency.md`); Manage Subscription opens the OS-native subscriptions screen directly (`itms-apps://`) after an unconfigured RC Customer Center proved to resolve silently; widget simplified to display-only; one OTA incident (crash-loop on build 11, recovery = delete + reinstall) led to baking fixes into native builds — `.agents/memory/eas-ota-not-landing.md`, `.agents/memory/revenuecat-integration.md`.
- **Jun 15 — Two-theme system (Dark/Light)** with `PRIMARY`/`PRIMARY_TXT` token split; **expo-av → expo-audio** migration; Lock Screen widget quick-add (later removed Jun 26); ka-ching save sound. `.agents/memory/theme-system.md`.
- **Jun 1 — UX round**: Analytics instant refresh, period swipe/chevron nav from any period, scroll-to-top FAB, optimistic delete, motivation notifications (2/day, Hidden-Mode-aware).
- **May 25–30 — Foundation round**: security hardening (JWT required at boot, rate limits, CORS allow-list, 2 MB receipt cap), offline entry queue, Hidden Mode, CSV export/import, Analytics page, EAS Update/OTA proven end-to-end. See `docs/APP_STORE_CHECKLIST.md`.
- **Apr 30 — Marketing landing site** (`landing/`, Vite+React+Tailwind, port 5173): set `APP_STORE_URL` in `landing/src/App.tsx` to flip the "Coming soon" badge.
