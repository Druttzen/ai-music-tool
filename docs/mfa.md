# Montreal Forced Aligner (MFA) for Vocal Embed

Studio can time guide-vocal words for DiffSinger / OpenVPI `.ds` export using
[Montreal Forced Aligner](https://montreal-forced-aligner.readthedocs.io/) when
configured. Otherwise alignment uses a **librosa onset heuristic**.

MFA is **not** a pip extra of `ai-sidecar` — install MFA separately (conda or
pip) so the `mfa` binary is on `PATH`.

## Setup

1. Install MFA and download an acoustic model + dictionary (e.g. `english_mfa`).
2. Copy `ai-sidecar/env.vocal.example` → `ai-sidecar/.env.vocal` and set:

   ```bash
   AIMC_MFA_BIN=mfa
   AIMC_MFA_MODEL=english_mfa
   AIMC_MFA_DICT=english_mfa
   ```

3. Restart the sidecar (`npm run sidecar`).

## Status in Studio

Vocal Embed Studio shows an MFA badge:

| Badge | Meaning |
|-------|---------|
| **ready** | Env set **and** `mfa` (or `AIMC_MFA_BIN`) found on PATH |
| **env only** | MODEL+DICT set but binary missing |
| **heuristic** | MFA not configured — librosa fallback |

Align preview reports the **actual** method used (`mfa` vs `heuristic`). If the
badge is ready/env-only but preview says heuristic, MFA ran and failed — check
model/dict names and MFA logs.

## API

`POST /vocal-embed/align-preview` returns `align_method`, `mfa_configured`,
`mfa_ready`, `word_count`, and timed `sections`.

Vocal model status (`align.mfa_configured` / `align.mfa_ready`) is on the vocal
models endpoint used by Vocal Embed Studio.
