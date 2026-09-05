#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/sidecar-venv.sh
source "$ROOT/scripts/lib/sidecar-venv.sh"
install_sidecar_extra "$ROOT" "stems-melband" "stems-melband extra (melband-roformer-infer)"
echo "Check GET /health for stems-melband capability / stems_melband_available: true"
echo "Use model_name=melband on POST /separate, or AIMC_STEMS_BACKEND=melband"
