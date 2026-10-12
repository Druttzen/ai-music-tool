# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (Symphonia decode for MP3/M4A/AAC/ALAC/CAF/OGG/FLAC/WAV via `dsp-bridge`; EBU R128 LUFS including short-term/momentary maxima, true-peak limiting, 48 kHz studio export; loudness presets −14/−16/−23 + measure-only; stereo phase / correlation; export WAV16/24/32-float, FLAC, MP3, AAC/M4A). ALAC/CAF attach uses native preview WAV when Web Audio cannot decode.
- Preview monitor in Analyzers: A/B reference at matched LUFS (Symphonia measure in Studio), live spectrum, preview-only headphone EQ (not Atmos/DTS)
- Managed Python **AI sidecar** spawn on demand
- Internal **Canvas plugin** in a Studio WebView panel, with a Python renderer for Spotify loops — see [internal plugin policy](internal-plugin-installation-policy.md)
- Portable **Music Exchange** downloads for collaboration with other AI Creator projects (no app-specific native bridge)
- Signed **Studio auto-updates** from the latest `studio-v*` GitHub Release

## Electron (retired)

The **Electron** Windows installer train (`main.js`, `v*` tags, `release.yml`) is **retired** as of **`studio-v0.50.21`**, after Studio canvas/video paths were verified on a tagged Studio install.

| Train | Tag | Status |
|-------|-----|--------|
| **Tauri Studio (canonical)** | `studio-v*` | `npm run ship:tag` |
| **Electron** | `v*` | **Retired** — no new packages; `ship:tag -- --electron` exits non-zero |

Existing Electron installs stay on their last published `v*` build. Migrate to Studio installers from [Releases](https://github.com/Druttzen/ai-music-tool/releases). Electron shell sources and packaging scripts have been removed from the repo.

### Studio updates

Starting with **0.50.69**, Tauri Studio checks the latest GitHub Release automatically after startup. When a newer signed `studio-v*` build exists, Studio downloads it, verifies the signature against the configured public key, installs it and restarts. A bottom-center status pill shows progress. Windows uses a quiet installer but its machine-wide installation can still require Windows administrator confirmation. Signature/download failures leave the installed version intact. Concurrent app/component updates are rejected.

Automatic startup updates refresh only the Studio app. They do not upgrade optional plugin dependencies on every launch. In-place update restarts keep the workspace restoration data; they do not arm the normal close/reset flag.

**Check for updates** and **Update all** remain in the Project status card. Update all refreshes:

- Sidecar toolchain — re-ensure bundled embeddable CPython (stamp mismatch re-extracts), upgrade `pip` / `setuptools` / `wheel`, upgrade the base editable sidecar package, and inventory optional tools under `{install}/data/tools` (Java / FFmpeg when present; not auto-installed)
- Installed sidecar plugins / extras (already installed stacks only)
- Canvas addon, when it is already present
- Usable `.zip` archives in `{install}/data/{addons,tools,archives}`
- Then the Studio app itself, when a newer signed release exists

Packages are verified with the updater public key before installation. Addon/extra installs always target the Studio app data directory (`{install}/data` or `STUDIO_DATA_DIR`). Windows ships embeddable CPython under `resources/python-embed` and unpacks it to `{install}/data/sidecar/runtime` — no system Python on PATH is required for Windows plugin provisioning. Other platforms use the frozen sidecar for base features; optional plugin environments require an available compatible Python installation.

Closing Studio resets project and session workspaces to defaults on the next launch (presets and API credentials are kept).

**Migration from 0.50.66:** this version checks for updates but deliberately refuses app installation. Install 0.50.69 manually once; on Windows uninstall the registered old copy before running the normal installer. The uninstaller preserves cached dependencies, models, profiles and exports. Newer signed releases can subsequently update the registered copy in place.

| Capability | Tauri Studio |
|------------|--------------|
| Updates | Signed `latest.json` + Tauri updater on `studio-v*` releases |
| Native DSP | `dsp-bridge.ts` |
| Sidecar | Managed spawn in Tauri shell |
| Canvas handoff | `exportCanvasHandoffNative` |

Canvas runs as an internal plugin in the Studio shell. Other projects consume the neutral Music Exchange JSON and optional audio sidecar selected by the user.

### Addons install (in-app)

Left sidebar **Addons**:

- On first launch, Studio checks which optional addons are missing and lets you continue. It does not download them automatically; install each addon from this panel when you need it.

- **Canvas** — Download / Install and Open work in Tauri Studio. The web UI alone cannot install Canvas.
- **Sidecar extras** (MusicGen, cover, stems, vision, …) —
  - **Dev / checkout:** **Install** prefers `{STUDIO_DATA}/sidecar/runtime` (bundled embeddable CPython after `npm run fetch:python-embed`) or falls back to `ai-sidecar/.venv` via system Python.
  - **Packaged Studio:** **Install** unpacks **bundled embeddable CPython** into `{install}/data/sidecar/runtime` (no Windows `py` launcher / PATH Python), overlays bundled `ai-sidecar` sources onto `pkg/`, installs the selected extra with pip, then restarts the sidecar from that runtime. Canvas, profile, extras, tools, and user exports share `{install}/data` (`profile/`, `addons/canvas/`, `tools/`, `archives/`, `exports/`, `sidecar/runtime|cache|tmp`). Hugging Face, Torch, pip, Mel-Band, and sidecar job temps stay under `sidecar/cache` + `sidecar/tmp`. Studio product downloads write into `exports/` unless Studio export **Choose folder** points at another directory. Helper probes and pip use `CREATE_NO_WINDOW` so no console flashes. If `{install}/data` is not writable (Program Files), Studio falls back to the OS app-data directory under `com.djmad.aimusiccreator.studio` — still this app, never another product's Python. If the embed zip or package sources are missing, the UI copies the `npm run sidecar:*` hint instead.

The signed Studio app updater uses the existing OS installation path. Windows NSIS is machine-wide and validates the ownership registration; `/UPDATE` cannot create another copy or change its location. Model roots set explicitly via `AIMC_*` env vars remain user-controlled.

## Development

```bash
# Web + sidecar (recommended for UI work)
npm run dev

# Tauri desktop
npm run tauri:dev
npm run tauri:build
```

## CI & releases

- `tauri-smoke` — Tauri build smoke on every push
- `tauri-studio-release.yml` — publishes **Tauri** studio builds on `studio-v*` tags (**only ship path**)
- `release.yml` — **retired** (fails fast if dispatched)

Release builds use native Windows x64, macOS Apple Silicon, macOS Intel and Linux x64 runners. Windows publishes NSIS, macOS 14+ publishes DMG and signed app archives, and Linux publishes AppImage, DEB and RPM. Linux updates use the matching bundle format; DEB/RPM installations can require package-manager administrator privileges. Apple signing/notarization is separate from the required Tauri update signature and is not configured by this workflow.

Publication waits for every native build and Rust test, the Windows installed-upgrade smoke, and verification of all updater signatures against `tauri.conf.json`. The release gate requires all platform entries, matching asset URLs and sizes, and signatures. It writes public download URLs to `latest.json` and uploads `SHA256SUMS.txt` before marking the release latest. A failed or partial build remains a draft. Intel-Mac sidecars constrain Numba to 0.62.1, which has compatible prebuilt llvmlite 0.45.1 wheels; this does not constrain the other platforms.

```bash
npm run ship:tag              # studio-vX.Y.Z → tauri-studio-release.yml
```

## Publish

Full path until GitHub Release: **[publish.md](publish.md)**.

```bash
npm run ship:ready -- --print    # checklist
npm run ship:ready               # gates (e2e subset)
npm run ship:tag                 # studio-v* → CI publish
```
