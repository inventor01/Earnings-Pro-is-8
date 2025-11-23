# Delivery Driver Earnings Dashboard

## Project Overview
A mobile-first web application for delivery drivers to track earnings, expenses, mileage, and profit across multiple gig platforms (DoorDash, UberEats, Instacart, GrubHub).

## Purpose
This application helps delivery drivers:
- Track revenue from orders and bonuses across multiple platforms
- Log expenses (gas, parking, tolls, etc.) and cancellations
- Calculate profit automatically accounting for mileage costs
- View real-time KPIs: Revenue, Expenses, Profit, Miles, $/mile, $/hour
- Filter data by time periods (Today, Yesterday, This Week, Last 7 Days, This Month, Last Month)

## Current State
✅ Fully functional MVP with all core features implemented:
- Calculator-style input with Add/Subtract modes
- Real-time KPI dashboard
- Time period filtering with automatic daily rollover
- Multi-platform support (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other)
- Default app set to UberEats
- Expense tracking with emoji-enhanced categories (Gas ⛽, Parking 🅿️, Tolls 🛣️, Maintenance 🔧, Phone 📱, Subscription 📦, Food 🍔, Leisure 🎮, Other 📋)
- Receipt image upload support for expenses
- Mileage cost calculation
- Settings management
- Sample data seeded for testing
- GPS trip tracking with automatic distance calculation
- Mass select and bulk delete for entries
- Daily data reset feature with confirmation dialog
- Reset all data feature in settings
- Automatic date detection - notifies user when date changes

## Recent Changes (November 23, 2025 - Latest)
- **Added Receipt Support for Expenses**: Users can now upload receipt images for expense entries with preview
- **Enhanced Expense Categories with Emojis**: Added 2 new categories (FOOD 🍔, LEISURE 🎮) and all categories now display with emojis in dropdown
- **Receipt Display in Table**: Expense entries with receipts show a "📸 Receipt" button to view uploaded images
- **Added "Reset All Data" in Settings**: New "Danger Zone" section in settings drawer allows users to permanently delete all entries with confirmation dialog
- **Added GPS error handling improvements**: Better error messages for geolocation failures (permission denied, no signal, timeout) with dismiss button

## Previous Changes
- Removed Order ID field from entry form to simplify data entry
- Initial project setup with backend (FastAPI + SQLite) and frontend (React + Vite + Tailwind)
- Implemented calculator component with numeric keypad, decimal support, backspace, and clear
- Created database models for Entry (unified ledger) and Settings (cost per mile)
- Built API endpoints for CRUD operations and rollup calculations
- Implemented all React components (KPI cards, period filters, entry form, entries table, settings drawer, toast notifications)
- Added seed script with 62 sample entries across 7 days
- Configured workflows for both backend (port 8000) and frontend (port 5000)
- Fixed rollup calculations: profit = revenue - expenses - (miles × cost_per_mile), $/mile and $/hour use net_earnings
- Fixed Pydantic schema serialization to use float types for all numeric rollup values
- Fixed frontend form validation to accept positive amounts in both modes, backend handles sign conversion
- Removed auto-reset behavior from EntryForm to preserve user type selection across mode changes
- Fixed TypeScript compilation error by adding vite-env.d.ts for import.meta.env typing
- Fixed layout padding issue - calculator section now has proper spacing (fixed bottom with 500px padding)
- Added scroll-to-top on component mount to ensure KPI cards are visible
- All backend tests passing (9/9)
- Database seeded with 62 entries; application fully operational with real-time KPIs displaying correctly
- Fixed Vite proxy configuration to allow frontend-backend communication in Replit environment
- **Added GPS Trip Tracking Feature**: Users can track trips in real-time using phone geolocation, automatically calculating miles driven using Haversine formula
- TripTracker component displays live distance and duration, auto-fills entry form on trip completion
- **Added Mass Select and Bulk Delete**: Users can select multiple entries with checkboxes (including select all) and delete them in bulk with confirmation dialog
- **Fixed timezone handling for date filters**: Backend now properly converts incoming UTC timestamps to naive datetimes for SQLite comparison; frontend calculates all date ranges in UTC to prevent timezone offset issues
- **Verified all time period filters working correctly**: Tested Today, Yesterday, Last 7 Days, This Week, This Month, Last Month - all filters update data properly and will roll forward automatically each day
- **Fixed date range calculation bug**: Filters were using current time instead of end-of-day; updated week, last7, and month filters to use `endOfDay()` instead of `now.toISOString()`
- **Added "Reset Today" feature**: Red button in header allows users to manually delete all entries from the current day with confirmation dialog
- **Added automatic date change detection**: App tracks last visit date in localStorage; notifies user when crossing midnight with "New day! Previous data moved to Yesterday" message
- **Updated ConfirmDialog component**: Now supports custom button text via optional `confirmText` and `cancelText` props
- **Changed default app to UberEats**: Updated default form selection from DoorDash to UberEats
- **Added Shipt as platform option**: Extended AppType enum to include SHIPT alongside existing platforms

## Project Architecture

### Backend Stack
- **Framework**: FastAPI (Python 3.11)
- **Database**: SQLite with SQLAlchemy ORM
- **Validation**: Pydantic v2
- **Server**: Uvicorn
- **Port**: 8000

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack React Query
- **Port**: 5000 (webview)

### Key Architectural Decisions
1. **SQLite for Simplicity**: Using SQLite instead of PostgreSQL as specified for faster MVP development and easier local testing
2. **Signed Amount Storage**: Expenses and cancellations stored as negative amounts in the database for simpler aggregation
3. **Calculator-First UX**: Bottom-anchored calculator and form for mobile-first touch interaction
4. **Unified Entry Ledger**: Single table for all transaction types (ORDER, BONUS, EXPENSE, CANCELLATION) with type enum
5. **Real-Time Calculations**: Profit calculated dynamically: revenue - expenses - (miles * cost_per_mile)

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## API Endpoints
- `GET /api/health` - Health check
- `GET /api/settings` - Get cost per mile setting
- `PUT /api/settings` - Update settings
- `POST /api/entries` - Create new entry
- `GET /api/entries` - List entries with filtering
- `PUT /api/entries/{id}` - Update entry
- `DELETE /api/entries/{id}` - Delete entry
- `GET /api/rollup` - Get aggregated stats for a time period

## Database Schema

### Entry Table
- `id` (PK)
- `timestamp` - UTC datetime
- `type` - ORDER | BONUS | EXPENSE | CANCELLATION
- `app` - DOORDASH | UBEREATS | INSTACART | GRUBHUB | OTHER
- `order_id` - Optional string
- `amount` - Decimal (signed: positive for revenue, negative for expenses)
- `distance_miles` - Float
- `duration_minutes` - Integer
- `category` - Optional (for expenses: GAS, PARKING, TOLLS, etc.)
- `note` - Optional text
- `created_at`, `updated_at`

### Settings Table
- `id` = 1 (singleton)
- `cost_per_mile` - Decimal (default 0.35)

## Running the Application

### Development
```bash
# Install dependencies
make init

# Initialize database
make migrate

# Seed sample data
make seed

# Run backend (separate terminal)
make api

# Run frontend (separate terminal)
make web

# Visit http://localhost:5000
```

### Testing
```bash
# Run backend tests
pytest backend/tests -v
```

## Next Steps / Future Enhancements
- Dark mode toggle
- Data export (CSV/PDF) for tax reporting
- Advanced filtering and search
- Sparkline charts for trends
- Target hourly rate tracking
- Bulk import from delivery platform CSV exports
- Custom date range picker for flexible filtering
- Multiple mileage cost rates (IRS standard vs actual)
