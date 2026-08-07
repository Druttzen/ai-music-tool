#!/usr/bin/env bash
# Install the optional FLUX cover-ref (img2img) extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "cover-ref" "cover-ref extra (torch + diffusers + FLUX img2img)"
echo "Check GET /health for cover_ref_available: true"
