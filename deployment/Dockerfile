# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Create frontend directory structure
RUN mkdir -p frontend/src/components frontend/src/lib frontend/src/pages frontend/src/styles

# Copy frontend files
COPY package.json package-lock.json ./frontend/
COPY main.tsx index.html vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js ./frontend/
COPY vite-env.d.ts ./frontend/src/

# Copy all TypeScript/TSX component files
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

# Create backend directory structure
RUN mkdir -p backend/routers backend/services backend/scripts backend/tests

# Copy backend core files
COPY app.py db.py models.py schemas.py __init__.py ./backend/

# Copy router files
COPY entries.py goals.py health.py oauth.py rollup.py settings.py suggestions.py ./backend/routers/

# Copy service files
COPY period.py rollup_service.py sync_service.py background_jobs.py ai_suggestions.py ./backend/services/

# Copy scripts
COPY seed.py seed_this_week.py ./backend/scripts/

# Copy tests
COPY test_entries.py test_rollup.py ./backend/tests/

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
