# Flat Deployment Package

This folder contains all files needed to run the Delivery Driver Earnings Dashboard in a flat structure (no subfolders).

## What's Inside

**Configuration Files:**
- `Dockerfile` - Multi-stage Docker build
- `start.sh` - Startup script
- `requirements.txt` - Python dependencies
- `package.json` & `package-lock.json` - Node.js dependencies
- `.dockerignore` - Docker build exclusions
- `tsconfig.json`, `vite.config.ts`, `tailwind.config.js` - Build configs

**Backend Files (Python):**
- `app.py`, `db.py`, `models.py`, `schemas.py` - Core backend
- `entries.py`, `goals.py`, `health.py`, `oauth.py`, `rollup.py`, `settings.py`, `suggestions.py` - API routers
- `period.py`, `rollup_service.py`, `sync_service.py` - Services
- `seed.py`, `seed_this_week.py` - Database scripts
- `test_*.py` - Tests

**Frontend Files (React/TypeScript):**
- `Dashboard.tsx` - Main page
- `*.tsx` - React components (Button, Card, Form, etc)
- `*.ts` - Utilities and configs
- `*.css` - Styles
- `index.html` - Entry point
- `main.tsx` - React setup

## Deployment Instructions

### Upload Everything to GitHub
```bash
# Copy everything from deployment folder to your repo root
cp -r deployment/* /path/to/your/repo/
cd /path/to/your/repo
git add .
git commit -m "Deploy flat structure"
git push origin main
```

### Deploy to Railway
1. Connect your GitHub repo to Railway
2. Railway will automatically detect the Dockerfile
3. Set environment variables:
   - `SESSION_SECRET` - A secure random string
4. Deploy!

### Build Locally on Your Machine
```bash
# Make sure you have Docker installed
docker build -t earnings-dashboard .
docker run -p 5000:5000 -p 8000:8000 earnings-dashboard
```

Then access:
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:8000

## How It Works

The Dockerfile automatically:
1. Reorganizes flat files into proper folder structure during build
2. Builds the frontend with Node.js
3. Installs Python dependencies
4. Runs both backend and frontend services

No manual restructuring needed - just push and deploy!
