#!/usr/bin/env bash
# Install the optional RVC vocal-rvc extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "vocal-ml" "vocal-ml extra (torch)"
install_sidecar_extra "vocal-rvc" "vocal-rvc extra (rvc-python)"
echo "Place RVC models per ai-sidecar README; check GET /health for vocal_rvc_available."
