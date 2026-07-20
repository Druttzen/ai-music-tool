#!/usr/bin/env bash
# Install the optional genre classify extra into the sidecar venv.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "classify" "classify extra (torch + transformers)"
echo "Check GET /health for genre_available: true"
