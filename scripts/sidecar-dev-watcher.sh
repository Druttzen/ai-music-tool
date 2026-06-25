#!/usr/bin/env bash
# Background watcher: keep sidecar alive while dev tools run; stop after they exit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
POLL_SEC="${POLL_SEC:-15}"
STOP_AFTER_DEV_SEC="${STOP_AFTER_DEV_SEC:-90}"
STOP_TICKS=$(( (STOP_AFTER_DEV_SEC + POLL_SEC - 1) / POLL_SEC ))
inactive=0

dev_active() {
  if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  pgrep -fl "next dev|electron.*${ROOT}|ai-music-studio|tauri dev" 2>/dev/null | grep -q . && return 0
  return 1
}

sidecar_up() {
  if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:8723 -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  "$ROOT/scripts/start-sidecar.sh" >/dev/null 2>&1 || true
  sleep 1
  command -v lsof >/dev/null 2>&1 && lsof -tiTCP:8723 -sTCP:LISTEN >/dev/null 2>&1
}

ping_dev_session() {
  curl -sf -X POST "http://127.0.0.1:8723/dev-session/ping" >/dev/null 2>&1 || true
}

echo "Sidecar dev watcher started (poll ${POLL_SEC}s, stop ${STOP_AFTER_DEV_SEC}s after dev exits)"
while true; do
  if dev_active; then
    inactive=0
    if sidecar_up; then
      ping_dev_session
    fi
  else
    inactive=$((inactive + 1))
    if [[ "$inactive" -ge "$STOP_TICKS" ]]; then
      "$ROOT/scripts/stop-sidecar.sh" >/dev/null 2>&1 || true
      inactive=0
    fi
  fi
  sleep "$POLL_SEC"
done
