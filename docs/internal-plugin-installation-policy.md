# Internal plugins and one Windows installation (0.50.69)

## Policy

- Plugins install into Studio’s managed data root. Normal sidecar extras use the internal Python runtime; ACE-Step has an isolated runtime under `data/addons/acestep`.
- Canvas uses the internal Python renderer and a Studio WebView panel. It never installs or starts AI Canvas Tool as another application. Current internal Canvas support renders artwork to a 720 × 1280 H.264 MP4 loop, 3–8 seconds. The external Canvas application's AI-video editing features are not imported.
- External ACE-Step checkout discovery and service URLs are ignored. The internal ACE-Step process uses a private loopback port and session authentication, and closes with Studio.
- Optional external vocal APIs and arbitrary DiffSinger command launchers are disabled in the Studio host. RVC inference uses the installed internal Python package. DiffSinger and MFA executables must belong to the managed addons/tools directories; model/audio files remain user data.
- MFA, DiffSinger, Java and FFmpeg have managed Install actions. A pinned, SHA-256-verified micromamba binary installs separate conda-forge environments under `tools/{mfa,java,ffmpeg}/runtime` and `addons/diffsinger/runtime`. Package caches remain under `tools/.cache`; no shell profile or global PATH is changed. Updates refresh only explicitly installed components; deactivation preserves cached files.
- DiffSinger installs upstream v2.5.1 in `addons/diffsinger/source` with its own Python 3.10, NumPy 1.26 and PyTorch 2.2.2 baseline (CPU on Windows/Linux, native PyTorch on macOS). Voice/acoustic, variance and vocoder checkpoints are separate, user-selected assets. An installed engine is not reported as ready for singing without voice configuration and checkpoints.
- Windows embeddable Python resources are never selected by the macOS/Linux bootstrap. Those platforms create a native venv with available Python 3.10–3.12. The Windows archive download is skipped when building on another host.

## Windows installer

Windows releases publish NSIS only. A machine registration and scans of existing NSIS/MSI registration in the 32-bit and 64-bit registry views block a second installation. Normal installers, including silent installers, require explicitly uninstalling the existing copy first. Exit code: **1638**. A global installer mutex blocks concurrent installers.

The internal updater is a narrow exception: NSIS `/UPDATE` accepts only a newer version, exactly one matching machine registration, an existing Studio executable, and the same registered installation directory. A supplied different `/D` directory, same version, downgrade, missing registration or another user/machine registration is rejected. Updates preserve the application data folder and plugin activation markers.

The release executable verifies its installation directory against the registration. Copying the executable to another directory does not create an accepted installation. Developer/debug builds are exempt.

Studio downloads and verifies app packages through the Tauri updater before installation, stops its owned sidecar process, and restarts. Automatic startup updates refresh the app; **Update all** refreshes installed internal components and then checks/installs the app. These two operations share a concurrent-update guard. Update restarts do not arm the workspace reset flag.

The machine installer requires normal Windows administrator confirmation. This policy cannot retroactively modify old installers/executables. In particular 0.50.66 cannot install app updates and needs a manual migration to 0.50.69 once. Other platform packages do not enforce the Windows machine registration policy.

## Uninstall and retained data

Studio’s registered files and its installation ownership record are removed by the uninstaller. Cached plugin dependencies/checkpoints, projects, profiles and exports are preserved for reuse; they are not another registered application installation. Canvas and ACE-Step activation markers in the installation’s colocated data folder are deactivated. Externally selected `STUDIO_DATA_DIR` test profiles are preserved.

## ACE-Step provisioning

The source archive is pinned to official ACE-Step commit `ca1e85fe9430179831e6bc6be790c332190a3866`, SHA-256 `108e45dffc7eb62af98d781c4159aa63a2b7a241186734e3e065279da7fc198d`. Initial provisioning downloads dependencies/models inside Studio's data folder. Once cached, inference uses the local model files. An interrupted install does not write the plugin activation manifest.

## Shared sidecar engine validation

Before provisioning checkpoints or recording activation, shared-runtime installers import each extra's actual inference entry points in a subprocess. Finding a package or successfully completing pip is insufficient. Failed imports preserve the underlying exception and leave the addon unactivated. This check does not load models; checkpoint readiness remains a separate check.

On an NVIDIA machine, the desktop installer checks CUDA in a fresh Python process after dependency installation. If unavailable, it installs binary torch/torchaudio wheels from the exclusive CUDA index and checks again. `AIMC_FORCE_CPU=1` opts out; `AIMC_TORCH_CUDA_INDEX` overrides the default cu126 index. The development scripts also use the exclusive index so a newer CPU wheel from PyPI cannot win resolution.

The RVC fallback is not a compatibility guarantee. On the tested Windows Python 3.12.10 runtime, the normal resolver rejects rvc-python's faiss-cpu 1.7.3 pin, and the fallback's fairseq 0.12.2 fails importing `RVCInference` with a mutable dataclass default. Engine validation rejects this combination. Working RVC inference still requires a compatible engine/runtime and a configured voice checkpoint; these changes do not supply them.
