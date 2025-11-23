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
- Time period filtering
- Multi-platform support
- Expense tracking with categories
- Mileage cost calculation
- Settings management
- Sample data seeded for testing

## Recent Changes (November 23, 2025)
- Initial project setup with backend (FastAPI + SQLite) and frontend (React + Vite + Tailwind)
- Implemented calculator component with numeric keypad, decimal support, backspace, and clear
- Created database models for Entry (unified ledger) and Settings (cost per mile)
- Built API endpoints for CRUD operations and rollup calculations
- Implemented all React components (KPI cards, period filters, entry form, entries table, settings drawer, toast notifications)
- Added seed script with 65 sample entries across 7 days
- Configured workflows for both backend (port 8000) and frontend (port 5000)
- All backend tests passing (9/9)

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
