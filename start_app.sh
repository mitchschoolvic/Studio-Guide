#!/bin/bash

# Configuration
APP_NAME="skeleton-tracker"
BACKEND_DIR="backend"
PYTHON_BIN="python3.10"

# 1. Navigate to Project Root (Directory where this script lives)
# This fixes the "No such file or directory" errors
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

echo "--- Project Root: $PROJECT_ROOT ---"



# 2. Python Environment Setup (REMOVED)

# 3. Cleanup Old Processes
# echo "Cleaning up old python processes..."
# pkill -f "app.main" || true

# 4. Start Python Backend (REMOVED)

# 5. Start Frontend (Vite)
echo "Starting Frontend Server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for Vite to spin up
sleep 5

# 6. Start Electron
echo "Starting Electron..."
# Check if we are in dev mode
if [ -f "package.json" ]; then
    # Tell Electron NOT to spawn python, since we did it above
    export ELECTRON_START_PYTHON=false
    npm start
else
    echo "ERROR: package.json not found in root."
fi

# 7. Cleanup on Exit
echo "Stopping Processes..."

kill $FRONTEND_PID