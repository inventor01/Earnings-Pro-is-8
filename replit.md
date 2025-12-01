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
The application utilizes a multi-theme system with "Dark Neon" (default, Car Dashboard Aesthetic), "Simple Light," and "B/W Neon" themes. All themes incorporate animated car emojis, diverse fonts for goal sections, and consistent animations (goal-flip, money-bounce, float-glow, slide-up-fade). UI components, including receipt uploads and form fields, adapt dynamically to the selected theme.

### Technical Implementations
Core functionalities include a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit entries via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for optimal profit. The system also includes OAuth integration for Uber Eats and Shipt for automatic order syncing, background jobs for hourly order synchronization, duplicate prevention for synced orders, and a transaction search feature. Data can be exported to CSV format, including summary statistics and all transactions.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLite (SQLAlchemy ORM) for rapid development. The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A three-theme system is implemented with configurations in `lib/themes.ts` and persistence via localStorage. Data storage uses signed amounts for expenses and cancellations within a unified entry ledger. Real-time profit calculations are dynamic. Secure OAuth 2.0 implementation is used for platform integrations, with APScheduler managing hourly background sync jobs. A dedicated sync service standardizes platform-specific order data into Entry records.

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
## Goal Achievement Milestone Alerts (November 30, 2025)

### Implementation
Added celebratory milestone alerts for daily goal progress at 25%, 50%, 75%, and 100% achievement:

**Features:**
- 🔥 **25% Milestone**: "Quarter Way There!" - Triggers at 25% progress
- ⚡ **50% Milestone**: "Halfway to Victory!" - Triggers at 50% progress
- 🚀 **75% Milestone**: "Almost There!" - Triggers at 75% progress
- 🏆 **100% Milestone**: "Goal Achieved!" - Triggers at goal completion

**Technical Details:**
- Each milestone plays ka-ching sound effect automatically
- Modal popup with bounce animation, confetti effects, and smooth transitions
- Milestones reset when progress drops below 25%
- Uses Set to track reached milestones per timeframe to prevent duplicate alerts
- Works on all timeframes (daily, weekly, monthly, etc.)

**Files Created**: `frontend/src/components/MilestoneAlert.tsx` - Celebratory modal component with animations
**Files Modified**: 
- `frontend/src/components/ProfitGoalsBar.tsx` - Added milestone tracking and onMilestoneReached callback
- `frontend/src/pages/Dashboard.tsx` - Imported MilestoneAlert, added state and handlers

## Auto-Close Entry Form (November 30, 2025)

### Implementation
Added automatic form closure after successful entry creation:
- When user clicks "Save Entry," the form automatically closes
- Closes the add entry panel and returns to main dashboard view
- Works seamlessly with success toast notification

**File Modified**: `frontend/src/pages/Dashboard.tsx` - Added `setCalcExpanded(false)` to createMutation onSuccess callback

## Dashboard Intro Sound (November 30, 2025)

### Implementation
Added audio intro sound that plays when user logs into the dashboard:
- Sound file: `/frontend/public/sounds/intro-sound.wav`
- Plays automatically on first dashboard load per session
- Respects user's sound mute setting (won't play if muted)
- Uses sessionStorage to prevent replay on page refresh
- Gracefully handles browser playback restrictions with try-catch
- Volume set to 0.7 for pleasant listening

**File Modified**: `frontend/src/pages/Dashboard.tsx` - Added useEffect hook on component mount to trigger intro sound playback

## Performance & Deployment Optimizations (November 30, 2025)

### Frontend Optimizations
**Vite Build Configuration:**
- Code splitting: React vendors, Query vendors separated for better caching
- Terser minification with console/debugger removal for production
- CSS code splitting enabled
- ES2020 target for modern browsers
- GZIP compression ready

**Environment Files:**
- `.env.production` for production API endpoints
- Separate build command for production mode

### Backend Optimizations
**FastAPI Configuration:**
- GZIP middleware for response compression
- Disabled OpenAPI docs in production (saves memory)
- Improved logging configuration (WARNING level for production)
- Error handling for background jobs startup/shutdown
- Graceful shutdown support for Railway

**Deployment Files:**
- Multi-stage Docker build for minimal image size
- Frontend pre-built into dist folder
- Gunicorn with 4 workers + Uvicorn for production ASGI
- Health checks configured for Railway

### Railway Deployment Setup
**Features:**
- Dockerfile for containerized deployment
- railway.json with health checks and restart policies
- CPU/Memory monitoring thresholds
- Automatic restart on failure (max 3 retries)

### Expected Improvements
- Faster initial page load (code splitting + compression)
- Better caching (separate vendor chunks)
- Reduced server resource usage (GZIP, optimized build)
- More stable deployments (graceful shutdown, health checks)
- Faster deployment cycles (optimized Docker build)

## Security Improvements (December 1, 2025)

### Password Hashing Upgrade
**Critical Security Fix:** Replaced SHA256 with bcrypt for password hashing:
- Signup: Uses `bcrypt.gensalt()` and `bcrypt.hashpw()` to create secure hash
- Login: Uses `bcrypt.checkpw()` for constant-time password verification
- Handles encoding correctly (UTF-8) for international character support
- Exception handling in verify_password for malformed hash graceful failures

**Files Modified:**
- `backend/routers/auth_routes.py` - Updated hash_password and verify_password functions
- `requirements.txt` - Added bcrypt dependency

### TypeScript Type Safety
**Type Definition Added:** SuggestionResponse interface for AI suggestions API:
- Properly typed response structure with nullable fields
- Imported in AISuggestions component for type safety

**Files Modified:**
- `frontend/src/lib/api.ts` - Added SuggestionResponse interface
- `frontend/src/components/AISuggestions.tsx` - Import and use SuggestionResponse type

## Production Launch Readiness (December 1, 2025)

### Full Application Audit Completed
- All API endpoints verified and working
- Database models and relationships validated
- Business logic (rollup calculations, formulas) verified correct
- Authentication flow tested with bcrypt security
- Frontend builds successfully with TypeScript
- All workflows running without errors

### Key Features Verified
1. **Financial Tracking**: Revenue, expenses, profit, miles, hours calculations
2. **KPI Dashboard**: $/mile, $/hour, average order value, first-to-last efficiency
3. **Profit Goals**: Daily/weekly/monthly/yearly goals with progress tracking
4. **AI Suggestions**: OpenAI-powered earning recommendations
5. **Entry Management**: CRUD operations, bulk delete, CSV export
6. **Multi-Platform**: DoorDash, UberEats, Instacart, GrubHub, Shipt support
7. **OAuth Integration**: Uber Eats and Shipt API connections
8. **Sound Effects**: Ka-ching for entries, milestone alerts, intro sound
9. **Theme System**: Dark Neon, Simple Light, B/W Neon themes
10. **Mobile-First**: Touch-optimized UI, calculator-style input

## Private Demo Sessions (December 1, 2025)

### Implementation
Replaced shared demo account with private isolated sessions:
- Each user clicking "Try Demo" gets their own unique temporary account
- Demo data is completely private - one person's changes are invisible to others
- Uses real JWT authentication for demo sessions (not a special guest token)
- Demo users marked with `is_demo=True` flag for potential cleanup

**Technical Details:**
- New `/api/auth/demo` endpoint generates unique user ID per session
- Creates AuthUser with `is_demo=True` and Settings record
- Frontend calls demo endpoint instead of using hardcoded 'guest-token'
- All tokens (including demo) now properly sent with Authorization header

**Files Modified:**
- `backend/routers/auth_routes.py` - Added `/auth/demo` endpoint
- `backend/models.py` - Added `is_demo` column to AuthUser
- `frontend/src/pages/LoginPage.tsx` - Added handleDemoLogin function
- `frontend/src/lib/api.ts` - Removed 'guest-token' special case

## Demo Account Preloaded Transactions (December 1, 2025)

### Implementation
Added realistic preloaded demo transactions to demo accounts:
- Each demo user receives 60 days of realistic delivery driver data (spans multiple calendar months)
- 5-10 orders per day from DoorDash, UberEats, Instacart, GrubHub
- 1-2 expenses per day (gas, parking, food)
- Realistic order amounts ($8-$35) with distance and duration data
- Demo account shows immediately populated dashboard with AI tips, KPI calculations, and full transaction history
- Calendar displays colored profit/revenue bars on every day with data across all months

**Technical Details:**
- New `create_demo_transactions()` helper function generates fake entries
- **CRITICAL FIX (Dec 1)**: Uses EST timezone for date generation to ensure calendar alignment
  - Entries are created with EST dates, then converted to UTC for storage
  - When frontend converts back to EST using `getESTDateString()`, dates align perfectly
  - Prevents timezone offset issues where UTC midnight could shift dates by a day
- Transaction timestamps spread across past 60 days, 7am-10pm working hours
- Each demo user gets unique randomized data (5-10 orders per day, varying amounts daily)
- Expenses include GAS, PARKING, FOOD categories
- Cost per mile set to $0.75 for realistic calculations
- Generates 300-600 transactions per demo session for a rich data experience

**Files Modified:**
- `backend/routers/auth_routes.py` - Added `create_demo_transactions()` function with EST timezone handling and preload logic to `/auth/demo` endpoint
- Demo endpoint now creates user, settings, AND preloaded transactions across 60 days in one call
- Uses pytz library for accurate timezone conversions

