#!/usr/bin/env bash
# Installs Path B native toolchains (Rust + Tauri CLI) and verifies a compatible
# Python (3.10-3.12) for the AI sidecar on macOS / Linux. Idempotent.
set -euo pipefail

step() { printf '\n=== %s ===\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

# --- Rust -------------------------------------------------------------------
step "Rust toolchain"
if ! have cargo; then
  echo "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
else
  echo "cargo already installed: $(cargo --version)"
fi
have rustup && rustup default stable >/dev/null || true

# --- Linux: Tauri system deps ----------------------------------------------
if [[ "$(uname -s)" == "Linux" ]] && have apt-get; then
  step "Tauri system libraries (Debian/Ubuntu)"
  sudo apt-get update -y
  sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
fi

# --- Tauri CLI --------------------------------------------------------------
step "Tauri CLI"
if have cargo && ! have cargo-tauri; then
  cargo install tauri-cli --version "^2.0" --locked
else
  echo "tauri-cli present or cargo missing."
fi

# --- Python -----------------------------------------------------------------
step "Python (AI sidecar: needs 3.10-3.12)"
compatible=""
for v in 3.12 3.11 3.10; do
  if have "python$v"; then compatible="python$v"; break; fi
done
if [[ -n "$compatible" ]]; then
  echo "Compatible Python found: $compatible"
elif have brew; then
  echo "Installing python@3.12 via Homebrew..."
  brew install python@3.12
elif have apt-get; then
  echo "Installing python3.12 via apt..."
  sudo apt-get install -y python3.12 python3.12-venv || \
    echo "python3.12 not in apt; install via deadsnakes PPA or pyenv."
else
  echo "Install Python 3.10-3.12 manually."
fi

step "Summary"
have cargo && echo "cargo:       $(cargo --version)" || echo "cargo:       MISSING (open new shell)"
have cargo-tauri && echo "cargo-tauri: $(cargo tauri --version)" || echo "cargo-tauri: MISSING"
echo "python:      ${compatible:-check 'ls /usr/bin/python3*'}"
echo "Done. If cargo was just installed, run: source \$HOME/.cargo/env"
