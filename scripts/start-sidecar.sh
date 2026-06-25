#!/usr/bin/env bash
# Start the Python AI sidecar on http://127.0.0.1:8723 (background by default).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
VENV="$SIDECAR/.venv"
PID_FILE="$SIDECAR/.sidecar.pid"
LOG_FILE="$SIDECAR/.sidecar.log"
FOREGROUND=0
IDLE_EXIT_SEC=300

while [[ $# -gt 0 ]]; do
  case "$1" in
    --foreground|-f) FOREGROUND=1; shift ;;
    --idle-exit-sec) IDLE_EXIT_SEC="${2:-300}"; shift 2 ;;
    *) shift ;;
  esac
done

export SIDECAR_IDLE_EXIT_SEC="$IDLE_EXIT_SEC"

PY=""
for v in python3.12 python3.11 python3.10 python3; do
  if command -v "$v" >/dev/null 2>&1; then PY="$v"; break; fi
done
if [[ -z "$PY" ]]; then echo "Need Python 3.10-3.12"; exit 1; fi

if [[ ! -d "$VENV" ]]; then
  echo "Creating venv..."
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install -e "$SIDECAR"
fi

if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:8723 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "AI sidecar already running on http://127.0.0.1:8723"
  exit 0
fi

UVICORN=("$VENV/bin/uvicorn" ai_sidecar.main:app --host 127.0.0.1 --port 8723 --app-dir "$SIDECAR")

if [[ "$FOREGROUND" -eq 1 ]]; then
  echo "Starting AI sidecar (foreground) on http://127.0.0.1:8723"
  exec "${UVICORN[@]}"
fi

echo "Starting AI sidecar (background) on http://127.0.0.1:8723"
nohup "${UVICORN[@]}" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "AI sidecar PID $(cat "$PID_FILE") (log: $LOG_FILE)"
sleep 0.6
if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "AI sidecar exited immediately - check $LOG_FILE" >&2
  rm -f "$PID_FILE"
  exit 1
fi
echo "Ready at http://127.0.0.1:8723"
