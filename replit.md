# Delivery Driver Earnings Dashboard

## Overview
This project is a mobile-first web application designed for delivery drivers. Its primary purpose is to help drivers track earnings, expenses, mileage, and profit across multiple gig platforms (DoorDash, UberEats, Instacart, GrubHub). The application aims to provide real-time financial insights, AI-powered earning suggestions, and a unique "Car Dashboard Aesthetic" UI with neon-glowing KPIs and animated elements to optimize driver income and enhance goal tracking. The business vision is to empower gig economy drivers with tools to maximize their financial performance and simplify their accounting.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application features a two-theme system ("Dark" default — the neon Car-Dashboard look, and "Light" — clean white background that keeps the exact brand neon accents/glows) with dynamic UI components, animated car emojis, and diverse fonts. Key UI elements include calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars, and celebratory alerts. It supports multi-platform data entry, expense tracking with emoji categories, and receipt image uploads. The interface incorporates neon-glow shadows, micro-animations for KPI updates, press-scale effects on interactive elements, GPS trip tracking, mass selection/bulk deletion, and CSV export. Swipe gestures facilitate daily navigation, and a calendar modal allows multi-day range selection and custom date filtering.

### Technical Implementations
Core functionalities include real-time KPI dashboards, profit goal tracking, and time period filtering. The system supports multi-platform data entry, expense tracking, and base64 encoded receipt uploads. GPS trip tracking automatically calculates distances. Users can manage entries (mass select, bulk delete, reset, edit) and visually track profit goals. AI-powered earning suggestions are provided. OAuth integration with Uber Eats and Shipt enables automatic order syncing via hourly background jobs with duplicate prevention. Features also include transaction search, CSV data export, and password reset via email service. A native iOS Widget provides quick entry functionality.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLAlchemy ORM for SQLite. The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A two-theme system ("Dark"/"Light") is implemented with persistence (AsyncStorage on mobile / localStorage on web). On the Expo app the neon-yellow brand accent is split into two tokens — `PRIMARY` (neon `#facc15` for fills/glows/borders) and `PRIMARY_TXT` (readable gold `#a16207` in Light, identical neon in Dark) — so foreground text stays legible on white while fills keep the brand neon. Data storage uses signed amounts for expenses and cancellations, and real-time profit calculations are dynamic. Security features include OAuth 2.0 and bcrypt for password hashing. APScheduler manages hourly background sync jobs, and a dedicated sync service standardizes platform data. Authentication tokens are securely stored using `expo-secure-store`. The application also integrates an iOS Widget for quick data entry using App Groups for shared UserDefaults.

## External Dependencies
- **OpenAI GPT-4o-mini**: AI Earning Suggestions.
- **Tailwind CSS**: Styling and responsive design.
- **TanStack React Query**: Frontend state management.
- **FastAPI**: Python web framework for the backend.
- **SQLAlchemy**: ORM for SQLite database interaction.
- **Uvicorn**: ASGI server for FastAPI.
- **Vite**: Frontend build tool.
- **APScheduler**: Background job scheduler.
- **httpx**: Async HTTP client for external API calls (Uber, Shipt).
- **bcrypt**: Secure password hashing.
- **pytz**: Timezone conversions.
- **aiosmtplib**: Asynchronous email sending.
- **Resend**: Email service for password resets.
- **expo-image-picker**: Receipt photo uploads.
- **react-native-gesture-handler**: Swipe gestures.
- **@bacons/apple-targets**: Config plugin for iOS Widget Extension generation.
- **@expo/vector-icons**: Icons used in the application.
- **expo-secure-store**: Secure storage for authentication tokens.
- **expo-linking**: Deep linking functionality.
- **react-native-purchases / react-native-purchases-ui**: RevenueCat in-app subscriptions, Paywall UI, and Customer Center (entitlement `pro`).
- **@replit/revenuecat-sdk**: Server-side REST SDK used only by `scripts/seedRevenueCat.ts` to provision RevenueCat config (never imported by the client).
## Deployment & OTA rules (IMPORTANT — operational)
- The mobile app talks to the **deployed** backend, so frontend-only changes ship over-the-air; do not assume local backend changes are live.
- **JS/UI/logic changes** → `cd earnings-ninja-expo && eas update --branch preview --message "..."` (OTA-deployable).
- **Native changes** (new native dep, icon/splash, `app.json` plugin/permission, SDK bump, widget target) → `eas build --platform ios --profile preview` (NOT OTA; OTA only reaches the new build forward).
- OTA uses `runtimeVersion: { policy: "fingerprint" }`. An update only reaches a build whose native fingerprint matches; **`eas.json` is a fingerprint source**, so `autoIncrement` lives on `production` only — re-add it to `preview` ONLY as part of a native rebuild, never in isolation, or OTA stops reaching the installed build. Detail: `.agents/memory/eas-ota-not-landing.md`.
- Standard pre-ship checks for mobile work: `npx tsc --noEmit` (exit 0) + `npx expo export --platform ios` (exit 0).

## Outstanding [USER ACTION] items
- **RevenueCat dashboard config is NOT provisioned.** The Replit RevenueCat connector's OAuth is broken (`invalid_grant`), so `scripts/seedRevenueCat.ts` cannot run yet. Finish one of two ways: (a) reconnect the RevenueCat integration, then `npx tsx scripts/seedRevenueCat.ts` (idempotent — creates entitlement `pro`, products lifetime/yearly/monthly, offering `default` + packages `$rc_lifetime`/`$rc_annual`/`$rc_monthly`, test-store prices), OR (b) create the same entities in the RevenueCat dashboard. Until provisioned the app **fails OPEN** (premium features stay ungated). Also design a Paywall for offering `default` in the dashboard, otherwise the in-app `FallbackPaywall` is used. A NEW EAS build is required regardless (native deps don't OTA).
- **Native preview build `c00bba84` is BUILDING on EAS (triggered Jun 16; `ios.buildNumber` "3").** It bakes in **expo-audio** + ALL current JS (Analytics/Expenses default-to-Today, two-theme system, Lock Screen widget quick-add, etc.). Track/download: https://expo.dev/accounts/inventor01/projects/earnings-ninja/builds/c00bba84-70eb-43c2-86ad-ef1265fb4864 — once it finishes, **install it on the device**; after that, JS OTAs published from the current tree land forward (its fingerprint matches this build). Background: prior build `a1eabfce` shipped expo-av (NOT expo-audio) and had a non-matching fingerprint (`a76a90d3` vs current `76a621ee`), so OTAs could not reach it; it was also build 2, hence the bump to 3 so iOS doesn't treat the new build as "already installed."
- Enable the **Sign In with Apple** capability on App ID `com.earningsninja.app` in the Apple Developer portal so the feature works at runtime (the build itself succeeded, but the App ID capability is needed for the flow to function).

## Recent Changes (condensed — full detail in git history + `.agents/memory/`)
- **Jun 26 — RevenueCat (Pro subscription) integrated**: official RN SDK (`react-native-purchases` + `react-native-purchases-ui` ^10.4.0, autolinked — no config plugin) wired via `lib/revenuecat.tsx` (`SubscriptionProvider`/`useSubscription`, mounted under `AuthProvider` in `app/_layout.tsx`). Entitlement id **`pro`** (dashboard display "Earnings Ninja Pro"); offering **`default`** with `$rc_lifetime`/`$rc_annual`/`$rc_monthly`. **CSV Export + Advanced Analytics** gated behind `requirePro()`; Settings gains an "Earnings Ninja Pro" section (Upgrade → Paywall / Manage Subscription → Customer Center / Restore). Public iOS **test** key embedded as default; override with `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and swap to an `appl_…` key for production. **Fails OPEN** when the native module is absent (no regression on pre-native build 9 — features stay ungated). Custom `FallbackPaywall` (prices read live from the offering) shows when no dashboard paywall is published. **NEW native deps → next EAS build required (NOT OTA).** ⚠️ Dashboard config NOT provisioned yet (RevenueCat connector OAuth broken — `invalid_grant`); `scripts/seedRevenueCat.ts` is updated + ready to run once the integration is reconnected. `.agents/memory/revenuecat-integration.md`.
- **Jun 26 — Widget simplified to display-only**: removed all quick-add (+$/−$) buttons from Home Screen (Small/Medium) and Lock Screen (rectangular) widgets; they now show today's net profit + gross revenue with a "Tap to add an entry" hint, and tapping opens the app via `earningsninja://entry/new`. Deleted `targets/widget/QuickAddIntent.swift` and the `last_app`/`pushLastApp` widget-sync path (`LAST_ORDER_APP_KEY` AsyncStorage default for the Add Entry modal kept). Native change → EAS build 8 (`944e9206`, `ios.buildNumber` "8") triggered with auto-submit. `.agents/memory/widget-intent-auth-policy.md`.
- **Jun 15 — expo-av → expo-audio migration (code committed; native build still PENDING)**: ka-ching sound now uses `expo-audio ~1.1.1` (expo-av removed); `app.json` plugins/permissions updated. ⚠️ CORRECTION: preview build `a1eabfce` did NOT bake in expo-audio — it was built ~50 min before the migration commit and ships **expo-av**, confirmed by `eas fingerprint:compare` (build=`a76a90d3` has expo-av 16.0.8; current tree=`76a621ee` has expo-audio 1.1.1). A NEW `eas build --profile preview` is required for expo-audio (and so JS OTAs land). Build INSTALL_DEPENDENCIES had failed once on `package-firewall.replit.local` URLs injected into the expo lockfile; fix = rewrite them to `registry.npmjs.org` before building. `.agents/memory/eas-expo-build.md`, `.agents/memory/eas-build-lockfile-firewall-url.md`, `.agents/memory/eas-ota-not-landing.md`.
- **Jun 15 — Two-theme system (Dark/Light)**: simplified from 3 themes to exactly 2 — "Dark" (default) and a new "Light" (white `#f8fafc`/`#ffffff` + brand neon accents/glows). Neon accent split into `PRIMARY` (fills/glows/borders) + `PRIMARY_TXT` (readable gold on white; identical neon in Dark). Two-option Settings selector + Dashboard-header sun/moon quick toggle; `_layout` StatusBar/bg theme-aware; legacy theme names migrated. Home-screen widget reads a pushed `theme` App-Group key (Lock Screen accessories stay system-tinted). Swift widget change → next EAS build (not OTA). `.agents/memory/theme-system.md`.
- **Jun 15 — Lock Screen widget quick-add**: `accessoryRectangular` Lock Screen widget now shows today's profit + interactive +$10 Revenue / −$10 Expense buttons (reuses `QuickAddIntent` over the App Group); inline/circular stay glance-only. `QuickAddIntent.authenticationPolicy=.alwaysAllowed` so it runs while locked (write-only → safe). Native change → next EAS build, not OTA. `.agents/memory/lockscreen-widget.md`.
- **Jun 15 — Ka-Ching sound effect (optional)**: cash-register sound on successful entry save (covers iOS widget quick-add via the shared save mutation) + foreground motivation notifications; Settings pill toggle, defaults ON. Uses `expo-av` (NEW native dep → next EAS build, not OTA). Lazy-required + best-effort so it no-ops on pre-native builds. `.agents/memory/kaching-sound-effect.md`.
- **Jun 1 — Analytics instant refresh fix**: Analytics modal reads its own React-Query namespace (`['analytics-rollup']`/`['analytics-entries']`); entry add/edit/delete/import + offline-drain now invalidate those keys too, so it no longer shows stale data within the 30s `staleTime`. `.agents/memory/analytics-cache-invalidation.md`.
- **Jun 1 — Transaction Detail modal de-bounced**: replaced `ZoomIn.springify()` with a `withTiming` fade + slight scale-up worklet; close still via `<Modal animationType="fade" />`.
- **Jun 1 — Period swipe/chevron nav from ANY period**: signed `navOffset` steps by the chip's natural unit (day/week/month) over EST ranges; distinct cache keys per window; day-periods share the daily TODAY goal. `.agents/memory/period-swipe-navigation.md`.
- **Jun 1 — Scroll-to-Top FAB**: threshold-cross visibility (no per-frame re-render), reanimated off the render path. `.agents/memory/scroll-to-top-fab.md`.
- **Jun 1 — Optimistic delete**: single/bulk/calendar-erase patch the active rollup so goal bar/KPIs reset instantly. `.agents/memory/optimistic-delete-rollup.md`.
- **Jun 1 — Motivation notifications**: 2 local notifications/day via `expo-notifications` (re-armed one-shots), Hidden-Mode-aware. Native dep. `.agents/memory/motivation-notifications.md`.
- **May 30 — Add-entry KPI snap-back fix**: only invalidate after a real server save (`id>0`); queued entries reconcile on foreground drain. `.agents/memory/optimistic-update-offline-queue.md`.
- **May 30 — Hidden Mode (stealth)**: masks all `$` app-wide (`•••`) while keeping counts; startup leak guard. `.agents/memory/hidden-mode.md`.
- **May 30 — Last-used platform default** for new ORDER entries (race-guarded). `.agents/memory/addentry-modal-defaults.md`.
- **May 30 — CSV export** (signed amounts, US/Eastern wall-clock; round-trips with importer). Native deps. `.agents/memory/csv-export.md`.
- **May 30 — History sort + Analytics page** (full-screen modal; pure-View charts → OTA-safe). `.agents/memory/history-list-selection.md`.
- **May 29 — EAS Update / OTA** configured + proven end-to-end; `react-dom` pinned to 19.1.0 for strict CI install.
- **May 25 — Security hardening (P0/P1)**: JWT secret required at boot, strict verify, per-user OAuth scoping, `slowapi` rate limits on `/auth/*`, CORS allow-list + security headers, 2 MB receipt cap, offline entry queue. Deferred: per-credential login rate limiting, receipt object storage. See `docs/APP_STORE_CHECKLIST.md`.
- **Apr 30 — Marketing landing site** (`landing/`, Vite+React+Tailwind): Dark-Neon single-page site, pure HTML/CSS mockups. Set `APP_STORE_URL` in `landing/src/App.tsx` to flip the "Coming soon" badge. Runs on port 5173.
