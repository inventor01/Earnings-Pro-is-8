# Delivery Driver Earnings Dashboard

A mobile-first web application for delivery drivers to track earnings, expenses, mileage, and profit across multiple platforms (DoorDash, UberEats, Instacart, GrubHub).

## Features

- **Calculator-Style Input**: Numeric keypad with Add (➕) and Subtract (➖) modes
- **Real-Time KPIs**: Revenue, Expenses, Profit, Miles, $/mile, $/hour
- **Time Filters**: Today, Yesterday, This Week, Last 7 Days, This Month, Last Month, Custom
- **Multi-Platform Support**: Track entries across different delivery apps
- **Expense Tracking**: Gas, parking, tolls, maintenance, phone, subscriptions
- **Mileage Calculation**: Automatic profit calculation based on cost per mile
- **Mobile-First Design**: Clean, Tailwind-based UI optimized for touch

## Tech Stack

**Backend:**
- FastAPI (Python 3.11)
- SQLite + SQLAlchemy
- Pydantic v2

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- TanStack React Query

## Quick Start

### Install Dependencies
```bash
make init
```

### Initialize Database
```bash
make migrate
```

### Seed Sample Data (Optional)
```bash
make seed
```

### Run Backend (Port 8000)
```bash
make api
```

### Run Frontend (Port 5000)
In a new terminal:
```bash
make web
```

### Visit the App
Open http://localhost:5000 in your browser

## Usage

### Adding Entries

1. **Enter Amount**: Use the numeric keypad to enter the amount
2. **Select Mode**: 
   - ➕ Add for revenue (Orders, Bonuses)
   - ➖ Subtract for expenses/cancellations
3. **Fill Details**: Select app, add order ID, distance, duration, etc.
4. **Save**: Click the sticky "Save Entry" button at the bottom

### Viewing Stats

- Select time period chips to filter data
- View KPI cards for quick insights
- Review entries table for detailed history

### Settings

- Click the settings icon (⚙️) in the top right
- Adjust cost per mile for accurate profit calculations

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `POST /api/entries` - Create entry
- `GET /api/entries` - List entries (with filtering)
- `PUT /api/entries/{id}` - Update entry
- `DELETE /api/entries/{id}` - Delete entry
- `GET /api/rollup` - Get aggregated stats

## Testing

Run backend tests:
```bash
pytest backend/tests -v
```

## Project Structure

```
.
├── backend/
│   ├── app.py              # FastAPI app
│   ├── db.py               # Database setup
│   ├── models.py           # SQLAlchemy models
│   ├── schemas.py          # Pydantic schemas
│   ├── routers/            # API routes
│   ├── services/           # Business logic
│   ├── tests/              # Backend tests
│   └── scripts/seed.py     # Sample data
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Pages
│   │   └── lib/api.ts      # API client
│   ├── index.html
│   └── vite.config.ts
├── Makefile
└── README.md
```

## License

MIT
