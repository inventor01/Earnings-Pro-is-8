# Delivery Driver Earnings Dashboard

## Overview
A mobile-first web application for delivery drivers to track earnings, expenses, mileage, and profit across various gig platforms (DoorDash, UberEats, Instacart, GrubHub). It provides real-time financial insights, AI-powered earning suggestions, and a "Car Dashboard Aesthetic" UI with neon-glowing KPIs and animated elements to optimize driver income and enhance goal tracking.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application features a multi-theme system ("Dark Neon" default, "Simple Light," "B/W Neon") with animated car emojis and diverse fonts. UI components adapt dynamically to the selected theme. It includes calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars, celebratory alerts, multi-platform data entry, expense tracking with emoji categories, and receipt image uploads. GPS trip tracking, mass selection/bulk deletion, and CSV export are also supported. The UI incorporates neon-glow shadows, micro-animations for KPI updates, and press-scale effects on interactive elements.

### Technical Implementations
Core functionalities include calculator-style input, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry, expense tracking, and receipt uploads (base64 encoded). GPS trip tracking automatically calculates distance. Users can manage entries (mass select, bulk delete, reset, edit) and track profit goals visually. AI-powered earning suggestions are provided. OAuth integration with Uber Eats and Shipt enables automatic order syncing via hourly background jobs, with duplicate prevention. A transaction search feature and CSV data export (summary and transactions) are available. Password reset functionality with email service is implemented. The dashboard supports swipe gestures for day-to-day navigation and multi-day range selection via a calendar modal, applying custom date ranges to API calls.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLAlchemy ORM for SQLite. The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS for a mobile-first experience. State management utilizes TanStack React Query and a Theme Context API. A three-theme system is implemented with persistence via localStorage. Data storage uses signed amounts for expenses and cancellations. Real-time profit calculations are dynamic. Secure OAuth 2.0 and bcrypt for password hashing are used. APScheduler manages hourly background sync jobs, and a dedicated sync service standardizes platform data. Authentication tokens are securely stored using `expo-secure-store`.

## External Dependencies
- **OpenAI GPT-4o-mini**: For AI Earning Suggestions.
- **Tailwind CSS**: For styling and responsive design.
- **TanStack React Query**: For frontend state management.
- **FastAPI**: Python web framework for the backend.
- **SQLAlchemy**: ORM for SQLite database interaction.
- **Uvicorn**: ASGI server for the FastAPI backend.
- **Vite**: Frontend build tool.
- **APScheduler**: Background job scheduler for periodic order syncing.
- **httpx**: Async HTTP client for API calls to Uber and Shipt platforms.
- **bcrypt**: For secure password hashing.
- **pytz**: For accurate timezone conversions.
- **aiosmtplib**: For sending password reset emails asynchronously.
- **Resend**: Email service for password reset emails.
- **expo-image-picker**: For receipt photo uploads.
- **react-native-gesture-handler**: For swipe gestures on the dashboard.
## Recent Changes (April 30, 2026 — iOS Widget for Quick Entry)
- **Native iOS Widget added** for one-tap quick add. Five families: `.systemSmall` (2 revenue + 2 expense quick-amount buttons + today's net profit), `.systemMedium` (4 revenue + 4 expense rows + ninja logo + profit), and three Lock Screen accessories — `.accessoryInline` (`🥷 Today: $X`), `.accessoryCircular` (compact `$Xk` gauge), `.accessoryRectangular` (full label). Dark Neon theme baked in (`#0a0a0a` / `#22c55e` / `#ef4444` / `#facc15`).
- **Architecture**: `@bacons/apple-targets` v4.0.6 config plugin (in `app.json` plugins, installed `--legacy-peer-deps`) generates the Widget Extension at `prebuild` time from `targets/widget/`. App Group `group.com.earningsninja.shared` declared in both `app.json` `ios.entitlements` and `targets/widget/expo-target.config.json` so the main app and widget share UserDefaults.
- **Sign-in placeholder state**: when no `auth_token` is in the App Group OR `api_base` isn't HTTPS, the Home Screen widgets render a "Tap to sign in" card instead of quick-add buttons; intents bail out + reload the timeline if creds disappear mid-tap.
- **Custom Expo module `modules/widget-bridge/`** (Swift + JS) exposes `setItem`/`getItem` (App Group UserDefaults strings) and `reloadAllTimelines` (`WidgetCenter.shared.reloadAllTimelines()`). iOS-only; gracefully no-ops on Android / web / Expo Go via lazy `requireNativeModule`.
- **Instant background save via App Intent** (`targets/widget/QuickAddIntent.swift`, iOS 17+): tapping a quick-amount reads token + API base from App Group, **refuses to attach the bearer token unless `api_base` is HTTPS**, POSTs `/api/entries` (REVENUE → positive ORDER on user's last-used app, EXPENSE → negative OTHER expense), atomically updates `today_profit` via a serialized `DispatchQueue` (no read-then-write race on rapid taps), then reloads all widget timelines. `openAppWhenRun = false` keeps the user on Home Screen.
- **JS sync layer (`lib/widgetSync.ts`)**: pushes `auth_token` + `api_base` to App Group on login (wired into `lib/authContext.tsx` `login`/`logout`/restore — and refuses to push the token if `apiBase` isn't HTTPS as defense in depth), pushes `today_profit` whenever the dashboard rollup updates and we're viewing TODAY (period === 'today' && dayOffset === 0), pushes `last_app` after every successful revenue mutation in AddEntryModal.
- **Deep link `earningsninja://entry/new[?type=…&amount=…]`**: `app/_layout.tsx` parses with `expo-linking`, validates `hostname === 'entry' && path === 'new'` (other paths ignored), forwards to dashboard with `?openEntry=1`. Dashboard `useLocalSearchParams` opens AddEntry with prefill, then strips params via `router.setParams` to avoid reopening on subsequent renders. AddEntryModal accepts an optional `prefill` prop.
- **Build instructions in `earnings-ninja-expo/WIDGET_BUILD.md`**: step-by-step for `appleTeamId`, `expo prebuild`, Xcode App Group verification, EAS dev build, and troubleshooting. Expo Go cannot show widgets — needs a dev build or TestFlight.
