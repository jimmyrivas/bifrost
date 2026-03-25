#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")

echo "=== Bifrost Windows Installer Builder ==="
echo "Version: $VERSION"
echo ""
echo "NOTE: Cross-compiling from Linux requires Wine and mono."
echo "  Install: sudo apt install wine mono-complete"
echo "  Or build natively on Windows with: scripts/build-windows.ps1"
echo ""

# 1. Check wine (needed for cross-compile)
if ! command -v wine &>/dev/null; then
  echo "WARNING: wine not found — NSIS installer may fail."
  echo "  Portable build should still work."
  echo ""
fi

# 2. Build
echo "[1/3] Building with electron-vite..."
npx electron-vite build 2>&1 | tail -5

# 3. Package for Windows
echo "[2/3] Packaging for Windows..."
npx electron-builder --win --x64 2>&1 | tail -15

# 4. Result
echo ""
echo "[3/3] Done"
EXE=$(find dist -name '*.exe' -type f 2>/dev/null | head -1)
PORTABLE=$(find dist -name '*portable*' -type f 2>/dev/null | head -1)
if [ -n "$EXE" ]; then
  echo "  Installer: $EXE ($(du -h "$EXE" | cut -f1))"
fi
if [ -n "$PORTABLE" ]; then
  echo "  Portable:  $PORTABLE ($(du -h "$PORTABLE" | cut -f1))"
fi
echo "  Version:   $VERSION"
