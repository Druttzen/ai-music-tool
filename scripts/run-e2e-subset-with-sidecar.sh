#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/stop-sidecar.sh" || true
bash "$ROOT/scripts/start-sidecar.sh"
# Cold /health can take several seconds when optional ML extras import torch stacks.
ok=0
for i in $(seq 1 60); do
  if curl -sf --max-time 30 http://127.0.0.1:8723/health >/dev/null; then
    ok=1
    break
  fi
  sleep 0.5
done
if [[ "$ok" -ne 1 ]]; then
  echo "Sidecar /health did not become ready" >&2
  exit 1
fi
cd "$ROOT"
node scripts/run-e2e-subset.cjs
exit $?
