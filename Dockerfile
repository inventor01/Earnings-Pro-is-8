# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend code and install dependencies
COPY frontend/ .
RUN npm ci

# Build frontend
RUN npm run build

# Final stage: Python runtime
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy the built frontend from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./backend/dist

# Copy the startup script
COPY start.sh .
RUN chmod +x start.sh

# Expose port (Railway uses PORT environment variable)
EXPOSE 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start the application
CMD ["bash", "start.sh"]
