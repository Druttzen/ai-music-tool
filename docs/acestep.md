# ACE-Step 1.5 bridge

The Studio sidecar can generate **full songs** through a locally running
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) API server. ACE-Step
is **not** installed into `ai-sidecar/.venv` (it needs Python 3.11–3.12 and its
own model runtime). Point the sidecar at the API instead — same pattern as
`AIMC_RVC_API_URL`.

## Setup

From this repo (preferred):

```bash
npm run sidecar:acestep
# alias: npm run sidecar:acest
```

That writes `AIMC_ACESTEP_API_URL` into `ai-sidecar/.env.vocal` (and Studio
`data/sidecar/pkg/.env.vocal` when present) and starts the ACE-Step API if a
checkout is found. Discovery checks `AIMC_ACESTEP_HOME`, `ACESTEP_HOME`, a
sibling checkout, the user home, then local fixed Windows drives.

Manual alternative:

1. Install and start ACE-Step’s API (from their repo / portable package):

   ```bash
   uv run acestep-api
   # default: http://127.0.0.1:8001
   ```

2. Configure the music sidecar (process environment, `ai-sidecar/.env.vocal`,
   or the installed app's `{STUDIO_DATA_DIR}/sidecar/pkg/.env.vocal`):

   ```bash
   AIMC_ACESTEP_API_URL=http://127.0.0.1:8001
   # AIMC_ACESTEP_API_KEY=...          # only if ACESTEP_API_KEY is set on ACE-Step
   # AIMC_ACESTEP_MODEL=acestep-v15-turbo
   # AIMC_ACESTEP_TIMEOUT_SEC=600
   ```

   When Studio autostarts the ACE API from a checkout, it sets
   `ACESTEP_CONFIG_PATH` to the requested DiT (`acestep-v15-turbo`,
   `acestep-v15-sft` or `acestep-v15-base` when installed) and
   `ACESTEP_ON_DEMAND_MODEL_LOAD=true` so a later quality switch can load
   another `acestep-v15-*` id. Only one DiT is kept in memory (consumer GPUs).
   If `checkpoints/acestep-v15-base` is missing, the UI disables Quality. If an
   already-running server has a different model, Studio reports the mismatch
   and leaves that process untouched. When Studio starts its own API, output
   is recorded in `acestep-api.log` in the checkout. `GET /acestep/presets`
   reports local checkpoint availability.

   Availability requires `config.json` plus a nonempty `model.safetensors`, or
   all shards named by `model.safetensors.index.json`. A download-created folder
   alone is not sufficient. An explicit missing SFT selection fails clearly.

   For the detail preset, download the official checkpoint once from the ACE
   checkout: `python -m acestep.model_downloader --model acestep-v15-sft --skip-main`.
   Select **Detail (SFT · 50 steps)** in Studio. Prompt guidance is configurable
   from 0 to 20, default 7. Turbo remains an 8-step alternative; Base is labelled
   for editing/training. SFT is not guaranteed to sound cleaner than Turbo.
   See [offline engine research](suno-engine-research-2026-10-10.md).

3. Restart the sidecar (`npm run sidecar`). `/health` shows
   `acestep_available: true` only when the ACE-Step API at
   `AIMC_ACESTEP_API_URL` is reachable (URL alone is not enough).

In Studio, ACE-Step controls show numbered setup steps, **Copy env snippet**, and a
link to this doc when the API is unreachable. The **Local cover / remix** panel
(Analyzers) prefers ACE-Step for full-song covers from reverse track DNA — see
`docs/local-cover-remix.md`.

## API

`POST /generate/song` (JSON):

| Field | Notes |
|-------|--------|
| `prompt` | Required style / caption |
| `lyrics` | Optional structured lyrics |
| `duration_sec` | 10–600 (clamped) |
| `bpm`, `key_scale`, `vocal_language` | Optional metadata |
| `thinking` | Default `true` (ACE-Step LM planning) |
| `model` | Requested installed DiT; confirmed against the running API |
| `seed` | Explicit integer seed for reproducible trials |
| `inference_steps` | Normally 8 for Turbo, 50 for SFT/Base |
| `guidance_scale` | Prompt guidance, 0–20; relevant to SFT/Base |
| `audio_format` | `wav` (default), `mp3`, `flac`, `aac`/`m4a`, `opus`, `wav32` |

Returns the audio file with `X-AceStep-Model` / `X-AceStep-Duration-Sec` headers.

## License

ACE-Step 1.5 weights are **MIT**. Prefer them over MusicGen (`generate` extra,
CC-BY-NC) when you need commercial-friendly local full songs.
