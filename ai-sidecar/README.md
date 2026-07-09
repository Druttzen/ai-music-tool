# AI Music Sidecar

Local FastAPI service for track analysis (librosa) and optional ML capabilities (Demucs stem separation, vision analysis, MusicGen generation).

## Requirements

- **Python 3.10–3.12** (PyTorch/Demucs have no 3.13+ wheels yet)
- Base install: librosa, FastAPI, soundfile (~100 MB)
- Optional **`stems`** extra: torch + demucs (~2 GB download)
- Optional **`vision`** extra: torch + transformers + Pillow + scikit-learn for future image caption/object analysis
- **ffmpeg** on PATH for MP3/M4A uploads (WAV works without it). Windows: `winget install Gyan.FFmpeg`

## Quick start

From the repo root:

```bash
npm run sidecar          # Windows: creates .venv if needed, starts on :8723
npm run sidecar:fg       # foreground (see logs in terminal)
npm run sidecar:stop     # stop background sidecar
```

Linux/macOS use `scripts/start-sidecar.sh` / `scripts/stop-sidecar.sh` (also used in CI).

## Demucs stem separation

Install the heavy optional stack once:

```bash
npm run sidecar:stems    # Windows (pip install -e ai-sidecar[stems])
# or: bash scripts/install-sidecar-stems.sh
```

Restart the sidecar, then verify:

```bash
curl http://127.0.0.1:8723/health
# "stems_available": true
```

UI: load a track in **Drag & Drop Analyzers** → **Separate stems (Demucs)** → download individual WAVs.

## Optional vision stack

The browser image analyzer stays lightweight by default (pixel palette + mood mapping). The
`vision` extra is reserved for local BLIP/CLIP-style captioning and object tags when a user
wants heavier offline image understanding:

```bash
pip install -e ai-sidecar[vision]
curl http://127.0.0.1:8723/health
# "vision_available": true
```

## Vocal Embed Studio

The app's **Vocal Embed Studio** creates a local handoff plan for adding vocals to an
existing instrumental without relying on Suno's generation engine. The first app layer exports
a JSON/brief with instrumental timing, lyrics, Voice Character traits, and mix targets.

**Placement-mix v1** (`POST /vocal-embed/synthesize`) is available with base sidecar deps
(librosa + soundfile). It ducks the instrumental under lyric sections and overlays a guide vocal.

**Vocal DSP v1** (`pip install -e ai-sidecar[vocal]`) adds scipy-powered guide conversion
(pitch shift + presence EQ) and lyrics-only synthesis from section timing.

**Vocal ML models (RVC / DiffSinger)** are user-provided and configured via environment variables:

| Variable | Purpose |
|----------|---------|
| `AIMC_RVC_MODEL` | Path to an RVC `.pth` model (with optional `AIMC_RVC_INDEX`) |
| `AIMC_RVC_API_URL` | External RVC API server (e.g. `http://127.0.0.1:5050` from `python -m rvc_python api`) |
| `AIMC_DIFFSINGER_CMD` | CLI bridge for OpenVPI DiffSinger (see `ai-sidecar/scripts/diffsinger_bridge_example.py`) |
| `AIMC_DIFFSINGER_URL` | HTTP DiffSinger service exposing `POST /synthesize` |
| `AIMC_DIFFSINGER_MODEL_DIR` | Model directory passed to the DiffSinger bridge |

Install torch stack:

```bash
npm run sidecar:vocal-ml
# optional in-venv RVC python package:
pip install rvc-python
```

Engines returned by `POST /vocal-embed/synthesize`:
- `placement-mix-v1` — guide overlay only
- `guide-conversion-v1` — scipy/librosa DSP conversion
- `rvc-conversion-v1` — RVC model or API
- `lyrics-synth-v1` — DSP lyric bed
- `diffsinger-v1` — DiffSinger bridge when configured

Future heavy sidecar options should stay opt-in:

- Singing synthesis: OpenVPI DiffSinger (Apache-2.0) from lyrics + MIDI/guide melody.
- Voice style conversion: RVC-style conversion for user-owned voices only.
- Alignment: Montreal Forced Aligner (MIT) when a guide vocal/transcript is available.
- Mixing: `audio-arrange` / `pedalboard` style vocal chain with ducking and LUFS target.

These model stacks are intentionally not bundled in the base sidecar because they are GPU-heavy
and may require separate voice/model rights.

## Tests

```bash
pip install -e ai-sidecar pytest httpx
pytest ai-sidecar/tests -q -m "not slow"    # default CI (mocked Demucs roundtrip)
SIDECAR_TEST_STEMS=1 pytest ai-sidecar/tests/test_stems_integration.py -q   # real Demucs (slow)
```

Playwright (from repo root):

```bash
npm run test:smoke              # librosa analyze smoke (no stems)
npm run test:smoke:stems        # installs stems extra + Demucs UI e2e
```

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness; includes vocal synthesis/DSP/RVC/DiffSinger flags |
| `POST /analyze` | Librosa tempo/key/spectral/percussive report |
| `POST /vocal-embed/plan` | Validate Vocal Embed Studio JSON plan from the app |
| `GET /vocal-embed/models` | RVC / DiffSinger configuration status |
| `POST /vocal-embed/synthesize` | Placement-mix + optional RVC/DiffSinger engines → mixed WAV |
| `POST /separate` | Demucs stem separation (requires `stems` extra) |
| `GET /separate/download/{job_id}/{filename}` | Download one stem WAV |
