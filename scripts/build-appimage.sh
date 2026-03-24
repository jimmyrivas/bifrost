#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Bifrost AppImage Builder ==="
echo ""

# 1. Check dependencies
echo "[1/5] Checking dependencies..."
command -v node >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v npm  >/dev/null || { echo "ERROR: npm not found";  exit 1; }
echo "  Node $(node --version)  npm $(npm --version)"

# 2. Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "[2/5] Installing dependencies..."
  npm ci
else
  echo "[2/5] Dependencies OK"
fi

# 3. Rebuild native modules for Electron
echo "[3/5] Rebuilding native modules (better-sqlite3, node-pty)..."
npx electron-rebuild -f -w better-sqlite3 node-pty 2>&1 | tail -5

# 4. Build with electron-vite
echo "[4/5] Building with electron-vite..."
npx electron-vite build 2>&1 | tail -10

# 5. Package AppImage
echo "[5/5] Packaging AppImage..."
npx electron-builder --linux AppImage 2>&1 | tail -15

echo ""
echo "=== Done ==="
APPIMAGE=$(find dist -name '*.AppImage' -type f 2>/dev/null | head -1)
if [ -n "$APPIMAGE" ]; then
  SIZE=$(du -h "$APPIMAGE" | cut -f1)
  echo "AppImage: $APPIMAGE ($SIZE)"
else
  echo "ERROR: AppImage not found in dist/"
  exit 1
fi
