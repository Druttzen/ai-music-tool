#!/usr/bin/env bash
# Build PyInstaller one-file AI sidecar for the current host triple.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
BIN_DIR="$ROOT/src-tauri/binaries"
VENV="$SIDECAR/.venv"

TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
BASE="ai-sidecar-${TRIPLE}"
OUT_NAME="$BASE"
[[ "$TRIPLE" == *windows* ]] && OUT_NAME="${BASE}.exe"

PY=""
for v in python3.12 python3.11 python3.10 python3; do
  if command -v "$v" >/dev/null 2>&1; then PY="$v"; break; fi
done
[[ -n "$PY" ]] || { echo "Need Python 3.10-3.12"; exit 1; }

if [[ ! -d "$VENV" ]]; then
  echo "Creating sidecar venv..."
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install -e "$SIDECAR"
fi

"$VENV/bin/pip" install pyinstaller pyinstaller-hooks-contrib
rm -rf "$SIDECAR/dist" "$SIDECAR/build"

echo "Building $OUT_NAME..."
cd "$SIDECAR"
"$VENV/bin/pyinstaller" --noconfirm --onefile --clean \
  --name "$BASE" \
  --collect-all uvicorn \
  --collect-all fastapi \
  --collect-all starlette \
  --collect-all librosa \
  --collect-all soundfile \
  --hidden-import ai_sidecar.main \
  run_sidecar.py

mkdir -p "$BIN_DIR"
cp -f "$SIDECAR/dist/$OUT_NAME" "$BIN_DIR/"
echo "Copied to src-tauri/binaries/$OUT_NAME"
