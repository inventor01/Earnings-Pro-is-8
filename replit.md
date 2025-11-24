# Delivery Driver Earnings Dashboard

## Overview
A mobile-first web application enabling delivery drivers to track earnings, expenses, mileage, and profit across various gig platforms (DoorDash, UberEats, Instacart, GrubHub). The application aims to provide real-time financial insights, including revenue, expenses, profit, miles, $/mile, and $/hour, with data filterable by multiple time periods. It also features AI-powered earning suggestions to optimize driver income. The user interface has been recently redesigned with a "Car Dashboard Aesthetic," featuring neon-glowing KPIs, animated elements, and enhanced goal tracking.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application features a multi-theme system with three distinct themes:
1. **Dark Neon** (Default): Car Dashboard Aesthetic with dark gradient background, neon-glowing KPI gauges, cyan-blue-purple gradients, and monospace fonts for a digital feel.
2. **Simple Light**: Clean, professional light theme with soft grays and blues, ideal for bright environments.
3. **B/W Neon**: High-contrast black and white theme with neon borders and white text on black backgrounds.

All themes feature animated car emojis with driving/sway animations, goal sections with diverse fonts (Poppins, Space Grotesk, Outfit), and consistent animations (goal-flip, money-bounce, float-glow, slide-up-fade). Receipt uploads, form fields (reordered: Category → Note → Receipt), and UI components adapt dynamically to the selected theme.

### Technical Implementations
The application provides a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit any entry via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for minimum order amounts, peak earning hours, and cost-saving strategies.

### Feature Specifications
- Calculator-style input with Add/Subtract modes.
- Real-time KPI dashboard with profit goal tracking and automatic daily rollover.
- Multi-platform support (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other).
- Expense tracking with emoji-enhanced categories and receipt image upload.
- Mileage cost calculation and GPS trip tracking.
- Settings management with profit goal configuration and **theme selection** (Dark Neon, Simple Light, B/W Neon).
- Mass select and bulk delete for entries.
- Daily data reset and "Reset All Data" features.
- Automatic date detection with notifications.
- Full CRUD operations for entries, including a modal sidebar for editing.
- AI Earning Suggestions based on driver data for optimal profit.
- **Platform OAuth Integration**: Connect Uber Eats and Shipt accounts for automatic order syncing.
- **Automatic Order Sync**: Background job syncs orders from connected platforms hourly.
- **Synced Order Tracking**: Tracks which orders have been synced to prevent duplicates.

### System Design Choices
- **Backend**: FastAPI (Python 3.11) with SQLite (SQLAlchemy ORM) for simplicity and rapid MVP development.
- **Frontend**: React 18 with TypeScript, Vite, and Tailwind CSS for a modern, mobile-first web experience.
- **State Management**: TanStack React Query + Theme Context API (for theme management and persistence).
- **Theme System**: Three-theme system with theme configuration in `lib/themes.ts` and React Context provider (`lib/themeContext.tsx`). Themes persist to localStorage.
- **Data Storage**: Signed amounts for expenses and cancellations stored as negative values for simplified aggregation.
- **Unified Entry Ledger**: A single database table for all transaction types (ORDER, BONUS, EXPENSE, CANCELLATION) using an enum.
- **Real-Time Calculations**: Profit is dynamically calculated as revenue minus logged expenses.
- **OAuth Integration**: Secure OAuth 2.0 implementation for Uber and Shipt with encrypted credential storage.
- **Background Syncing**: APScheduler manages hourly background jobs to sync orders from connected platforms.
- **Sync Service**: Dedicated sync service converts platform-specific order data to standardized Entry records.

## External Dependencies
- **OpenAI GPT-4o-mini**: Utilized via Replit AI Integrations for AI Earning Suggestions.
- **Tailwind CSS**: For styling and responsive design.
- **TanStack React Query**: For state management in the frontend.
- **FastAPI**: Python web framework for the backend.
- **SQLAlchemy**: ORM for interacting with the SQLite database.
- **Uvicorn**: ASGI server for the FastAPI backend.
- **Vite**: Frontend build tool.
- **APScheduler**: Background job scheduler for periodic order syncing.
- **httpx**: Async HTTP client for making API calls to Uber and Shipt platforms.

## Recent Additions (November 24, 2025)

### Platform Integration & Auto-Sync
1. **New Database Tables**:
   - `api_credentials`: Stores encrypted OAuth tokens for Uber/Shipt with expiration tracking
   - `synced_orders`: Tracks synced orders to prevent duplicates

2. **OAuth Endpoints** (`backend/routers/oauth.py`):
   - `/api/oauth/uber/authorize`: Initiates Uber OAuth flow
   - `/api/oauth/shipt/authorize`: Initiates Shipt OAuth flow
   - `/api/oauth/{platform}/callback`: Handles OAuth callbacks and token storage
   - `/api/oauth/{platform}/disconnect`: Removes stored credentials
   - `/api/oauth/status`: Returns connection status of all platforms

3. **Sync Service** (`backend/services/sync_service.py`):
   - `UberSyncService`: Fetches orders from Uber Eats API and converts to Entry records
   - `ShiptSyncService`: Fetches orders from Shipt API and converts to Entry records
   - Automatic duplicate prevention using platform order IDs

4. **Background Job Scheduler** (`backend/services/background_jobs.py`):
   - Runs hourly sync job to fetch new orders from connected platforms
   - Automatically starts on application startup

5. **Frontend Settings Integration**:
   - Updated `SettingsDrawer` component with Platform Integrations section
   - Connect/Disconnect buttons for Uber and Shipt accounts
   - Real-time connection status display with auto-refresh

### Progress Bar Animation Enhancement
- Added animated striped pattern to progress bar with continuous movement
- Creates "flowing" effect to indicate progress momentum
- Combined with glow animation for enhanced visual appeal