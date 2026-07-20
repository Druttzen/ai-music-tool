#!/usr/bin/env bash
# Install the optional Demucs stems extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "stems" "stems extra (torch + demucs)"
echo "Check GET /health for stems_available: true"
