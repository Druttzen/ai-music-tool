#!/usr/bin/env bash
# Upgrade sidecar venv torch/torchaudio to a CUDA build when an NVIDIA GPU is present.
set -euo pipefail
# shellcheck source=lib/sidecar-venv.sh
. "$(cd "$(dirname "$0")" && pwd)/lib/sidecar-venv.sh"
ensure_sidecar_venv
ensure_sidecar_cuda_torch --force
echo "Restart the sidecar: npm run sidecar"
echo "Check GET /health device_info.backend === cuda"
