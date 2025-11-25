# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Create frontend directory structure
RUN mkdir -p frontend/src/components frontend/src/lib frontend/src/pages frontend/src/styles

# Copy all frontend files and reorganize them
COPY *.tsx ./frontend/src/components/ 2>/dev/null || true
COPY *.ts ./frontend/src/lib/ 2>/dev/null || true
COPY Dashboard.tsx ./frontend/src/pages/ 2>/dev/null || true
COPY *.css ./frontend/src/styles/ 2>/dev/null || true
COPY main.tsx index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./frontend/
COPY package*.json ./frontend/

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

# Copy all Python files and reorganize them
COPY *.py ./backend/ 2>/dev/null || true
COPY app.py db.py models.py schemas.py __init__.py ./backend/
COPY entries.py goals.py health.py oauth.py rollup.py settings.py suggestions.py ./backend/routers/
COPY period.py rollup_service.py sync_service.py ./backend/services/
COPY seed.py seed_this_week.py ./backend/scripts/
COPY test_*.py ./backend/tests/

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
