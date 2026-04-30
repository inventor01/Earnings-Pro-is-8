# Delivery Driver Earnings Dashboard

## Overview
A mobile-first web application designed for delivery drivers to track earnings, expenses, mileage, and profit across various gig platforms (DoorDash, UberEats, Instacart, GrubHub). It provides real-time financial insights, including revenue, expenses, profit, miles, $/mile, and $/hour, with data filterable by multiple time periods. The application also features AI-powered earning suggestions and a "Car Dashboard Aesthetic" UI with neon-glowing KPIs and animated elements to optimize driver income and enhance goal tracking.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application utilizes a multi-theme system with "Dark Neon" (default, Car Dashboard Aesthetic), "Simple Light," and "B/W Neon" themes. All themes incorporate animated car emojis, diverse fonts for goal sections, and consistent animations (goal-flip, money-bounce, float-glow, slide-up-fade). UI components, including receipt uploads and form fields, adapt dynamically to the selected theme. Features include calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars and celebratory alerts, multi-platform data entry, expense tracking with emoji categories, and receipt image uploads. It also supports GPS trip tracking, mass selection and bulk deletion of entries, and CSV export.

### Technical Implementations
Core functionalities include a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit entries via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for optimal profit. The system also includes OAuth integration for Uber Eats and Shipt for automatic order syncing, background jobs for hourly order synchronization, duplicate prevention for synced orders, and a transaction search feature. Data can be exported to CSV format, including summary statistics and all transactions.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLite (SQLAlchemy ORM). The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A three-theme system is implemented with configurations in `lib/themes.ts` and persistence via localStorage. Data storage uses signed amounts for expenses and cancellations within a unified entry ledger. Real-time profit calculations are dynamic. Secure OAuth 2.0 implementation is used for platform integrations, with APScheduler managing hourly background sync jobs. A dedicated sync service standardizes platform-specific order data into Entry records. Passwords are secured using bcrypt hashing.

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
- **pytz**: For accurate timezone conversions in backend data generation.
- **aiosmtplib**: For sending password reset emails asynchronously.

## Email Configuration (Password Reset)
Password reset emails are sent using **Resend** (https://resend.com).

Required secret:
- **RESEND_API_KEY**: Your Resend API key (starts with `re_`)

The email service is configured and ready to send password reset emails when users click "Forgot password?" on the login page.

## Recent Changes (April 30, 2026 — Expo QA pass)
- **Removed dead code from Expo app**: deleted unused `app/(tabs)/add.tsx`, `history.tsx`, `settings.tsx` (single-tab dashboard architecture), plus `constants/colors.ts` and `hooks/useColors.ts`. Splash placeholder color in `app/index.tsx` is now inline.
- **Removed NativeWind**: uninstalled `nativewind` + `tailwindcss`, deleted `global.css` / `tailwind.config.js` / `nativewind-env.d.ts`, simplified `babel.config.js` (just `babel-preset-expo`) and `metro.config.js`. Dashboard never used `className=` anyway, so no JSX changes were required.
- **Auth token moved to expo-secure-store** (Keychain on iOS, EncryptedSharedPreferences on Android) via `lib/tokenStorage.ts`. Web falls back to AsyncStorage. Includes one-time migration: on boot, if SecureStore is empty but AsyncStorage has the legacy `auth_token`, copy it across and delete the AsyncStorage entry. Wired into `lib/authContext.tsx` and `lib/api.ts`.
- **Three-theme system on Expo**: new `lib/theme.ts` exports `Theme` type, `THEMES` (`darkNeon` / `simpleLight` / `bwNeon`), `ThemeProvider`, `useTheme()`, `useThemeControls()`. Selection persists via AsyncStorage (`theme_name`). All three top-level screens (`app/(tabs)/index.tsx` Dashboard + AddEntryModal + SettingsModal, `app/login.tsx`, `components/CalendarModal.tsx`) destructure colors from `useTheme()` rather than module-level constants. AddEntryModal's white "calc" sheet keeps the static `CALC` palette intentionally — the receipt-attach UI follows the same convention. New `ON_PRIMARY` token replaces hardcoded `'#000'`/`'#fff'` on yellow buttons (period chips, search toggle, Save, "+ Add Entry"), so the bwNeon theme can flip text-on-primary to white correctly.
- **Theme switcher in Settings**: SettingsModal gained an "🎨 Appearance" section with three pressable cards. Each card shows a 4-swatch preview (BG / SURFACE / PRIMARY / GREEN), the theme label, a tagline, and a checkmark on the active theme. Tapping repaints the entire app instantly via context.
- **Forgot password (Expo)**: `app/login.tsx` now has a "Forgot password?" link beneath the password input. Tapping opens a small modal with email input + "Send Reset Link" that calls new `api.requestPasswordReset(email)` → `POST /api/auth/forgot-password`. Backend already had the endpoint and Resend wired up.
- **Receipt photo upload (Expo)**: in AddEntryModal, when `entryType === 'EXPENSE'` the form now shows a "🧾 Receipt (optional)" section with an "Attach Receipt Photo" dashed button. Tap → Alert action sheet (Take Photo / Choose from Library) using `expo-image-picker` (`requestCameraPermissionsAsync` / `requestMediaLibraryPermissionsAsync`, `quality: 0.6`, `base64: true`). After selection a 64×64 thumbnail + Remove button render. On save, the base64 payload is sent as `receipt_url: 'data:image/jpeg;base64,…'` — same convention the web client uses (no separate upload endpoint exists; `Entry.receipt_url` is a string column).
- **Skeleton loaders**: replaced the lone `ActivityIndicator` in the dashboard's `rollupLoading` branch with a `DashboardSkeleton` that mocks the Hero card (label + alt-metric pill + big number + date row + 3 inline stats), the $/Mile + Miles KPI row, and the Goals header + bar. Each placeholder is a `SkeletonBox` with a Reanimated looped opacity shimmer (0.45 ↔ 1.0, 750ms each direction, runs on the UI thread).

## Recent Changes (April 30, 2026)
- **Expo dashboard: swipe-to-change-day on the hero card.** When the TODAY chip is active, horizontal swipes on the main profit card cycle `dayOffset` (swipe-left = next day, swipe-right = previous day) using `react-native-gesture-handler` Pan gesture (threshold `|dx| > 50 && |dx| > |dy|`, with `activeOffsetX([-15,15])` / `failOffsetY([-20,20])` so vertical scroll is not captured). The chevron-back/chevron-forward icons in the hero date row are now real tap targets that do the same thing. The date row label updates to `Today • Apr 30` / `Yesterday • Apr 29` / `Tomorrow • May 1` / `Mon, Apr 27`. `dayOffset` is threaded through `api.getRollup(timeframe, dayOffset)` and `api.getEntries(timeframe, limit, dayOffset)` (param only sent for TODAY; backend already supports it). React Query keys include the offset so each day caches independently. `dayOffset` resets to 0 on every period chip tap, custom range apply/clear, and custom chip activation.
- **Expo CalendarModal: multi-day range selection.** Tap a day to start a range, tap another day to complete (auto-swaps if end < start; tapping the same day twice commits a single-day range). Range visuals: yellow ring on start/end endpoints, soft yellow tint (`rgba(250,204,21,0.12)`) on in-between days. New bottom panel shows aggregated PROFIT/REVENUE/EXPENSES totals + day count, with "Apply to Dashboard" + "Clear" buttons.
- **Dashboard: new `'custom'` Period.** When applied from the calendar, the dashboard hits new range-aware API endpoints (`api.getRollupInRange` / `api.getEntriesInRange`) and shows a dismissible "Custom Range" chip in the period strip with a compact `Apr 14 – Apr 20` label. Goals section is hidden in custom mode (goals are tied to fixed timeframes only).
- **Backend `from_date`/`to_date` support added to `/api/rollup`.** New helper `get_est_date_range(from, to)` in `backend/services/period.py` interprets YYYY-MM-DD strings as inclusive EST calendar days → naive UTC datetime bounds (mirroring `get_today()` / `get_this_month()` convention). `/api/entries` updated to use the same helper for date-only inputs so single-day ranges no longer exclude same-day entries.

## Recent Changes (April 29, 2026)
- **Expo dashboard polish pass** to align native iOS app with web "Dark Neon" theme:
  - Deeper background color stack: BG `#0a0a0a` / SURFACE `#111` / CARD_BG `#1a1a1a` (true blacks)
  - Neon-glow shadows on Hero profit card (green/red, 22px radius), KPI cards (subtle yellow/green/red, 10px), period chips (yellow when active), and sticky Add Entry bar (heavy yellow halo, 28px radius / 0.7 opacity)
  - Reanimated 4 micro-animations: Hero "pop" pulse on every profit change, ninja logo glow at $50 milestones (yellow under $100, green at $100+), smooth count-up on profit / revenue / orders / avg-order / $-per-hour / $-per-mile / miles via `requestAnimationFrame` easeOutCubic over 700ms (interruption-safe — tweens from current displayed value, no jitter)
  - Press-scale `0.96` on header refresh / settings buttons, period chips (`0.92`), and sticky Add Entry button (mirrors web `active:scale-95`)
  - Period chip text color fixed white→black on yellow active state for proper contrast
- Helper components added to `app/(tabs)/index.tsx`: `neonGlow()`, `PressScale`, `AnimatedNumber`, `usePopOnChange`, `useMilestoneGlow`

## Recent Changes (December 2, 2025)
- Added default daily/weekly/monthly goals for new user signups (regular users now get default goals like demo users)
- Implemented password reset functionality with secure token-based reset flow
- Added PasswordResetToken model for secure password recovery
- Created email service for sending password reset emails (requires SMTP configuration)
- **Micro Animations Added:**
  - Revenue cards count up smoothly with animated numbers
  - Expense card shakes briefly when a big expense is added
  - Miles card pulses subtly when distance data updates
  - Goal progress bars transition smoothly with cubic-bezier easing
  - Ninja logo glows bright yellow/green when profit crosses $50 milestones ($50, $100, $150, etc.)