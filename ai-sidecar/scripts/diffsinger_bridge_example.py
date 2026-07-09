#!/usr/bin/env python3
"""Example DiffSinger bridge for Vocal Embed Studio.

Point the sidecar at this script:
  set AIMC_DIFFSINGER_CMD=python ai-sidecar/scripts/diffsinger_bridge_example.py

Replace the body with your local OpenVPI DiffSinger inference call. The contract:
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

from ai_sidecar.vocal_ml import synthesize_lyrics_vocal  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--sr", type=int, default=44100)
    args = parser.parse_args()

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
    stereo, _engine = synthesize_lyrics_vocal(plan, length, args.sr)

    import soundfile as sf

    sf.write(args.out, stereo.T, args.sr, subtype="PCM_16", format="WAV")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
