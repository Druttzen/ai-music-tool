#!/usr/bin/env bash
# Install vocal-ml + vocal-rvc extras into the sidecar venv.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
VENV="$SIDECAR/.venv"

PY=""
for v in python3.12 python3.11 python3.10 python3; do
  if command -v "$v" >/dev/null 2>&1; then PY="$v"; break; fi
done
if [[ -z "$PY" ]]; then echo "Need Python 3.10-3.12"; exit 1; fi

if [[ ! -d "$VENV" ]]; then
  echo "Creating sidecar venv..."
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install -e "$SIDECAR"
fi

echo "Installing vocal-ml + vocal-rvc extras…"
"$VENV/bin/pip" install -e "$SIDECAR[vocal-ml]"
"$VENV/bin/pip" install -e "$SIDECAR[vocal-rvc]"
echo "Done. Configure RVC models per ai-sidecar README. Restart: npm run sidecar"
