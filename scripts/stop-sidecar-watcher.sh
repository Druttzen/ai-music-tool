#!/usr/bin/env bash
# Stop the background sidecar dev watcher.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/ai-sidecar/.sidecar-watcher.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No sidecar dev watcher pid file"
  exit 0
fi

pid="$(tr -d '[:space:]' < "$PID_FILE")"
rm -f "$PID_FILE"
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
  echo "Stopped sidecar dev watcher PID $pid"
else
  echo "Sidecar dev watcher PID $pid was not running"
fi
