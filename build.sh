#!/usr/bin/env bash
set -e

echo "========================================================"
echo "              Building Skydeck v3.0.0"
echo "========================================================"

echo "[1/3] Compiling Go Backend..."
mkdir -p electron/bin
cd backend
go build -ldflags="-s -w" -o ../electron/bin/skydeck-backend
cd ..

echo "[2/3] Building React + Tailwind Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "[3/3] Packaging Electron Desktop Application..."
npx electron-builder

echo "========================================================"
echo " Build complete! Artifacts available in dist/"
echo "========================================================"

