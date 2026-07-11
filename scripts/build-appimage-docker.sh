#!/usr/bin/env bash
# Portable AppImage build.
#
# Why this exists: native modules (node-pty, better-sqlite3) compiled on the
# host link against the host's glibc. A bleeding-edge build machine (e.g.
# glibc 2.43) produces binaries that refuse to load on any older distro with
# a misleading "Cannot find module .../pty.node" error. Building inside a
# Debian 11 container (glibc 2.31) makes the AppImage run on Ubuntu 20.04+,
# Debian 11+, Fedora 35+, etc.
#
# Requires: docker (the script uses sudo if the user lacks docker-group perms)
# and a node_modules already populated on the host (pnpm install).
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE="node:20-bullseye"

# Resolve version exactly like build-appimage.sh
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || true)
PKG_VERSION=$(node -p "require('./package.json').version")
VERSION="${GIT_TAG:+${GIT_TAG#v}}"
VERSION="${VERSION:-$PKG_VERSION}"

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

echo "=== Bifrost portable AppImage (inside $IMAGE, glibc 2.31) ==="
echo "Version: $VERSION"

[ -d node_modules ] || { echo "ERROR: run 'pnpm install' first"; exit 1; }

$DOCKER pull "$IMAGE"

# The container reuses the host's node_modules (same platform/arch) and only:
#  1. re-links the native modules against Electron's ABI with the OLD toolchain
#  2. runs the production bundle
#  3. packages the AppImage
# npmRebuild=false so electron-builder doesn't re-trigger the cpu-features
# optional-dep failure (see build-appimage.sh).
$DOCKER run --rm \
  -v "$PWD:/project" -w /project \
  -e ELECTRON_CACHE=/project/.cache/electron \
  -e ELECTRON_BUILDER_CACHE=/project/.cache/electron-builder \
  "$IMAGE" bash -c "
    set -euo pipefail
    echo '--- toolchain ---'
    # sed -n 1p (not head -1) — head exits after one line and the writer gets
    # SIGPIPE (exit 141), which pipefail turns into a flaky script abort.
    ldd --version | sed -n 1p; gcc --version | sed -n 1p; node --version
    echo '--- [1/3] electron-rebuild (better-sqlite3, node-pty) ---'
    node_modules/.bin/electron-rebuild --force --only better-sqlite3,node-pty
    echo '--- [2/3] electron-vite build ---'
    node_modules/.bin/electron-vite build
    echo '--- [3/3] electron-builder (AppImage) ---'
    node_modules/.bin/electron-builder --linux AppImage -c.npmRebuild=false
    chown -R $(id -u):$(id -g) dist out .cache \
      node_modules/node-pty node_modules/better-sqlite3 \
      node_modules/.pnpm/node-pty* node_modules/.pnpm/better-sqlite3* 2>/dev/null || true
  "

APPIMAGE=$(find dist -name '*.AppImage' -type f | sort -r | sed -n 1p)
echo ""
echo "=== Done ==="
echo "  AppImage : $APPIMAGE"
echo "  Size     : $(du -h "$APPIMAGE" | cut -f1)"
echo "  Commit   : $(git rev-parse --short HEAD)"
echo ""
echo "--- portability check (max glibc symbol required by pty.node) ---"
PTY=$(find node_modules -path '*node-pty/build/Release/pty.node' | sed -n 1p)
objdump -T "$PTY" | grep -oE 'GLIBC_[0-9.]+' | sort -Vu | tail -1
