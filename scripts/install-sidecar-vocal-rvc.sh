#!/usr/bin/env bash
set -euo pipefail
: "${STUDIO_DATA_DIR:?Set STUDIO_DATA_DIR to Studio data folder}"
export PYTHONPATH="$(cd "$(dirname "$0")/.." && pwd)/ai-sidecar"
"$STUDIO_DATA_DIR/sidecar/.venv/bin/python" -m ai_sidecar.managed_tools install vocal-rvc
