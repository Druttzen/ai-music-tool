#!/usr/bin/env bash
# Ensure the Tauri externalBin sidecar exists for the current host triple.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries"
TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
NAME="ai-sidecar-${TRIPLE}"
[[ "$TRIPLE" == *windows* ]] && NAME="${NAME}.exe"
DEST="$BIN_DIR/$NAME"
STAMP="${DEST}.version"
PKG_VERSION="$(node -p "require('$ROOT/package.json').version")"

if [[ -f "$DEST" && -f "$STAMP" && "$(tr -d '[:space:]' < "$STAMP")" == "$PKG_VERSION" ]]; then
  echo "Sidecar binary current: $NAME ($PKG_VERSION)"
  exit 0
fi

if [[ -f "$DEST" ]]; then
  echo "Sidecar binary stale or unstamped: $NAME - rebuilding for $PKG_VERSION"
else
  echo "Sidecar binary missing - building via PyInstaller..."
fi
bash "$ROOT/scripts/build-sidecar-bundle.sh"
printf '%s\n' "$PKG_VERSION" > "$STAMP"
