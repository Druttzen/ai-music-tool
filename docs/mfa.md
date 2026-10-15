# Montreal Forced Aligner (MFA) for Vocal Embed

Studio can time guide-vocal words for DiffSinger / OpenVPI `.ds` export using
[Montreal Forced Aligner](https://montreal-forced-aligner.readthedocs.io/) when
configured. Otherwise alignment uses a **librosa onset heuristic**.

Install **Montreal Forced Aligner** from Studio's Plugins panel. Studio uses a
SHA-256-verified micromamba binary and an isolated conda-forge environment under
`<Studio data>/tools/mfa/runtime`. It installs MFA 3.3.9 and the `english_mfa`
acoustic model and dictionary. Models and MFA's working data stay under
`<Studio data>/tools/mfa/models`; no global conda, PATH edit or separate installer
is required. The plugin is activated only after both models pass inspection.

The managed environment is used through `micromamba run`, including on Windows
where the DLL search path needs activation. Disabling the plugin preserves the
downloaded files and removes its activation marker.

## Setup

For an unmanaged development checkout, the previous environment configuration
still works. Packaged Studio restricts external tool paths to its managed data
folder. The following is for development, not the managed installation above:

1. Install MFA and download an acoustic model + dictionary (e.g. `english_mfa`).
2. Set:

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
| **ready** | Managed MFA installed and activated, or development env set with a discoverable MFA executable |
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
