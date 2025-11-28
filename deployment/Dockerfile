# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend code and install dependencies
COPY frontend/ .
RUN npm ci --legacy-peer-deps

# Build frontend
RUN npm run build

# Final stage: Python runtime with Node (for potential runtime needs)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy the built frontend from the frontend-builder stage to backend/dist (backend serves it)
COPY --from=frontend-builder /app/dist ./backend/dist

# Copy the startup script
COPY start.sh .
RUN chmod +x start.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start the application - Railway uses $PORT from environment
CMD ["bash", "start.sh"]
