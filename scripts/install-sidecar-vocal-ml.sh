#!/usr/bin/env bash
# Install optional vocal-ml stack (torch + scipy) for RVC/DiffSinger integrations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="$ROOT/ai-sidecar"
VENV="$SIDECAR/.venv"

if [[ ! -d "$VENV" ]]; then
  echo "Creating sidecar venv..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install -e "$SIDECAR"
fi

echo "Installing vocal + vocal-ml extras (torch + scipy)..."
"$VENV/bin/pip" install -e "$SIDECAR[vocal,vocal-ml]"
echo "Vocal ML stack installed."
echo "Optional: pip install rvc-python (or set AIMC_RVC_API_URL)."
echo "Restart the sidecar: npm run sidecar"
