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

## Vocal Embed Studio roadmap

The app's **Vocal Embed Studio** creates a local handoff plan for adding vocals to an
existing instrumental without relying on Suno's generation engine. The first app layer exports
a JSON/brief with instrumental timing, lyrics, Voice Character traits, and mix targets.

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
| `GET /health` | Liveness; includes `stems_available`, `genre_available`, `vision_available` |
| `POST /analyze` | Librosa tempo/key/spectral/percussive report |
| `POST /separate` | Demucs stem separation (requires `stems` extra) |
| `GET /separate/download/{job_id}/{filename}` | Download one stem WAV |
