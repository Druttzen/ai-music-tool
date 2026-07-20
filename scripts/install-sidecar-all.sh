#!/usr/bin/env bash
# Install all optional sidecar extras.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "all" "[all] extras (~multi-GB)"
echo "Optional RVC models still need configuration — see ai-sidecar README."
