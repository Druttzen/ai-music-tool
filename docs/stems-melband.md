# Mel-Band RoFormer stems

Optional higher-quality **vocals / instrumental** separation via
[`melband-roformer-infer`](https://pypi.org/project/melband-roformer-infer/)
(Kim MelBand Roformer by default). Demucs remains the default 4-stem backend.

## Install

```bash
npm run sidecar:stems          # Demucs (required for 4-stem / fallback)
npm run sidecar:stems-melband  # Mel-Band RoFormer (~1 GB checkpoint on first use)
npm run sidecar:cuda           # CUDA torch/torchaudio when NVIDIA GPU is present
```

`sidecar:stems` / `sidecar:stems-melband` (and other torch extras) auto-upgrade
CPU PyPI torch to a **CUDA** wheel when `nvidia-smi` works. Skip with
`AIMC_FORCE_CPU=1`. Override CUDA wheel index with `AIMC_TORCH_CUDA_INDEX` (default
`https://download.pytorch.org/whl/cu126`, passed as `--extra-index-url`). Or run
`npm run sidecar:cuda` alone.

First `POST /separate` with `model_name=melband` downloads the Kim checkpoint
(~870 MB) into `~/.cache/melband-roformer-infer/` (override with
`MELBAND_ROFORMER_MODELS_PATH`).

In Studio, choose **Mel-Band RoFormer** in the Analyzers stem-separation model
picker (requires `stems_melband_available` on `/health`). Mel-Band uses
`torch.cuda` when available (`device_info.backend` on `/health`).

## Use

- `POST /separate` with `model_name=melband` (or `melband-roformer-kim-vocals`)
- Or set `AIMC_STEMS_BACKEND=melband` so `/separate` defaults and
  `/vocal-transform` prefer Mel-Band when installed
- Optional: `AIMC_MELBAND_MODEL=<registry-slug>`

`/health` reports `stems_melband_available` and a `stems-melband` capability row.

## Outputs

Mel-Band produces **vocals** + **instrumental** (not drums/bass/other).
Demucs still returns four stems when `model_name=htdemucs`.
