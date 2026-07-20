#!/usr/bin/env bash
# Install optional vocal-ml stack (torch + scipy) for RVC/DiffSinger integrations.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
install_sidecar_extra "vocal,vocal-ml" "vocal + vocal-ml extras (torch + scipy)"
echo "For RVC: npm run sidecar:vocal-rvc (or set AIMC_RVC_API_URL)."
echo "Restart the sidecar: npm run sidecar"
