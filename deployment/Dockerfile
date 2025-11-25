# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Create frontend directory structure
RUN mkdir -p frontend/src/components frontend/src/lib frontend/src/pages frontend/src/styles

# Copy package files
COPY package.json package-lock.json ./frontend/

# Copy config files
COPY main.tsx index.html vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js vite-env.d.ts App.tsx ./frontend/

# Copy all TypeScript/TSX component files to components
COPY AISuggestions.tsx CalcPad.tsx ConfirmDialog.tsx CountUpNumber.tsx EntryForm.tsx EntriesTable.tsx EntryViewer.tsx KpiCard.tsx PeriodChips.tsx ProfitGoalsBar.tsx SettingsDrawer.tsx SummaryCard.tsx Toast.tsx TripTracker.tsx ./frontend/src/components/

# Copy all lib files
COPY api.ts dateUtils.ts themes.ts themeContext.tsx ./frontend/src/lib/

# Copy page components
COPY Dashboard.tsx ./frontend/src/pages/

# Copy styles
COPY tailwind.css index.css ./frontend/src/styles/

# Install dependencies
WORKDIR /app/frontend
RUN npm ci

# Build frontend
RUN npm run build

# Final stage: Python runtime
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create complete backend directory structure
RUN mkdir -p backend/routers backend/services backend/scripts backend/tests

# Copy backend core files
COPY app.py db.py models.py schemas.py __init__.py ./backend/

# Copy router files and create __init__.py
COPY entries.py goals.py health.py oauth.py rollup.py settings.py suggestions.py ./backend/routers/
RUN echo "" > ./backend/routers/__init__.py

# Copy service files and create __init__.py
COPY period.py rollup_service.py sync_service.py background_jobs.py ai_suggestions.py ./backend/services/
RUN echo "" > ./backend/services/__init__.py

# Copy scripts and create __init__.py
COPY seed.py seed_this_week.py ./backend/scripts/
RUN echo "" > ./backend/scripts/__init__.py

# Copy tests and create __init__.py
COPY test_entries.py test_rollup.py ./backend/tests/
RUN echo "" > ./backend/tests/__init__.py

# Copy documentation and config files
COPY README.md replit.md Makefile ./

# Copy the built frontend from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the startup script
COPY start.sh .
RUN chmod +x start.sh

# Expose ports
EXPOSE 5000 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start the application
CMD ["bash", "start.sh"]
