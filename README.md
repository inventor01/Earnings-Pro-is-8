
# 🥷 Earnings Ninja - Delivery Driver Dashboard

A comprehensive, mobile-first web application for delivery drivers to track earnings, expenses, mileage, and profit across multiple platforms (DoorDash, UberEats, Instacart, GrubHub, Shipt).

![Earnings Ninja Logo](frontend/src/assets/logo-ninja-official.png)

## 🌟 Features

### 📊 Performance Tracking
- **Real-Time KPIs**: Revenue, Expenses, Profit, Miles, Orders, Average Order, Profit Margin
- **Multiple Time Periods**: Today, Yesterday, This Week, Last 7 Days, This Month, Last Month
- **Day Navigation**: Navigate between days when viewing "Today" period
- **Show/Hide Metrics**: Customize which KPIs are visible in Performance Overview
- **Export Data**: Download entries as CSV for external analysis

### 💰 Financial Management
- **Calculator-Style Input**: Numeric keypad with Add (➕) and Subtract (➖) modes
- **Multi-Platform Support**: Track entries across DoorDash, UberEats, Instacart, GrubHub, Shipt, and Other
- **Entry Types**: Orders, Bonuses, Expenses, Cancellations
- **Expense Categories**: Gas, Parking, Tolls, Maintenance, Phone, Subscription, Food, Leisure, Other
- **Business Expense Tracking**: Mark expenses as business-related for tax purposes
- **Receipt Upload**: Attach receipt photos to expense entries
- **Mileage Calculator**: Built-in distance calculator for accurate mileage tracking
- **Automatic Profit Calculation**: Real-time profit based on cost per mile settings

### 🎯 Goal Setting & Progress
- **Customizable Goals**: Set profit targets for different timeframes
- **Progress Bar**: Visual representation of goal achievement
- **Milestone Alerts**: Celebrate 25%, 50%, 75%, and 100% goal completion
- **Goal Streaks**: Track consecutive months of goal achievement
- **Multi-Timeframe Goals**: Support for Today, Week, Month, and custom goals

### 🤖 AI-Powered Insights
- **Smart Suggestions**: AI analyzes your performance and provides actionable tips
- **Time Breakdown Analysis**: Calculate required time per order for different hourly rates
- **Peak Time Detection**: Identify your most profitable hours
- **Minimum Order Recommendations**: Suggested minimum order amounts to accept
- **Performance Reasoning**: Detailed explanations for AI recommendations

### 📱 User Interface
- **Mobile-First Design**: Optimized for smartphone use
- **Theme Options**: 
  - Ninja Green (Light theme)
  - Dark Neon (Dark theme)
  - Simple Light (Minimalist theme)
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile
- **Collapsible Sections**: Expand/collapse Performance Overview and other sections
- **Search Functionality**: Quickly find transactions by note, app, category, type, or amount
- **Scroll to Top/Bottom**: Quick navigation buttons for long entry lists

### 📅 Calendar & Scheduling
- **Profit Calendar**: Month view showing daily profit at a glance
- **Color-Coded Days**: Green (profit), Red (loss), Gray (no data)
- **Date Selection**: Click calendar days to view specific date entries
- **Date/Time Picker**: Accurate timestamp entry with EST timezone support

### 🏆 Achievements & Gamification
- **Level System**: Progress from Beginner → Hustler → Boss → Legendary
- **Green Day Streaks**: Track consecutive profitable days (🔥)
- **Badge System**: Unlock achievements for various milestones
- **Pot of Gold Tracker**: Visual representation of accumulated savings
- **Points System**: Daily check-ins and unlockable rewards
- **Leaderboard**: Compete with other drivers (coming soon)

### 🎨 Customization
- **Metric Visibility**: Show/hide individual KPIs (Revenue, Expenses, Profit, etc.)
- **Account Data Privacy**: Toggle to hide sensitive financial information
- **Sound Effects**: 
  - Ka-ching on entry save
  - Cha-ching on goal completion
  - Button click sounds
  - Intro sound on login
  - Mute/unmute option
- **Theme Persistence**: Saves your theme preference

### 📈 Entry Management
- **Quick Add**: Fast entry creation with calculator interface
- **Detailed Form**: Optional fields for distance, notes, receipts, etc.
- **Edit Entries**: Modify existing entries with full form support
- **View Entry Details**: Expandable view with all entry information
- **Bulk Delete**: Select and delete multiple entries at once
- **Entry Viewer**: Dedicated modal for viewing complete entry details
- **Platform Icons**: Visual indicators for each delivery app

### ⚙️ Settings & Configuration
- **Cost Per Mile**: Customize your vehicle operating cost
- **Account Information**: View username and email
- **Data Management**:
  - Reset Today's Data
  - Reset All Data (with confirmation)
  - Export to CSV
- **Tutorial**: Interactive onboarding tour
- **Sign Out**: Secure session management

### 🔐 Authentication & Security
- **User Accounts**: Secure registration and login
- **Guest Mode**: Try the app without creating an account
- **Password Reset**: Forgot password functionality
- **Session Persistence**: Stay logged in across sessions
- **OAuth Integration**: Platform sync capabilities (Uber, Shipt)

### 📊 Advanced Analytics
- **Rollup Statistics**: Aggregated data by timeframe
- **Hourly Rate Calculation**: Automatic $/hour based on time tracking
- **Efficiency Metrics**: $/mile for route optimization
- **Order Average**: Track average order value trends
- **Expense Breakdown**: Categorized expense analysis
- **Profit Margin**: Percentage-based profitability tracking

### 🎭 User Experience
- **Toast Notifications**: Success/error messages for all actions
- **Confirmation Dialogs**: Prevent accidental data deletion
- **Loading States**: Visual feedback during operations
- **Error Handling**: Graceful error messages and recovery
- **Animated Transitions**: Smooth UI interactions
- **Coin Burst Animation**: Celebratory effects on page load
- **Logo Animation**: Interactive click animation
- **Share Cards**: Generate shareable performance images

### 📱 Mobile Optimizations
- **Touch-Friendly**: Large tap targets for mobile use
- **Sticky Bottom Bar**: Calculator always accessible
- **Swipe Gestures**: Intuitive mobile interactions
- **Compact Header**: Minimal space usage on mobile
- **Responsive Tables**: Mobile-optimized entry lists
- **Auto-Scroll**: Smart scrolling to relevant sections

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd earnings-ninja
```

2. **Install dependencies**
```bash
make init
```

3. **Initialize database**
```bash
make migrate
```

4. **Seed sample data (optional)**
```bash
make seed
```

5. **Run the application**

Start the backend (Terminal 1):
```bash
make api
```

Start the frontend (Terminal 2):
```bash
make web
```

6. **Visit the app**
```
http://localhost:5000
```

## 🛠️ Tech Stack

**Backend:**
- FastAPI (Python 3.11)
- SQLite + SQLAlchemy
- Pydantic v2
- APScheduler (background jobs)
- OpenAI GPT-4o-mini (AI suggestions)

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- TanStack React Query
- Theme Context API

## 📁 Project Structure

```
.
├── backend/
│   ├── routers/          # API endpoints
│   ├── services/         # Business logic
│   ├── models.py         # Database models
│   ├── schemas.py        # Pydantic schemas
│   └── app.py           # FastAPI application
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities & context
│   │   └── styles/      # Tailwind CSS
│   └── index.html
└── Makefile             # Development commands
```

## 🎯 Usage

### Adding Entries
1. Click the "Add Entry" button (sticky bottom bar)
2. Enter amount using calculator keypad
3. Select Add (➕) for revenue or Subtract (➖) for expenses
4. Fill optional details (app, distance, notes, etc.)
5. Click "Save Entry"

### Setting Goals
1. View the goal progress bar at the top
2. Click "Set Goal" or "Edit" to modify target
3. Enter your profit goal amount
4. Track progress throughout the period

### Viewing Stats
- Select time period chips (Today, Week, Month, etc.)
- Navigate between days using arrow buttons
- Toggle Performance Overview visibility
- Hide/show specific KPIs in settings

### Using AI Suggestions
- Expand the "AI Tips" section
- Review your stats and suggestions
- Check time breakdown strategies
- Implement recommended minimum orders

## 🔧 Development

### Available Commands
```bash
make init      # Install all dependencies
make migrate   # Initialize database
make seed      # Add sample data
make api       # Run backend server
make web       # Run frontend dev server
make test      # Run tests
```

### API Endpoints
- `GET /api/health` - Health check
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `POST /api/entries` - Create entry
- `GET /api/entries` - List entries
- `PUT /api/entries/{id}` - Update entry
- `DELETE /api/entries/{id}` - Delete entry
- `GET /api/rollup` - Get aggregated stats
- `GET /api/suggestions` - Get AI suggestions
- `GET/POST /api/goals/{timeframe}` - Goal management

## 🌐 Deployment

This app is designed to be deployed on Replit with automatic deployment configuration. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💡 Feature Requests

Have an idea for a new feature? Open an issue with the "enhancement" label.

## 🐛 Bug Reports

Found a bug? Please open an issue with detailed reproduction steps.

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Made with ❤️ for delivery drivers everywhere**

*Grow your earnings with Earnings Ninja* 🥷💰
