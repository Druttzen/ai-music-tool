#!/usr/bin/env bash
# Install optional vocal DSP extra (scipy).
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "vocal" "vocal extra (scipy)"
echo "Check GET /health for vocal_ml_available: true (scipy DSP flag)"
