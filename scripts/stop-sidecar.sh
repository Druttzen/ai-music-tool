#!/usr/bin/env bash
# Stop the local AI sidecar (uvicorn on port 8723).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/ai-sidecar/.sidecar.pid"
stopped=0

stop_pid() {
  local p="$1"
  local reason="$2"
  if [[ -z "$p" || "$p" -le 0 ]]; then return; fi
  if kill -0 "$p" 2>/dev/null; then
    kill "$p" 2>/dev/null || kill -9 "$p" 2>/dev/null || true
    echo "Stopped PID $p ($reason)"
    stopped=1
  fi
}

if [[ -f "$PID_FILE" ]]; then
  stop_pid "$(tr -d '[:space:]' < "$PID_FILE")" "sidecar pid file"
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  while read -r p; do
    stop_pid "$p" "port 8723"
  done < <(lsof -tiTCP:8723 -sTCP:LISTEN 2>/dev/null || true)
elif command -v fuser >/dev/null 2>&1; then
  fuser -k 8723/tcp 2>/dev/null && stopped=1 || true
fi

if [[ "$stopped" -eq 0 ]]; then
  echo "No AI sidecar process on port 8723"
fi
