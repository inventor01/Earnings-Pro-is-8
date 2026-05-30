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
The application features a multi-theme system ("Dark Neon" default, "Simple Light," "B/W Neon") with dynamic UI components, animated car emojis, and diverse fonts. Key UI elements include calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars, and celebratory alerts. It supports multi-platform data entry, expense tracking with emoji categories, and receipt image uploads. The interface incorporates neon-glow shadows, micro-animations for KPI updates, press-scale effects on interactive elements, GPS trip tracking, mass selection/bulk deletion, and CSV export. Swipe gestures facilitate daily navigation, and a calendar modal allows multi-day range selection and custom date filtering.

### Technical Implementations
Core functionalities include real-time KPI dashboards, profit goal tracking, and time period filtering. The system supports multi-platform data entry, expense tracking, and base64 encoded receipt uploads. GPS trip tracking automatically calculates distances. Users can manage entries (mass select, bulk delete, reset, edit) and visually track profit goals. AI-powered earning suggestions are provided. OAuth integration with Uber Eats and Shipt enables automatic order syncing via hourly background jobs with duplicate prevention. Features also include transaction search, CSV data export, and password reset via email service. A native iOS Widget provides quick entry functionality.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLAlchemy ORM for SQLite. The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A three-theme system is implemented with persistence via localStorage. Data storage uses signed amounts for expenses and cancellations, and real-time profit calculations are dynamic. Security features include OAuth 2.0 and bcrypt for password hashing. APScheduler manages hourly background sync jobs, and a dedicated sync service standardizes platform data. Authentication tokens are securely stored using `expo-secure-store`. The application also integrates an iOS Widget for quick data entry using App Groups for shared UserDefaults.

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
## Recent Changes (May 30, 2026 — History sort + Analytics page)
- **Sort transactions (History list)**: added a Sort header icon (between calendar & settings) opening a Dark Neon bottom-sheet with Newest First (default), Oldest First, Highest Amount, Lowest Amount, By Platform (A–Z). Active sort shows a checkmark, a PRIMARY-highlighted header icon, and a short label on the "Entries (N)" line. Sorting runs over the already search-filtered list and composes with multi-select/calendar/search. All in `earnings-ninja-expo/app/(tabs)/index.tsx` (no native deps → OTA-deployable).
- **Multi-select pruning fix**: bulk-select pruning now keys off the search-filtered visible set (`filteredEntries`), not the raw period set, so narrowing a search can no longer leave hidden rows selected for deletion. See `.agents/memory/history-list-selection.md`.
- **Analytics page (full-screen modal)**: reached via a prominent "View Analytics" button on the dashboard (the app has no bottom tab bar; user chose the modal route). Period filters This Week / This Month / Last 30 Days / All Time. Shows KPI grid (Net Profit, $/hr, $/mile, Avg Order, Total Miles, Total Hours, Miles/Day, Revenue), a profit-trend chart (reuses the pure-View `ProfitChart`), Spend-by-Category bars (% + totals), and Top Platforms by net earnings. KPIs come from the backend rollup (`/api/rollup`); category/platform/trend are computed client-side from entries. **Built with pure Views (no react-native-svg / chart-kit) to stay OTA-deployable.** Query keys include a local day-stamp so ranges refresh across midnight.

## Recent Changes (May 29, 2026 — OTA round-trip proven + fingerprint fix)
- **OTA round-trip verified end-to-end**: pushed a temporary green "OTA ✓" marker to the dashboard header (confirmed visible on device), then removed it and re-published OTA — confirmed **gone** on device after the open→wait→quit→reopen cycle. EAS Update (expo-updates, fingerprint policy) is now proven working for JS-only changes on the `preview` channel.
- **Fingerprint trap discovered & fixed**: the first re-push silently failed. With `runtimeVersion: { policy: "fingerprint" }`, an OTA only reaches a build whose native fingerprint == the update's runtimeVersion, and **`eas.json` is a fingerprint source** (verified via `npx expo-updates fingerprint:generate` — it's one of ~205 file sources). The `autoIncrement: true` previously added to the `preview` profile changed the fingerprint from `04d86cb…` (the installed build) to `1ed5beaf…`, so the published update matched no installed build. **`autoIncrement` was reverted from the `preview` profile** (`production` still has it) so the tree fingerprints back to `04d86cb…` and OTA JS updates continue to reach the current build. **Re-add `autoIncrement` to `preview` only as part of the next native rebuild** (a rebuild establishes a fresh fingerprint baseline anyway), never in isolation, or it breaks OTA to the installed build again.
- **Publishing `eas update` from the Replit env**: detached background processes get reaped (~1–2 min, silent) and can't finish a multi-minute export+upload — run the publish as a temporary `console` workflow instead (persists across tool calls), keep the Metro cache warm (~30–40s bundle), use `CI=1` for progress and `--platform ios` to halve the work. Details in `.agents/memory/eas-ota-not-landing.md`.

## Recent Changes (May 29, 2026 — EAS Update (OTA) setup + react-dom pin)
- **EAS Update / OTA configured**: `expo-updates@29.0.18`; `app.json` has `runtimeVersion: { policy: "fingerprint" }` + `updates.url: https://u.expo.dev/d0be520b-c231-4a05-9f34-24fd35a24935`; each `eas.json` profile has a `channel` (`development`/`preview`/`production`). **Workflow rule**: JS/UI/logic changes → `cd earnings-ninja-expo && eas update --branch preview --message "..."`. Native changes (new native dep, icon/splash, app.json plugin/permission, SDK bump, widget target) → `eas build --platform ios --profile preview`.
- **react-dom pinned to 19.1.0** (`earnings-ninja-expo/package.json`) to match `react` 19.1.0, since EAS `npm ci` is strict. RN doesn't use react-dom at runtime; this only matters for the CI install.
- **[USER ACTION]** a future `eas build --platform ios --profile preview` is required to bake the updater into the installed app; OTA only works from that build forward.

## Older changes (condensed — full detail in git history)
- **May 25 — Security hardening (P0/P1) + QA**: `backend/auth.py` requires `JWT_SECRET_KEY` at boot (no fallback), strict JWT verify, no auto-created/shared users (token rotation forced re-login). `slowapi` rate limits on `/auth/*` (signup 5/h, login 10/min, forgot-password 5/h, apple 20/min). OAuth (`backend/routers/oauth.py`) is per-user scoped with signed `state` JWTs; `ApiCredential`/`SyncedOrder` carry `user_id` (idempotent Postgres+SQLite migrations in `backend/app.py`). CORS locked to an allow-list + security headers middleware (`X-Frame-Options: SAMEORIGIN`). Receipt uploads capped at 2 MB (`MAX_RECEIPT_BYTES` in `backend/schemas.py`). Offline entry queue (`earnings-ninja-expo/lib/offlineQueue.ts`). Three-theme system (`lib/theme.ts`), `expo-secure-store` for tokens, forgot-password + receipt-photo + skeleton-loader UI. Expo QA #1/2/3/6/7/8/9/10 complete.
  - **Sign In with Apple**: backend `POST /api/auth/apple` verifies Apple identity token (JWKS), auto-links only by `apple:{sub}` (email-based linking removed — account-takeover risk). **[USER ACTION]** enable the **Sign In with Apple** capability on App ID `com.earningsninja.app` in the Apple Developer portal before the first EAS build.
  - **Deferred**: per-credential login rate limiting; receipt object storage (still base64 inline). See `docs/APP_STORE_CHECKLIST.md`.
- **April 30 — Marketing landing site** (`landing/`, Vite+React+Tailwind, separate from `frontend/`/`earnings-ninja-expo/`): single-page site matching the app's Dark Neon aesthetic, pure HTML/CSS iPhone mockups (no screenshots). App Store badge is a "Coming soon" pill until `APP_STORE_URL` in `landing/src/App.tsx` is set. Runs via the `Landing Site` workflow on port 5173.
