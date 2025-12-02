# Earnings Ninja - Delivery Driver Earnings Dashboard

A mobile-first web application designed for delivery drivers to track earnings, expenses, mileage, and profit across multiple gig platforms (DoorDash, UberEats, Instacart, GrubHub, Shipt).

![Earnings Ninja Logo](frontend/src/assets/logo-ninja-official.png)

## Features

### Real-Time Dashboard
- **Live KPI Tracking**: Revenue, Expenses, Profit, Miles, Orders, $/Mile, $/Hour
- **Multiple Time Periods**: Today, Yesterday, This Week, Last 7 Days, This Month, Last Month
- **Day Navigation**: Browse between days with arrow controls
- **Customizable Metrics**: Show/hide individual KPIs
- **CSV Export**: Download your data for external analysis

### Financial Management
- **Calculator-Style Input**: Intuitive numeric keypad with Add/Subtract modes
- **Multi-Platform Support**: DoorDash, UberEats, Instacart, GrubHub, Shipt, and Other
- **Entry Types**: Orders, Bonuses, Expenses, Cancellations
- **Expense Categories**: Gas, Parking, Tolls, Maintenance, Phone, Subscription, Food, Leisure, Other
- **Business Expense Tracking**: Mark expenses as tax-deductible
- **Receipt Upload**: Attach photos to expense entries
- **Mileage Calculator**: Built-in distance tracking
- **Automatic Profit Calculation**: Real-time profit based on cost per mile

### Goal Setting & Progress
- **Customizable Goals**: Set profit targets for Today, Week, and Month
- **Visual Progress Bars**: Smooth animated progress tracking
- **Milestone Celebrations**: Alerts at 25%, 50%, 75%, and 100% completion
- **Default Goals**: New users start with sensible default targets

### AI-Powered Insights
- **Smart Suggestions**: GPT-4o-mini analyzes your performance
- **Time Breakdown Analysis**: Required time per order for different hourly rates
- **Peak Time Detection**: Identify your most profitable hours
- **Minimum Order Recommendations**: Suggested minimum amounts to accept

### Micro Animations
- **Revenue Count-Up**: Numbers animate smoothly when values change
- **Expense Shake**: Card shakes when big expenses ($5+) are added
- **Miles Pulse**: Subtle pulse when distance updates
- **Progress Bar Transitions**: Smooth cubic-bezier easing
- **Ninja Logo Glow**: Bright yellow/green glow on $50 profit milestones

### Prelaunch & Waitlist
- **Coming Soon Page**: Yellow-themed landing page for new visitors
- **Email Signup**: Collect emails for launch notifications
- **Early Access Codes**: Password-protected access for beta testers
- **Waitlist Database**: Stores signups for launch day

### User Interface
- **Mobile-First Design**: Optimized for smartphone use
- **Theme Options**: Dark Neon (default), Simple Light, B/W Neon
- **Responsive Layout**: Desktop, tablet, and mobile support
- **Search Functionality**: Find transactions by note, app, category, or amount
- **Profit Calendar**: Month view with color-coded daily profits

### Authentication & Security
- **User Accounts**: Secure registration and login
- **Demo Mode**: Try the app without creating an account
- **Password Reset**: Email-based password recovery
- **Session Persistence**: Stay logged in across sessions

### Achievements & Gamification
- **Level System**: Beginner, Hustler, Boss, Legendary
- **Green Day Streaks**: Track consecutive profitable days
- **Pot of Gold Tracker**: Visual savings representation
- **Share Cards**: Generate shareable performance images

## Tech Stack

**Backend:**
- FastAPI (Python 3.11)
- SQLite + SQLAlchemy ORM
- Pydantic v2
- APScheduler (background jobs)
- OpenAI GPT-4o-mini
- Resend (email service)

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- TanStack React Query
- Theme Context API

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### Running Locally

1. **Start the Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

2. **Start the Frontend**
```bash
cd frontend
npm install
npm run dev
```

3. **Visit the App**
```
http://localhost:5000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PRELAUNCH_ACCESS_CODE` | Early access password (default: ep2025) |
| `RESEND_API_KEY` | API key for password reset emails |
| `DATABASE_URL` | PostgreSQL connection string (optional) |

## Project Structure

```
.
├── backend/
│   ├── routers/          # API endpoints
│   ├── services/         # Business logic
│   ├── models.py         # Database models
│   ├── schemas.py        # Pydantic schemas
│   └── app.py            # FastAPI application
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── lib/          # Utilities & context
│   │   ├── styles/       # Tailwind CSS
│   │   └── assets/       # Images & icons
│   └── index.html
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/demo` | Demo login |
| GET | `/api/entries` | List entries |
| POST | `/api/entries` | Create entry |
| PUT | `/api/entries/{id}` | Update entry |
| DELETE | `/api/entries/{id}` | Delete entry |
| GET | `/api/rollup` | Get aggregated stats |
| GET | `/api/goals/{timeframe}` | Get goal |
| POST | `/api/goals/{timeframe}` | Set goal |
| GET | `/api/suggestions` | Get AI suggestions |
| POST | `/api/waitlist/signup` | Join waitlist |
| POST | `/api/waitlist/verify-access` | Verify access code |

## Usage

### Adding Entries
1. Tap the calculator button at the bottom
2. Enter the amount using the keypad
3. Select Add (+) for income or Subtract (-) for expenses
4. Fill in optional details (app, distance, notes)
5. Tap "Save Entry"

### Setting Goals
1. View the goal progress bar at the top
2. Tap "Set Goal" or the edit icon
3. Enter your profit target
4. Track progress throughout the period

### Using AI Suggestions
1. Expand the "AI Tips" section
2. Review personalized recommendations
3. Check time breakdown strategies
4. Apply suggested minimum order amounts

## Deployment

This app is configured for deployment on Replit. Use the Deploy button to publish your app with a live URL.

## License

MIT License - See LICENSE file for details.

## Support

For support, please open an issue on GitHub.

---

**Made with love for delivery drivers everywhere**

*Grow your earnings with Earnings Ninja*
