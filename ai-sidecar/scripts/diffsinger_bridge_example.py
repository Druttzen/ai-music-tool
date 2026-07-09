#!/usr/bin/env python3
"""OpenVPI DiffSinger CLI bridge for Vocal Embed Studio.

Point the sidecar at this script when you prefer AIMC_DIFFSINGER_CMD over AIMC_DIFFSINGER_ROOT:
  set AIMC_DIFFSINGER_CMD=python ai-sidecar/scripts/diffsinger_bridge_example.py

Requires OpenVPI DiffSinger (see ai-sidecar/README.md):
  AIMC_DIFFSINGER_ROOT=C:\\models\\DiffSinger
  AIMC_DIFFSINGER_VAR_EXP=my_variance_ckpt
  AIMC_DIFFSINGER_ACOUSTIC_EXP=my_acoustic_ckpt

Contract:
  --plan plan.json   Vocal embed payload (sections, lyrics, bpm, key, voice_style)
  --out out.wav      Output vocal WAV path to create
  --sr 44100         Target sample rate
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai_sidecar.diffsinger_openvpi import openvpi_configured, synthesize_with_openvpi  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--sr", type=int, default=44100)
    args = parser.parse_args()

    if not openvpi_configured():
        print(
            "OpenVPI DiffSinger is not configured. Set AIMC_DIFFSINGER_ROOT and "
            "AIMC_DIFFSINGER_ACOUSTIC_EXP (and usually AIMC_DIFFSINGER_VAR_EXP).",
            file=sys.stderr,
        )
        return 1

    payload = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    plan = {
        "bpm": payload.get("bpm"),
        "key": payload.get("key"),
        "lyrics": payload.get("lyrics"),
        "voiceStyle": payload.get("voice_style"),
        "sections": payload.get("sections") or [],
        "mixPlan": payload.get("mix_plan") or {},
    }
    length = int(payload.get("length_samples") or args.sr * 2)
    stereo = synthesize_with_openvpi(plan, length, args.sr)

    import soundfile as sf

    sf.write(args.out, stereo.T, args.sr, subtype="PCM_16", format="WAV")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
