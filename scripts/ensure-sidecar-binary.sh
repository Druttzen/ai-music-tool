#!/usr/bin/env bash
# Ensure the Tauri externalBin sidecar exists for the current host triple.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries"
TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
NAME="ai-sidecar-${TRIPLE}"
[[ "$TRIPLE" == *windows* ]] && NAME="${NAME}.exe"
DEST="$BIN_DIR/$NAME"

if [[ -f "$DEST" ]]; then
  echo "Sidecar binary present: $NAME"
  exit 0
fi

echo "Sidecar binary missing - building via PyInstaller..."
bash "$ROOT/scripts/build-sidecar-bundle.sh"
