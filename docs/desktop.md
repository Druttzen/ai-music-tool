# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (Symphonia decode for MP3/M4A/AAC/ALAC/CAF/OGG/FLAC/WAV via `dsp-bridge`; EBU R128 LUFS including short-term/momentary maxima, true-peak limiting, 48 kHz studio export; loudness presets −14/−16/−23 + measure-only; stereo phase / correlation; export WAV16/24/32-float, FLAC, MP3, AAC/M4A). ALAC/CAF attach uses native preview WAV when Web Audio cannot decode.
- Preview monitor in Analyzers: A/B reference at matched LUFS (Symphonia measure in Studio), live spectrum, preview-only headphone EQ (not Atmos/DTS)
- Managed Python **AI sidecar** spawn on demand
- Native **canvas handoff** to AI Canvas Tool for Spotify loops via `canvas-handoff-bridge.ts` — see [canvas-handoff.md](canvas-handoff.md)
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

Tauri Studio checks the latest GitHub Release automatically after startup. When a newer signed `studio-v*` build exists, Studio downloads and installs it silently (quiet Windows installer — no update popup dialogs). A bottom-center status pill shows live progress and disappears when idle.

**Check for updates** and **Update all** remain in the Project status card. Update all refreshes:

- Sidecar toolchain — re-ensure bundled embeddable CPython (stamp mismatch re-extracts), upgrade `pip` / `setuptools` / `wheel`, upgrade the base editable sidecar package, and inventory optional tools under `{install}/data/tools` (Java / FFmpeg when present; not auto-installed)
- Installed sidecar plugins / extras (already installed stacks only)
- Canvas addon, when it is already present
- Usable `.zip` archives in `{install}/data/{addons,tools,archives}`
- Then the Studio app itself, when a newer signed release exists

Packages are verified with the updater public key before installation. Addon/extra installs always target the Studio app data directory (`{install}/data` or `STUDIO_DATA_DIR`). Packaged Studio ships an embeddable CPython under `resources/python-embed` and unpacks it to `{install}/data/sidecar/runtime` — **no system Python on PATH is required**.

Closing Studio resets project and session workspaces to defaults on the next launch (presets and API credentials are kept).

The first updater-enabled release must still be installed manually because older Studio builds do not contain the updater plugin. Every later signed release can update in-app.

| Capability | Tauri Studio |
|------------|--------------|
| Updates | Signed `latest.json` + Tauri updater on `studio-v*` releases |
| Native DSP | `dsp-bridge.ts` |
| Sidecar | Managed spawn in Tauri shell |
| Canvas handoff | `exportCanvasHandoffNative` |

The desktop shell only launches Canvas. Other projects consume the neutral Music Exchange JSON and optional audio sidecar selected by the user.

### Addons install (in-app)

Left sidebar **Addons**:

- **Canvas** — Download / Install and Open work in Tauri Studio. The web UI alone cannot install Canvas.
- **Sidecar extras** (MusicGen, cover, stems, vision, …) —
  - **Dev / checkout:** **Install** prefers `{STUDIO_DATA}/sidecar/runtime` (bundled embeddable CPython after `npm run fetch:python-embed`) or falls back to `ai-sidecar/.venv` via system Python.
  - **Packaged Studio:** **Install** unpacks **bundled embeddable CPython** into `{install}/data/sidecar/runtime` (no Windows `py` launcher / PATH Python), overlays bundled `ai-sidecar` sources onto `pkg/`, installs the selected extra with pip, then restarts the sidecar from that runtime. Canvas, profile, extras, tools, and user exports share `{install}/data` (`profile/`, `addons/canvas/`, `tools/`, `archives/`, `exports/`, `sidecar/runtime|cache|tmp`). Hugging Face, Torch, pip, Mel-Band, and sidecar job temps stay under `sidecar/cache` + `sidecar/tmp`. Studio product downloads write into `exports/`. Helper probes and pip use `CREATE_NO_WINDOW` so no console flashes. If `{install}/data` is not writable (Program Files), Studio falls back to the OS app-data directory under `com.djmad.aimusiccreator.studio` — still this app, never another product's Python. If the embed zip or package sources are missing, the UI copies the `npm run sidecar:*` hint instead.

**Exception:** the signed Studio app updater / NSIS installer still uses OS install paths (Programs / current-user install). Model roots set explicitly via `AIMC_*` env vars remain user-controlled.

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
