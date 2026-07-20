#!/usr/bin/env bash
# Install the optional MusicGen generate extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "generate" "generate extra (torch + audiocraft)"
echo "Check GET /health for generate_available: true"
