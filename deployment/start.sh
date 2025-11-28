#!/bin/bash
set -e

echo "Starting Delivery Driver Earnings Dashboard..."

# Get PORT from environment, default to 8000 (Railway sets this)
PORT=${PORT:-8000}

echo "Server will run on port: $PORT"

# Initialize database if needed
echo "Initializing database..."
python -c "from backend.db import Base, engine; Base.metadata.create_all(bind=engine)" 2>&1 || echo "Database initialization skipped or already exists"

# Start backend API with frontend static file serving
# Backend serves both API and frontend on the same port
echo "Starting backend API + frontend on port $PORT..."
uvicorn backend.app:app --host 0.0.0.0 --port $PORT
