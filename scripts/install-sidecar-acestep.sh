#!/usr/bin/env bash
# Configure + start the external ACE-Step API (not a pip extra).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${AIMC_ACESTEP_API_URL:-http://127.0.0.1:8001}"
API_URL="${API_URL%/}"
PORT=8001
if [[ "$API_URL" =~ :([0-9]+)$ ]]; then PORT="${BASH_REMATCH[1]}"; fi

resolve_home() {
  for candidate in "${AIMC_ACESTEP_HOME:-}" "${ACESTEP_HOME:-}" "$ROOT/../ACE-Step-1.5" "$ROOT/ACE-Step-1.5" "/f/ACE-Step-1.5"; do
    [[ -z "$candidate" ]] && continue
    if [[ -f "$candidate/pyproject.toml" || -f "$candidate/start_api_server.sh" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done
  return 1
}

write_env() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]]; then
    grep -v '^[[:space:]]*AIMC_ACESTEP_API_URL=' "$path" >"${path}.tmp" || true
    mv "${path}.tmp" "$path"
  else
    : >"$path"
  fi
  echo "AIMC_ACESTEP_API_URL=$API_URL" >>"$path"
  echo "Wrote $path"
}

write_env "$ROOT/ai-sidecar/.env.vocal"
if [[ -n "${STUDIO_DATA_DIR:-}" ]]; then
  write_env "$STUDIO_DATA_DIR/sidecar/pkg/.env.vocal"
  write_env "$STUDIO_DATA_DIR/sidecar/.env.vocal"
fi

if curl -fsS --max-time 2 "$API_URL/docs" >/dev/null 2>&1 || curl -fsS --max-time 2 "$API_URL/openapi.json" >/dev/null 2>&1; then
  echo "ACE-Step API already reachable at $API_URL"
  echo "Restart Studio / sidecar so /health picks up AIMC_ACESTEP_API_URL."
  exit 0
fi

HOME_DIR="$(resolve_home || true)"
if [[ -z "${HOME_DIR:-}" ]]; then
  echo "ACE-Step checkout not found. Set AIMC_ACESTEP_HOME and re-run."
  echo "Docs: docs/acestep.md"
  exit 1
fi

echo "Starting ACE-Step API from $HOME_DIR ..."
mkdir -p "$HOME_DIR/gradio_outputs"
OUT="$HOME_DIR/gradio_outputs/aimc-acestep-api.out.log"
ERR="$HOME_DIR/gradio_outputs/aimc-acestep-api.err.log"
(
  cd "$HOME_DIR"
  if command -v uv >/dev/null 2>&1; then
    nohup uv run --no-sync acestep-api --host 127.0.0.1 --port "$PORT" >"$OUT" 2>"$ERR" &
  elif [[ -x "$HOME_DIR/.venv/bin/python" ]]; then
    nohup "$HOME_DIR/.venv/bin/python" -m uvicorn acestep.api_server:app --host 127.0.0.1 --port "$PORT" --workers 1 >"$OUT" 2>"$ERR" &
  else
    echo "Need uv or .venv to start ACE-Step."
    exit 1
  fi
)

for _ in $(seq 1 90); do
  sleep 2
  if curl -fsS --max-time 2 "$API_URL/docs" >/dev/null 2>&1 || curl -fsS --max-time 2 "$API_URL/openapi.json" >/dev/null 2>&1; then
    echo "ACE-Step API ready at $API_URL"
    echo "Restart Studio / sidecar so /health shows acestep_available=true."
    exit 0
  fi
done
echo "ACE-Step API did not become ready at $API_URL"
tail -n 30 "$ERR" || true
exit 1
