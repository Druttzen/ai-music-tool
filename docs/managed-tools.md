# Managed native tools

Plugins has Install actions for MFA, DiffSinger, Java and FFmpeg. Installation is optional; Update all refreshes components already installed. Deactivation keeps downloaded files for reuse.

All four installers use Studio's resolved data folder (`STUDIO_DATA_DIR`). An installed Windows application in Program Files uses its writable AppData folder; portable/development installations and other platforms follow `app_layout.rs`. This change does not relocate existing user data or put writable runtimes inside protected application bundles.

| Component | Location beneath the data folder | Installed baseline |
| --- | --- | --- |
| MFA | `tools/mfa/runtime`, models in `tools/mfa/models` | MFA 3.3.9, Python 3.11, English MFA acoustic model and dictionary |
| Java | `tools/java/runtime` | OpenJDK 17 |
| FFmpeg | `tools/ffmpeg/runtime` | FFmpeg 7.1 series and ffprobe |
| DiffSinger | `addons/diffsinger/runtime` and `addons/diffsinger/source` | Upstream v2.5.1, Python 3.10, NumPy 1.26.4, Torch 2.2.2 |

The installer selects native assets for Windows x64, Linux x64, macOS Intel and macOS Apple Silicon. Unsupported architectures fail explicitly. macOS/Linux never select the Windows embeddable Python archive; provisioning the base sidecar there still requires an available Python 3.10–3.12.

A pinned and SHA-256-verified [micromamba](https://github.com/mamba-org/micromamba-releases/releases/tag/2.9.0-0) creates isolated conda-forge environments. Shared package caches live in `tools/.cache`, and temporary files in `sidecar/tmp`. It does not initialize a shell or modify global PATH. Studio activates the tools in its own process when starting the sidecar. Installations are recorded as successful only after local executable checks and real runtime probes.

## DiffSinger voice configuration

The engine install does not include a singing voice. Obtain compatible acoustic, optional variance, and vocoder checkpoints under their respective licenses; place them inside `addons/diffsinger/source`. Follow the [pinned upstream release's inference instructions](https://github.com/openvpi/DiffSinger/tree/v2.5.1) for the checkpoint directories and configuration. The acoustic configuration's `vocoder_ckpt` must point to an existing file within that source folder.

Set experiment names in `addons/diffsinger/voice.json`, then restart the sidecar:

```json
{
  "acoustic_exp": "my_acoustic_voice",
  "variance_exp": "my_variance_voice"
}
```

Names refer to folders under `source/checkpoints`; leave `variance_exp` empty when no variance model is used. Studio reports the engine installed separately from voice readiness. Empty experiment folders or a missing vocoder cannot report synthesis ready. Installation preserves existing checkpoints and `voice.json`.

The installer checks the real inference imports and both acoustic/variance command entry points. Windows/Linux use CPU PyTorch to avoid assuming a particular GPU; macOS uses the native PyTorch wheel. This is an engine compatibility check, not a completed singing synthesis test with a voice.

## Verification

The `Managed platform tools` workflow installs all four tools on Windows, Linux and both macOS architectures. It exercises FFmpeg audio generation and ffprobe inspection, compiles/runs a Java source program, downloads and inspects MFA models, and imports the DiffSinger inference engine. See the specific workflow run for each platform's result; a declared matrix alone is not evidence of a successful installation.

For an explicitly selected, isolated `STUDIO_DATA_DIR`, `scripts/verify-managed-tools.py` repeats the media/Java and activation checks after installation. No user recording or personal project is required.
