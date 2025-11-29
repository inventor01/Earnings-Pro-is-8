# ================================
# FRONTEND BUILD STAGE
# ================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy package files first
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Copy configs
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.* ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/index.html ./

# Copy source
COPY frontend/src ./src

# Build
RUN npm run build

# ================================
# BACKEND STAGE (Python FastAPI)
# ================================
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc postgresql-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source (preserves backend/ folder structure)
COPY backend ./backend

# Copy frontend build output
COPY --from=frontend-builder /app/frontend/dist ./dist

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH="/app"

# Expose port
EXPOSE 8000

# Start application (entry point is backend/app.py)
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
