# Multi-stage build for optimal size and performance
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production && npm ci
COPY frontend/ .
RUN npm run build

# Python backend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./dist

COPY frontend/public/sounds ./dist/sounds

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "backend.app:app"]
