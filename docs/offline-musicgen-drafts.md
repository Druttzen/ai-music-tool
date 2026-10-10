# Offline drafts for Suno

The local workflow is to refine the prompt, audition a 30-second instrumental,
keep its seed when comparing prompt changes, then export the selected audio and
a Suno brief. The app does not spend Suno credits or upload audio automatically.

MusicGen defaults to the actual `facebook/musicgen-stereo-small` checkpoint.
Stereo Medium is available as an explicit larger choice. The backend honors
the requested model instead of silently downgrading Medium to Small. Two
separate guidance passes reduce peak memory. Switching checkpoints releases
the previous cached model before loading the replacement.

Melody references use `facebook/musicgen-melody` or the corresponding stereo
model. The former `musicgen-melody-small` default was not an official checkpoint.
The WAV writer now preserves the model's channels and sample rate, applies
linked peak headroom and writes PCM24. It rejects invalid and silent output.
This preserves the decoded audio; it does not invent additional bandwidth or
make the composition equivalent to a different model.

Source: [Meta MusicGen documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md).
Meta recommends 16 GB GPU memory for Medium; actual available memory and clip
length matter. CPU generation remains available but is substantially slower.

Generation records a concrete seed and sampling settings in the audio analysis
and export brief. Reproducibility is within the same model/runtime; identical
results across hardware/library versions are not guaranteed. The project style
is kept by default, so a generated take's analysis cannot silently replace the
intended direction. The user can explicitly choose to merge it.

When a first take attaches the player, its controls restore the recorded
prompt, seed, model, duration and sampling settings. Generated report labels
are excluded from subsequent prompt building; they must not recursively
become instructions such as "MusicGen preview ... MusicGen preview ...".
Generated MusicGen and ACE-Step audio is stored in the local audio cache with
its analysis before attaching the player, allowing playback and Suno export
after reload. A storage failure keeps the current result playable and warns
the user to export it before closing.

The new Suno export saves the original audio bytes alongside a text brief with
Style, Lyrics and available generation settings. It reports partial failure
if the audio saves but the brief does not. Missing audio is an error. Existing
compressed input retains its real format rather than being mislabeled WAV.

## Offline behavior

Download the selected model and dependencies once. MusicGen warmup is now opt-in
(`AIMC_MUSICGEN_WARMUP=1`); app startup does not automatically download a model.
For strict cached-only Hugging Face operation, start the installed app with
`HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`. The installed test uses these
variables after preparing the cache. This restricts model loading; it is not an
OS firewall for unrelated optional online features.

MusicGen is useful for instrumental style sketches. Code and post-processing
cannot establish equivalence to Suno v6's learned model or realistic vocals.
A comparison against a specific Suno song requires that audio reference and
listening evaluation; successful generation and signal measurements alone do
not establish musical similarity or superior quality.

## Installed GPU runtime used for verification

The isolated Windows test runtime uses embedded CPython 3.12.10 and the
official PyTorch CUDA 12.8 wheel index with matching `torch 2.7.1+cu128`,
`torchaudio 2.7.1+cu128` and `torchvision 0.22.1+cu128`; `xformers 0.0.31`,
`sympy 1.13.3` and Pillow are installed alongside AudioCraft. CUDA inference
was checked on an RTX 4070 SUPER with 12 GB VRAM. AudioCraft uses PyTorch
attention; optional xformers/Triton acceleration was not established.

This GPU dependency upgrade was applied to the isolated installed test
runtime. The application installer does not bundle these large CUDA wheels
or automatically convert an existing CPU installation to this configuration.
Install model dependencies once and check the Plugins device status before
expecting GPU generation.

Version 0.50.50 advances the package version so an existing installed runtime
refreshes its Python sources normally. Reusing 0.50.49 initially retained
older cached sources, which the physical installation check detected.
