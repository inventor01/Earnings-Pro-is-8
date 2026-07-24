# Multi-stage build for optimal size and performance
# Public web domain serves the marketing/landing site (landing/), NOT the old
# React webapp under frontend/. The backend serves this build as /app/dist.
FROM node:20-alpine as landing-builder
WORKDIR /app/landing
COPY landing/package*.json ./
# Railway injects service env vars (incl. NODE_ENV=production) into the Docker
# build, which makes `npm ci` skip devDependencies — but vite lives there.
# Force-include dev deps so `vite build` is available.
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY landing/ .
RUN npm run build

# Python backend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY backend/ ./backend/
COPY --from=landing-builder /app/landing/dist ./dist

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "120", "backend.app:app"]
