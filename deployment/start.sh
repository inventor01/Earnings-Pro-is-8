#!/bin/bash
set -e

echo "Starting Delivery Driver Earnings Dashboard..."

# Get PORT from environment, default to 8000
API_PORT=${PORT:-8000}
FRONTEND_PORT=$((API_PORT + 1000))

echo "API will run on port: $API_PORT"
echo "Frontend will run on port: $FRONTEND_PORT"

# Initialize database if needed
echo "Initializing database..."
python -c "from backend.db import Base, engine; Base.metadata.create_all(bind=engine)" 2>&1 || echo "Database initialization skipped or already exists"

# Start backend API on the specified PORT (Railway sets this)
echo "Starting backend API..."
uvicorn backend.app:app --host 0.0.0.0 --port $API_PORT &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 2

# Start frontend server (serve the built dist folder) on a different port
echo "Starting frontend server on port 5000..."
cd /app
python -m http.server 5000 --directory ./frontend/dist &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Trap signals and cleanup
cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for both processes - if one dies, exit
wait -n
