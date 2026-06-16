#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Resolve version from git tag or package.json
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || true)
PKG_VERSION=$(node -p "require('./package.json').version")

if [ -n "$GIT_TAG" ]; then
  VERSION="${GIT_TAG#v}"
  # Sync package.json if tag differs
  if [ "$VERSION" != "$PKG_VERSION" ]; then
    sed -i "s/\"version\": \"$PKG_VERSION\"/\"version\": \"$VERSION\"/" package.json
    echo "Synced package.json version to tag: $VERSION"
  fi
else
  # No exact tag — use describe for dev builds (e.g. v0.2.0-3-gabc1234)
  GIT_DESCRIBE=$(git describe --tags 2>/dev/null || echo "")
  if [ -n "$GIT_DESCRIBE" ]; then
    VERSION="${GIT_DESCRIBE#v}"
  else
    VERSION="$PKG_VERSION"
  fi
fi

echo "=== Bifrost AppImage Builder ==="
echo "Version: $VERSION  (tag: ${GIT_TAG:-none})"
echo ""

# 1. Check dependencies — this project is pinned to pnpm (packageManager field)
echo "[1/5] Checking dependencies..."
command -v node >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v pnpm >/dev/null || { echo "ERROR: pnpm not found (run: corepack enable)"; exit 1; }
echo "  Node $(node --version)  pnpm $(pnpm --version)"

# 2. Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "[2/5] Installing dependencies..."
  pnpm install --frozen-lockfile
else
  echo "[2/5] Dependencies OK"
fi

# 3. Rebuild native modules for Electron's ABI.
#    Use --only so electron-rebuild does NOT touch cpu-features, an OPTIONAL
#    ssh2 dependency whose git submodule pnpm doesn't fetch — building it fails
#    with "buildcheck.gypi not found" and would abort before the modules we
#    actually need. ssh2 loads cpu-features via try/catch and works without it.
echo "[3/5] Rebuilding native modules (better-sqlite3, node-pty)..."
pnpm exec electron-rebuild --only better-sqlite3,node-pty 2>&1 | tail -5

# 4. Build with electron-vite
echo "[4/5] Building with electron-vite..."
pnpm exec electron-vite build 2>&1 | tail -10

# 5. Package AppImage.
#    npmRebuild=false: native modules were already rebuilt in step 3. Letting
#    electron-builder rebuild them again would re-trigger the cpu-features
#    failure described above.
echo "[5/5] Packaging AppImage..."
pnpm exec electron-builder --linux -c.npmRebuild=false 2>&1 | tail -15

echo ""
echo "=== Done ==="
APPIMAGE=$(find dist -name '*.AppImage' -type f 2>/dev/null | sort -r | head -1)
if [ -n "$APPIMAGE" ]; then
  SIZE=$(du -h "$APPIMAGE" | cut -f1)
  echo ""
  echo "  AppImage : $APPIMAGE"
  echo "  Size     : $SIZE"
  echo "  Version  : $VERSION"
  echo "  Git tag  : ${GIT_TAG:-untagged}"
  echo "  Commit   : $(git rev-parse --short HEAD)"
else
  echo "ERROR: AppImage not found in dist/"
  exit 1
fi
