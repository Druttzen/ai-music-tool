#!/usr/bin/env bash
# Install all optional sidecar extras.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "all" "[all] extras (~multi-GB)"
# RVC is separate: rvc-python's faiss-cpu pin has no Python 3.12 wheel (see pyproject [all]).
install_sidecar_extra "vocal-rvc" "vocal-rvc (fallback-safe)"
echo "Optional RVC models still need configuration - see ai-sidecar README."
