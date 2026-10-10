#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/sidecar-venv.sh
source "$ROOT/scripts/lib/sidecar-venv.sh"
install_sidecar_extra "stems-melband" "stems-melband extra (melband-roformer-infer)"
"$SIDECAR_VENV/bin/python" -m ai_sidecar.stems_melband --download-clean-model
echo "Check GET /health for stems-melband capability / stems_melband_available: true"
echo "Clean vocals model cached. Use model_name=melband-clean on POST /separate."
