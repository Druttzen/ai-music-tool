# AI Music Sidecar

Local FastAPI service for track analysis (librosa) and optional ML capabilities (Demucs stem separation, vision analysis, MusicGen generation).

## Architecture (video-studio patterns)

| Module | Role |
|--------|------|
| `device.py` | DeviceInfo + VRAM-tier DevicePolicy (`cuda` / `mps` / `cpu`) |
| `registry.py` | CapabilitySpec catalog + install hints (drives `/health.capabilities`) |
| `jobs.py` | Single-worker JobManager |
| `stems_separate.py` / `generate_jobs.py` | Registered runners for Demucs + MusicGen |

`GET /health` still returns legacy boolean flags plus `device_info`, `capabilities`, and `policy`.

## Requirements

- **Python 3.10–3.12** (PyTorch/Demucs have no 3.13+ wheels yet)
- Base install: librosa, FastAPI, soundfile (~100 MB)
- Optional **`stems`** extra: torch + demucs (~2 GB download)
- Optional **`classify`** extra: torch + transformers (genre classifier → `genre_available`)
- Optional **`vision`** extra: torch + transformers + Pillow (BLIP caption + CLIP tags)
- Optional **`generate`** extra: torch + audiocraft (MusicGen; CC-BY-NC weights)
- Optional **`vocal` / `vocal-ml` / `vocal-rvc`** extras: scipy → torch vocal stack → RVC
- **ffmpeg** on PATH for MP3/M4A uploads (WAV works without it). Windows: `winget install Gyan.FFmpeg`
- **yt-dlp** on PATH for YouTube audio sonic analysis (`POST /youtube/sonic-signature`). Windows: `winget install yt-dlp.yt-dlp` or `pip install yt-dlp` in the sidecar venv

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
npm run sidecar:stems    # Windows PowerShell installer (or bash scripts/install-sidecar-stems.sh)
```

Restart the sidecar, then verify:

```bash
curl http://127.0.0.1:8723/health
# "stems_available": true
```

UI: load a track in **Drag & Drop Analyzers** → **Separate stems (Demucs)** → download individual WAVs.

## Optional vision stack

The browser image analyzer stays lightweight by default (pixel palette + mood mapping). The
`vision` extra enables local BLIP captioning via `POST /analyze-image`:

```bash
npm run sidecar:vision   # or: bash scripts/install-sidecar-vision.sh
curl http://127.0.0.1:8723/health
# "vision_available": true
```

Drop an image in **Drag & Drop Analyzers** — when the sidecar vision stack is installed, palette
metrics are merged with a BLIP scene caption, CLIP zero-shot visual tags, and mapped to Suno catalog tags.

## Optional genre classifier

```bash
npm run sidecar:classify
curl http://127.0.0.1:8723/health
# "genre_available": true
```

## Optional MusicGen generation

Text-to-music via Meta MusicGen (audiocraft). **Model weights are CC-BY-NC** — opt-in only, not bundled.

```bash
npm run sidecar:generate
curl http://127.0.0.1:8723/health
# "generate_available": true
```

```bash
curl -X POST http://127.0.0.1:8723/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"dark driving techno, analog bass, 128 bpm","duration_sec":10}' \
  --output musicgen-preview.wav
```

Override model: `AIMC_MUSICGEN_MODEL=facebook/musicgen-medium` (default: `facebook/musicgen-small`).

Melody conditioning (continue from a reference clip):

```bash
curl -X POST http://127.0.0.1:8723/generate/melody \
  -F "prompt=dark techno continuation, 128 bpm" \
  -F "duration_sec=10" \
  -F "melody=@reference.wav" \
  --output musicgen-melody-preview.wav
```

Alignment preview for Vocal Embed (MFA or heuristic):

```bash
curl -X POST http://127.0.0.1:8723/vocal-embed/align-preview \
  -F "plan_json=@vocal-embed-plan.json" \
  -F "guide_vocal=@guide.wav"
```

OpenVPI DiffSinger `.ds` segment export:

```bash
curl -X POST http://127.0.0.1:8723/vocal-embed/ds-export \
  -F "plan_json=@vocal-embed-plan.json"
```

## Vocal Embed Studio

The app's **Vocal Embed Studio** creates a local handoff plan for adding vocals to an
existing instrumental without relying on Suno's generation engine. The first app layer exports
a JSON/brief with instrumental timing, lyrics, Voice Character traits, and mix targets.

**Placement-mix v1** (`POST /vocal-embed/synthesize`) is available with base sidecar deps
(librosa + soundfile). It ducks the instrumental under lyric sections and overlays a guide vocal.

**Vocal DSP v1** (`npm run sidecar:vocal`) adds scipy-powered guide conversion
(pitch shift + presence EQ) and lyrics-only synthesis from section timing.

**Vocal ML models (RVC / DiffSinger)** are user-provided and configured via environment variables:

| Variable | Purpose |
|----------|---------|
| `AIMC_RVC_MODEL` | Path to an RVC `.pth` model (with optional `AIMC_RVC_INDEX`) |
| `AIMC_RVC_API_URL` | External RVC API server (e.g. `http://127.0.0.1:5050` from `python -m rvc_python api`) |
| `AIMC_DIFFSINGER_ROOT` | Path to a cloned [OpenVPI DiffSinger](https://github.com/openvpi/DiffSinger) repo |
| `AIMC_DIFFSINGER_VAR_EXP` | Variance checkpoint folder name under `checkpoints/` (pitch/duration from notes) |
| `AIMC_DIFFSINGER_ACOUSTIC_EXP` | Acoustic checkpoint folder name under `checkpoints/` |
| `AIMC_DIFFSINGER_PYTHON` | Python executable in the DiffSinger venv (defaults to sidecar Python) |
| `AIMC_DIFFSINGER_CMD` | Optional CLI bridge (`ai-sidecar/scripts/diffsinger_bridge_example.py`) |
| `AIMC_DIFFSINGER_URL` | HTTP DiffSinger service exposing `POST /synthesize` |

OpenVPI setup (one-time):

```bash
git clone https://github.com/openvpi/DiffSinger.git
cd DiffSinger
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows
# Place trained checkpoints under checkpoints/<exp_name>/
```

Copy `ai-sidecar/env.vocal.example` → `ai-sidecar/.env.vocal`, set `AIMC_DIFFSINGER_ROOT` and experiment names, then restart the sidecar. Vocal Embed plans are converted to OpenVPI `.ds` segments (section timing → `note_seq` / `note_dur`); variance inference fills phonemes and F0 before acoustic synthesis.

**Guide vocal + lyric timing (MFA hook):** when the app sends both lyrics and a guide vocal in `lyrics-to-vocal-synthesis` mode, `vocal_align.py` refines per-word `.ds` timing. Configure Montreal Forced Aligner (optional):

| Variable | Purpose |
|----------|---------|
| `AIMC_MFA_BIN` | MFA executable (default `mfa`) |
| `AIMC_MFA_MODEL` | Acoustic model name (e.g. `english_mfa`) |
| `AIMC_MFA_DICT` | Pronunciation dictionary |

Without MFA, librosa onset/energy heuristics on the guide vocal segment provide fallback word starts.

Install torch stack + optional RVC:

```bash
npm run sidecar:vocal-ml
npm run sidecar:vocal-rvc   # installs vocal-ml + rvc-python
# or everything: npm run sidecar:all
```

Engines returned by `POST /vocal-embed/synthesize`:
- `placement-mix-v1` — guide overlay only
- `guide-conversion-v1` — scipy/librosa DSP conversion
- `rvc-conversion-v1` — RVC model or API
- `lyrics-synth-v1` — DSP lyric bed
- `diffsinger-v1` — OpenVPI DiffSinger when `AIMC_DIFFSINGER_ROOT` + acoustic exp are set

Heavy sidecar options stay opt-in:

- Singing synthesis: OpenVPI DiffSinger (Apache-2.0) — integrated via `diffsinger_openvpi.py`.
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
npm run test:smoke:vocal        # Vocal Embed plan + synthesis e2e (sidecar required)
npm run test:smoke:stems        # installs stems extra + Demucs UI e2e
```

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness; includes vocal synthesis/DSP/RVC/DiffSinger flags |
| `POST /analyze` | Librosa tempo/key/spectral/percussive report |
| `POST /sonic-signature` | Chord/key/BPM fusion from uploaded audio |
| `POST /youtube/resolve` | YouTube metadata (oEmbed + optional yt-dlp title) |
| `POST /youtube/sonic-signature` | Download ≤120s audio via yt-dlp → sonic signature |
| `POST /vocal-embed/plan` | Validate Vocal Embed Studio JSON plan from the app |
| `GET /vocal-embed/models` | RVC / DiffSinger configuration status |
| `POST /vocal-embed/synthesize` | Placement-mix + optional RVC/DiffSinger engines → mixed WAV |
| `POST /analyze-image` | Optional BLIP caption + CLIP zero-shot tags (requires `vision` extra) |
| `POST /generate` | Optional MusicGen text-to-music WAV (requires `generate` extra) |
| `POST /separate` | Demucs stem separation (requires `stems` extra) |
| `GET /separate/download/{job_id}/{filename}` | Download one stem WAV |

## Optional auth token

When `AIMC_SIDECAR_TOKEN` is set, protected routes require header `X-AIMC-Sidecar-Token`. `/health` stays public. Tauri Studio sets this automatically for managed sidecars. See [SECURITY.md](../SECURITY.md).

## MCP stdio bridge

`ai_sidecar/mcp_stdio.py` exposes analyze/health tools over MCP stdio for agent integrations:

```bash
# Sidecar must be running (npm run sidecar)
python -m ai_sidecar.mcp_stdio
# With token auth:
AIMC_SIDECAR_TOKEN=your-token python -m ai_sidecar.mcp_stdio
```

Set `AIMC_SIDECAR_TOKEN` in the environment when the sidecar was started with a token.
