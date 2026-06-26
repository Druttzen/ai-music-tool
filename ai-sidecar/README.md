# AI Music Sidecar

Local FastAPI service for track analysis (librosa) and optional ML capabilities (Demucs stem separation, MusicGen generation).

## Requirements

- **Python 3.10–3.12** (PyTorch/Demucs have no 3.13+ wheels yet)
- Base install: librosa, FastAPI, soundfile (~100 MB)
- Optional **`stems`** extra: torch + demucs (~2 GB download)

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
| `GET /health` | Liveness; includes `stems_available` |
| `POST /analyze` | Librosa tempo/key/spectral report |
| `POST /separate` | Demucs stem separation (requires `stems` extra) |
| `GET /separate/download/{job_id}/{filename}` | Download one stem WAV |
