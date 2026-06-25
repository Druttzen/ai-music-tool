#!/usr/bin/env bash
# Ensure sidecar dev watcher is running, then run a dev command.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
WATCHER_PID="$SIDECAR/.sidecar-watcher.pid"
WATCHER="$ROOT/scripts/sidecar-dev-watcher.sh"
MODE="${1:-dev}"

start_watcher() {
  if [[ -f "$WATCHER_PID" ]]; then
    local old
    old="$(tr -d '[:space:]' < "$WATCHER_PID")"
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      echo "Sidecar dev watcher already running (PID $old)"
      return
    fi
  fi
  chmod +x "$WATCHER"
  nohup "$WATCHER" >"$SIDECAR/.sidecar-watcher.log" 2>&1 &
  echo $! >"$WATCHER_PID"
  echo "Started sidecar dev watcher (PID $(cat "$WATCHER_PID"))"
}

start_watcher

case "$MODE" in
  watch) exit 0 ;;
  tauri)
    export PATH="$HOME/.cargo/bin:$PATH"
    cd "$ROOT/src-tauri"
    exec cargo tauri dev
    ;;
  debug)
    cd "$ROOT"
    export NODE_OPTIONS=""
    exec npx next dev --inspect=9241
    ;;
  *)
    cd "$ROOT"
    export NODE_OPTIONS=""
    exec npx next dev
    ;;
esac
