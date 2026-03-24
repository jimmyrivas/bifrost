#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Usage: ./scripts/release.sh [major|minor|patch|v0.2.0]
# - major/minor/patch: auto-bump from current version
# - vX.Y.Z: set explicit version

CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"

if [ $# -eq 0 ]; then
  echo "Usage: $0 [major|minor|patch|vX.Y.Z]"
  echo ""
  echo "  major   — bump major (0.2.0 → 1.0.0)"
  echo "  minor   — bump minor (0.2.0 → 0.3.0)"
  echo "  patch   — bump patch (0.2.0 → 0.2.1)"
  echo "  vX.Y.Z  — set explicit version"
  exit 1
fi

ARG="$1"

if [[ "$ARG" == v* ]]; then
  NEW="${ARG#v}"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$ARG" in
    major) NEW="$((MAJOR + 1)).0.0" ;;
    minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
    patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    *) echo "ERROR: Unknown argument '$ARG'"; exit 1 ;;
  esac
fi

echo "New version: $NEW"
echo ""

# 1. Check working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# 2. Update package.json version
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json
echo "[1/6] Updated package.json: $CURRENT → $NEW"

# 3. Run type check
echo "[2/6] Type checking..."
npx tsc --noEmit

# 4. Run tests
echo "[3/6] Running tests..."
npm test -- --reporter=dot 2>&1 | tail -3

# 5. Build
echo "[4/6] Building..."
npx electron-vite build 2>&1 | tail -5

# 6. Commit + tag
echo "[5/6] Committing..."
git add package.json
git commit -m "release: v$NEW"
git tag -a "v$NEW" -m "Release v$NEW"

echo "[6/6] Tagged v$NEW"
echo ""
echo "=== Release v$NEW ready ==="
echo ""
echo "Next steps:"
echo "  git push origin main --tags     # push to remote"
echo "  ./scripts/build-appimage.sh     # build AppImage"
echo ""
echo "To undo:"
echo "  git tag -d v$NEW && git reset --soft HEAD~1"
