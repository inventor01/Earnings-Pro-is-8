# Deployment Guide

This project is configured for easy deployment on Railway. It uses a monorepo structure with a Python FastAPI backend and a React frontend.

## Quick Start on Railway

### Prerequisites
- Railway account (sign up at [railway.app](https://railway.app))
- GitHub repository with this code

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/delivery-driver-earnings-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway will automatically detect and deploy the application

### Step 3: Configure Environment Variables

In Railway dashboard, add the following environment variables:

```
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret
DATABASE_URL=postgresql://... (if using PostgreSQL)
```

For OAuth integration (optional):
```
UBER_CLIENT_ID=your_uber_client_id
UBER_CLIENT_SECRET=your_uber_client_secret
SHIPT_CLIENT_ID=your_shipt_client_id
SHIPT_CLIENT_SECRET=your_shipt_client_secret
```

## Project Structure

```
.
├── backend/              # FastAPI application
│   ├── app.py           # Main application entry
│   ├── db.py            # Database setup
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── routers/         # API endpoints
│   ├── services/        # Business logic
│   └── scripts/         # Utility scripts
├── frontend/            # React + TypeScript application
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── requirements.txt     # Python dependencies
└── Dockerfile          # Container configuration
```

## Local Development

### Option 1: Using Makefile

```bash
# Install dependencies
make init

# Start backend API
make api

# In another terminal, start frontend
make web
```

### Option 2: Manual Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies
cd frontend && npm install && cd ..

# Start backend (in one terminal)
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

# Start frontend (in another terminal)
cd frontend && npm run dev -- --host 0.0.0.0 --port 5000
```

## Database

### SQLite (Default - Local Development)
Uses `driver_ledger.db` file in the project root.

### PostgreSQL (Recommended for Production)
To use PostgreSQL on Railway:

1. Create a PostgreSQL database in Railway
2. Copy the `DATABASE_URL` connection string
3. Set it as an environment variable in Railway dashboard
4. The app will automatically use PostgreSQL if `DATABASE_URL` is set

## Features

- **Multi-platform support**: DoorDash, UberEats, Instacart, GrubHub, Shipt
- **Real-time analytics**: Revenue, expenses, profit, mileage tracking
- **AI-powered suggestions**: Using OpenAI GPT-4o-mini
- **Platform OAuth integration**: Connect Uber and Shipt accounts for automatic order syncing
- **Responsive design**: Mobile-first UI with Tailwind CSS
- **Multiple themes**: Dark Neon, Simple Light, B/W Neon

## Troubleshooting

### Build fails with missing dependencies
Make sure `requirements.txt` and `frontend/package.json` are up to date:
```bash
pip list > requirements.txt
cd frontend && npm list > package.json
```

### Frontend not loading
Check that:
1. Backend is running on port 8000
2. Frontend build completed successfully
3. `VITE_API_BASE` environment variable is set correctly

### Database issues
Reset the database:
```bash
# Delete the existing database
rm driver_ledger.db

# Restart the application (Railway will reinitialize)
```

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Backend server port | `8000` |
| `DATABASE_URL` | Database connection string | `sqlite:///./driver_ledger.db` |
| `OPENAI_API_KEY` | OpenAI API key for AI suggestions | `sk-...` |
| `SESSION_SECRET` | Secret for session management | `your-secret-key` |
| `VITE_API_BASE` | Frontend API base URL | `http://localhost:8000` |
| `UBER_CLIENT_ID` | Uber OAuth client ID | (optional) |
| `UBER_CLIENT_SECRET` | Uber OAuth client secret | (optional) |
| `SHIPT_CLIENT_ID` | Shipt OAuth client ID | (optional) |
| `SHIPT_CLIENT_SECRET` | Shipt OAuth client secret | (optional) |

## Support

For issues, check the README.md or contact support.
