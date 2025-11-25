# Multi-stage build: Backend and Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /build/frontend

# Copy frontend code
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Backend build stage (Python)
FROM python:3.11-slim AS backend-builder

WORKDIR /build/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final stage: Runtime
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Copy start script
COPY start.sh .
RUN chmod +x start.sh

# Expose ports
EXPOSE 5000 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start the application
CMD ["bash", "start.sh"]
