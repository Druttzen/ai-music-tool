#!/usr/bin/env bash
# Install the optional FLUX cover (text→image) extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "cover" "cover extra (torch + diffusers + FLUX.1-schnell)"
echo "Check GET /health for cover_available: true"
