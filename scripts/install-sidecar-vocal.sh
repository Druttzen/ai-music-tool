#!/usr/bin/env bash
# Install the optional vocal DSP extra (scipy) into the sidecar venv.
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

echo "Installing vocal extra (scipy)..."
"$VENV/bin/pip" install -e "$SIDECAR[vocal]"
echo "Vocal extra installed. Restart the sidecar and check GET /health for vocal_ml_available."
