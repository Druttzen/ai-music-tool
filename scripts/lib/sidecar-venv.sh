#!/usr/bin/env bash
# Shared helpers for sidecar extra installers.
# shellcheck shell=bash

# Pick python3.12 → 3.11 → 3.10 only (no bare python3 — avoids 3.13+).
sidecar_pick_python() {
  local v
  for v in python3.12 python3.11 python3.10; do
    if command -v "$v" >/dev/null 2>&1; then
      echo "$v"
      return 0
    fi
  done
  return 1
}

ensure_sidecar_venv() {
  local root sidecar venv py
  # This file: scripts/lib/sidecar-venv.sh → repo root is ../..
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  sidecar="$root/ai-sidecar"
  venv="$sidecar/.venv"

  if ! py="$(sidecar_pick_python)"; then
    echo "Need Python 3.10-3.12 (python3.12 / python3.11 / python3.10 on PATH)." >&2
    exit 1
  fi

  if [[ ! -d "$venv" ]]; then
    echo "Creating sidecar venv ($py)..."
    "$py" -m venv "$venv"
    "$venv/bin/pip" install --upgrade pip
    "$venv/bin/pip" install -e "$sidecar"
  fi

  SIDECAR_DIR="$sidecar"
  SIDECAR_PIP="$venv/bin/pip"
}

install_sidecar_extra() {
  local spec="$1"
  local label="$2"
  ensure_sidecar_venv
  echo "Installing ${label}..."
  "$SIDECAR_PIP" install -e "${SIDECAR_DIR}[${spec}]"
  echo "Done. Restart the sidecar: npm run sidecar"
}
