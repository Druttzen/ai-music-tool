# ACE-Step 1.5 bridge

The Studio sidecar can generate **full songs** through a locally running
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) API server. ACE-Step
is **not** installed into `ai-sidecar/.venv` (it needs Python 3.11–3.12 and its
own model runtime). Point the sidecar at the API instead — same pattern as
`AIMC_RVC_API_URL`.

## Setup

1. Install and start ACE-Step’s API (from their repo / portable package):

   ```bash
   uv run acestep-api
   # default: http://127.0.0.1:8001
   ```

2. Configure the music sidecar (env or `ai-sidecar/.env.vocal`):

   ```bash
   AIMC_ACESTEP_API_URL=http://127.0.0.1:8001
   # AIMC_ACESTEP_API_KEY=...          # only if ACESTEP_API_KEY is set on ACE-Step
   # AIMC_ACESTEP_MODEL=acestep-v15-turbo
   # AIMC_ACESTEP_TIMEOUT_SEC=600
   ```

3. Restart the sidecar (`npm run sidecar`). `/health` should show
   `acestep_available: true` and an `acestep` capability row.

## API

`POST /generate/song` (JSON):

| Field | Notes |
|-------|--------|
| `prompt` | Required style / caption |
| `lyrics` | Optional structured lyrics |
| `duration_sec` | 10–600 (clamped) |
| `bpm`, `key_scale`, `vocal_language` | Optional metadata |
| `thinking` | Default `true` (ACE-Step LM planning) |
| `audio_format` | `wav` (default), `mp3`, `flac` |

Returns the audio file with `X-AceStep-Model` / `X-AceStep-Duration-Sec` headers.

## License

ACE-Step 1.5 weights are **MIT**. Prefer them over MusicGen (`generate` extra,
CC-BY-NC) when you need commercial-friendly local full songs.
