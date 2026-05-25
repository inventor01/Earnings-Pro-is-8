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
## Recent Changes (May 25, 2026 — P0 Security Hardening: Rate Limiting, OAuth, Receipt Cap, Widget Auth)
- **KI-1 Rate limiting on `/auth/*`**: `slowapi` wired in `backend/app.py` (`Limiter(key_func=get_remote_address, default_limits=["200/minute"])`, `SlowAPIMiddleware`, `RateLimitExceeded` handler). `backend/routers/auth_routes.py` decorates `signup` (5/hour), `login` (10/minute), `forgot-password` (5/hour); each public handler now accepts `request: Request, body: <Model>` for slowapi's keying and delegates to a renamed private `_signup`/`_login`/`_forgot_password`. Verified: 11th login attempt within a minute returns 429.
- **KI-2 OAuth state + per-user scoping**: `backend/models.py` `ApiCredential` now has `user_id` FK (nullable for legacy rows) and composite `UniqueConstraint('user_id','platform')` replacing the legacy `UNIQUE(platform)` that prevented multi-tenancy. `backend/routers/oauth.py` fully rewritten: every endpoint requires `get_current_user`; `/authorize` issues a 10-minute HS256-signed JWT `state` (sub=user_id, platform, nonce, purpose='oauth_state'); `/callback` decodes and verifies `state` to derive the user_id (defeating callback-CSRF) and stamps the credential with that user_id; all queries scoped by `user_id`. `backend/services/sync_service.py` `UberSyncService`/`ShiptSyncService` constructors take `user_id`, every created `Entry` is stamped with it, and `sync_all_platforms` filters `ApiCredential.user_id.isnot(None)` (legacy single-tenant rows are skipped and must be reconnected).
- **Idempotent multi-user DB migration** in `backend/app.py` (`_migrate_api_credentials_for_multi_user`) runs at module import BEFORE `Base.metadata.create_all`. Detects Postgres vs SQLite via `engine.url.get_backend_name()`. Postgres path: `ALTER TABLE ADD COLUMN user_id`, creates `ix_api_credentials_user_id`, drops every existing UNIQUE constraint on the table by querying `pg_constraint`, then adds composite `uq_user_platform`. SQLite path: rename-recreate-copy-drop. Includes recovery for orphaned `api_credentials_old` from prior partial migrations. Verified: clean boot logs `Migrated api_credentials to per-user schema (postgres)`.
- **KI-4 Receipt size cap**: `backend/schemas.py` defines `MAX_RECEIPT_BYTES=2_000_000` and a Pydantic `field_validator` applied to `receipt_url` on both `EntryCreate` and `EntryUpdate`. Rejects payloads exceeding the cap with a clear error message before any DB write. Prevents one rogue upload from bloating SQLite/Postgres and slowing rollup queries.
- **KI-6 Widget cold-start auth re-push**: `earnings-ninja-expo/lib/authContext.tsx` cold-start `useEffect` now calls `widgetSync.onLogin(t)` immediately after `setToken(t)` so iOS widget tiles regain auth on app warm-start (not just at explicit login). Force-logout is now gated on `/401|403|unauthor/i` in the error message — transient network failures (flaky tunnel, airplane mode) no longer evict the SecureStore token.
- **JWT_SECRET_KEY** continues to be required at boot (set in Replit env vars). The same secret signs both auth access tokens and OAuth state JWTs.
- **Note**: `slowapi` (and transitive deps `limits`, `deprecated`, `wrapt`) installed via pip. Already listed in `requirements.txt`.
- **Architect-driven hardening (same day)**:
  - `_migrate_api_credentials_for_multi_user` no longer blindly drops `api_credentials_old` when both tables exist — it now only drops `_old` if the live table is post-migration (`user_id` column present). Otherwise it raises a `RuntimeError` with manual-cleanup instructions, so a botched prior migration can't trigger silent credential loss.
  - Postgres path now **fails fast** when `ADD CONSTRAINT uq_user_platform` fails (previously it warn-and-continued, leaving the schema looking complete but actually half-migrated and silently broken on the next multi-user connect).
  - Added `_migrate_synced_orders_for_multi_user` (plain `ADD COLUMN user_id` + index, Postgres+SQLite safe). `SyncedOrder` model now has `user_id`; both Uber and Shipt dedupe queries filter by `(user_id, platform, platform_order_id)` instead of `(platform, platform_order_id)` — without this, two users connecting the same upstream sandbox would have their first imports suppress each other.
  - `frontend/src/lib/api.ts` `getOAuthStatus` / `getUberAuthUrl` / `getShiptAuthUrl` / `disconnectPlatform` now send `getAuthHeaders()` — these endpoints became auth-required as part of KI-2 and the web frontend was about to start getting 401s.
  - `earnings-ninja-expo/lib/api.ts` `getMe` error message now includes the HTTP status (`getMe failed: 401`) so the cold-start logout regex in `authContext.tsx` (`/401|403|unauthor/i`) actually matches — previous `throw new Error('Not authenticated')` matched the regex but only by coincidence of the word "unauthor"… it didn't, so expired tokens were being kept indefinitely. Now deterministic.

## Recent Changes (May 25, 2026 — Security Hardening + QA Verification)
- **Backend security hardening**: Rewrote `backend/auth.py` to require `JWT_SECRET_KEY` env var (fails loudly at boot if missing — no more hardcoded fallback), enforce JWT signature verification with `exp` claim required, and never auto-create users from token claims or silently downgrade to a shared "default-user" account. `JWT_SECRET_KEY` is now set in Replit env vars (96-char hex). Token rotation invalidated existing sessions; users must sign back in.
- **Expo QA suggestions verified complete** (#1, #2, #3, #6, #7, #8, #9, #10): dead screen/constants files removed, NativeWind fully stripped, `expo-secure-store` adopted in `lib/tokenStorage.ts` with one-shot AsyncStorage→SecureStore migration, three-theme system (`lib/theme.ts` — Dark Neon / Simple Light / B/W Neon) wired through `useTheme()` in dashboard / login / CalendarModal, theme switcher cards rendered in SettingsModal, forgot-password link + modal on login.tsx (`POST /api/auth/forgot-password`), receipt photo attach in AddEntryModal's EXPENSE branch (`expo-image-picker`, base64 inline into `entries.receipt_url`), skeleton-loader dashboard placeholder. `npx tsc --noEmit` clean.
- **Note on JWT rotation**: any user logged in before May 25 needs to sign in again because previously-issued tokens were signed with the placeholder secret and now fail verification — by design.

## Recent Changes (April 30, 2026 — Marketing Landing Site)
- **New standalone marketing site** in `landing/` (Vite + React 18 + TypeScript + Tailwind 3, completely separate from `frontend/` and `earnings-ninja-expo/`). Single-page site styled to match the iOS app's Dark Neon Car Dashboard aesthetic (`#0a0a0a` background, `#facc15` neon-yellow primary, `#22c55e` accents, animated glow on the headline word "actually").
- **Sections**: sticky nav, hero with iPhone CSS-mockup of the live dashboard, six-card feature grid, three-up screenshot showcase (Dashboard / Calculator add-entry / History), gross-vs-net "honest math" comparison band, 8-question FAQ accordion, CTA band, footer with Privacy/Support/contact links pointing at `/privacy` and `/support` (served by the FastAPI backend on the same parent domain in production).
- **iPhone mockups are pure HTML/CSS** — no static screenshot files. Re-use the same colors/fonts/proportions as the actual native UI so the marketing site stays visually 1:1 with the app even when the app's UI changes.
- **App Store badge** currently renders as a non-clickable "Coming soon" pill; flipping `APP_STORE_URL` in `landing/src/App.tsx` from `null` to the live `apps.apple.com/...` URL auto-promotes it to a real link.
- **Architect-flagged issues fixed before publishing**: GPS FAQ rewritten to honestly say the iOS app has an opt-in GPS trip tracker (matches the privacy/support pages); Google Fonts removed (was contradicting the "no third-party trackers" claim) — now uses Apple's system font stack which renders identically on iOS/macOS; `prefers-reduced-motion` global override added; `aria-expanded`/`aria-controls` added to mobile menu and FAQ accordion buttons; placeholder `id0000000000` App Store URL replaced with the "Coming soon" pattern so the primary CTA is never broken.
- **Workflow `Landing Site`** runs `cd landing && npm run dev` on port 5173 (Vite default; console output type because the only allowed webview port 5000 is already taken by the existing `Frontend` workflow). Verified: `curl localhost:5173 → HTTP 200`, `tsc --noEmit` clean.
