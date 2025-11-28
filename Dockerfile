# Multi-stage build: Node.js frontend builder
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend code and package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy frontend source
COPY frontend/src ./src
COPY frontend/tsconfig.json frontend/vite.config.ts ./

# Build frontend (outputs to dist/)
RUN npm run build

# Final stage: Python runtime with backend + static frontend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from frontend-builder stage to backend/dist
COPY --from=frontend-builder /app/frontend/dist ./backend/dist

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port (Railway will set PORT env var, defaults to 8000)
EXPOSE 8000

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:${PORT:-8000}/api/health')" || exit 1

# Start application via startup script
CMD ["bash", "start.sh"]
