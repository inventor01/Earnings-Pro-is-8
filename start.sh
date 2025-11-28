#!/bin/bash
set -e

echo "Starting Delivery Driver Earnings Dashboard..."

# Get PORT from environment, default to 8000
PORT=${PORT:-8000}

# Initialize database if needed
echo "Initializing database..."
python -c "from backend.db import Base, engine; Base.metadata.create_all(bind=engine)" || true

# Start backend API with frontend static files
echo "Starting backend API on port $PORT..."
uvicorn backend.app:app --host 0.0.0.0 --port $PORT
