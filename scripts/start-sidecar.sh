#!/usr/bin/env bash
# Start the Python AI sidecar on http://127.0.0.1:8723
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
VENV="$SIDECAR/.venv"

PY=""
for v in python3.12 python3.11 python3.10 python3; do
  if command -v "$v" >/dev/null 2>&1; then PY="$v"; break; fi
done
if [[ -z "$PY" ]]; then echo "Need Python 3.10–3.12"; exit 1; fi

if [[ ! -d "$VENV" ]]; then
  echo "Creating venv..."
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install -e "$SIDECAR"
fi

echo "Starting AI sidecar on http://127.0.0.1:8723"
exec "$VENV/bin/uvicorn" ai_sidecar.main:app --host 127.0.0.1 --port 8723 --app-dir "$SIDECAR"
