"""Load optional ai-sidecar/.env.vocal for RVC/DiffSinger model paths."""

from __future__ import annotations

import os
from pathlib import Path

_VOCAL_ENV_KEYS = (
    "AIMC_RVC_MODEL",
    "AIMC_RVC_INDEX",
    "AIMC_RVC_MODELS_DIR",
    "AIMC_RVC_API_URL",
    "AIMC_DIFFSINGER_CMD",
    "AIMC_DIFFSINGER_URL",
    "AIMC_DIFFSINGER_MODEL_DIR",
    "AIMC_ACESTEP_API_URL",
    "AIMC_ACESTEP_API_KEY",
    "AIMC_ACESTEP_MODEL",
    "AIMC_ACESTEP_TIMEOUT_SEC",
    "AIMC_STEMS_BACKEND",
    "AIMC_MELBAND_MODEL",
)


def load_vocal_env_file(env_path: Path | None = None) -> list[str]:
    """Apply key=value pairs from ai-sidecar/.env.vocal (does not override existing env)."""
    path = env_path or Path(__file__).resolve().parents[1] / ".env.vocal"
    if not path.is_file():
        return []

    loaded: list[str] = []
    text = path.read_text(encoding="utf-8-sig")  # strip UTF-8 BOM if present
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().lstrip("\ufeff")
        value = value.strip().strip('"').strip("'")
        if key not in _VOCAL_ENV_KEYS:
            continue
        if key in os.environ and os.environ[key].strip():
            continue
        os.environ[key] = value
        loaded.append(key)
    return loaded
