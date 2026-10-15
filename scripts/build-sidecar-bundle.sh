#!/usr/bin/env bash
# Build PyInstaller one-file AI sidecar for the current host triple.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
BIN_DIR="$ROOT/src-tauri/binaries"
# Freeze only the base application, never a contributor's installed AI extras.
VENV="$SIDECAR/.build-venv"
unset PYTHONPATH PYTHONHOME PYTHONUSERBASE || true
export PYTHONNOUSERSITE=1

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
fi

"$VENV/bin/pip" install -e "$SIDECAR" pyinstaller pyinstaller-hooks-contrib
rm -rf "$SIDECAR/dist" "$SIDECAR/build"

echo "Building $OUT_NAME..."
unset PYTHONPATH || true
cd "$SIDECAR"
"$VENV/bin/pyinstaller" --noconfirm --onefile --clean \
  --name "$BASE" \
  --collect-all uvicorn \
  --collect-all fastapi \
  --collect-all starlette \
  --collect-all librosa \
  --collect-all soundfile \
  --collect-all av \
  --hidden-import ai_sidecar.main \
  --exclude-module torch \
  --exclude-module torchvision \
  --exclude-module torio \
  --exclude-module demucs \
  --exclude-module rvc_python \
  run_sidecar.py

mkdir -p "$BIN_DIR"
cp -f "$SIDECAR/dist/$OUT_NAME" "$BIN_DIR/"
echo "Copied to src-tauri/binaries/$OUT_NAME"
