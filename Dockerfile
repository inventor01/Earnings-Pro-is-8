# Multi-stage build: Backend and Frontend
FROM python:3.11-slim AS backend-builder

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Frontend build stage
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/ ./
RUN npm ci
RUN npm run build

# Final stage: Runtime
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Create startup script
COPY start.sh .
RUN chmod +x start.sh

# Expose ports
EXPOSE 5000 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start the application
CMD ["bash", "start.sh"]
