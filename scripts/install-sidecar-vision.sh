#!/usr/bin/env bash
# Install the optional vision (caption/CLIP) extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "vision" "vision extra (torch + transformers + pillow)"
echo "Check GET /health for vision_available: true"
