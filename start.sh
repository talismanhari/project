#!/usr/bin/env bash
# Quick Start Script for Calibrated Inference Deferral Digital Twin
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Calibrated Inference Deferral Digital Twin "
echo "=========================================================="

# 1. Start Python FastAPI Backend
echo "[1/2] Launching Python FastAPI ML Backend on http://127.0.0.1:8000..."
./venv/bin/python server.py &
BACKEND_PID=$!

# 2. Start Vite React Frontend
echo "[2/2] Launching React SCADA UI on http://localhost:5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "🚀 Digital Twin System is LIVE!"
echo "👉 SCADA Dashboard: http://localhost:5173"
echo "👉 FastAPI ML API:  http://127.0.0.1:8000"
echo "Press Ctrl+C to stop all services."
wait
