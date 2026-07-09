#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/stop-sidecar.sh" || true
bash "$ROOT/scripts/start-sidecar.sh"
for i in $(seq 1 40); do
  curl -sf http://127.0.0.1:8723/health >/dev/null && break
  sleep 0.5
done
curl -sf http://127.0.0.1:8723/health
cd "$ROOT"
node scripts/run-e2e-subset.cjs
exit $?
