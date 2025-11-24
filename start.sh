#!/bin/bash
set -e

echo "Starting Delivery Driver Earnings Dashboard..."

# Initialize database if needed
python -c "from backend.db import Base, engine; Base.metadata.create_all(bind=engine)" || true

# Start backend API in the background
echo "Starting backend API..."
uvicorn backend.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend server (serve the built dist folder)
echo "Starting frontend server..."
cd /app
python -m http.server 5000 --directory ./frontend/dist &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
