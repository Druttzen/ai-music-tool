# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (EBU R128 LUFS including short-term/momentary maxima, true-peak limiting, 48 kHz studio export; loudness presets −14/−16/−23 + measure-only; stereo phase / correlation)
- Preview monitor in Analyzers: A/B reference at matched LUFS, live spectrum, preview-only headphone EQ (not Atmos/DTS)
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

Tauri Studio checks the latest GitHub Release automatically after startup. **Check for updates** reports whether a newer signed `studio-v*` build exists. **Update all** (always available in Studio) refreshes:

- Installed sidecar plugins / extras (already installed stacks only — it does not download Cover/FLUX if you never installed it)
- Canvas addon, when it is already present
- Usable `.zip` archives in `{install}/data/{addons,tools,archives}`
- Then the Studio app itself, when a newer signed release exists

Packages are verified with the updater public key before installation.

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
  - **Dev / checkout:** **Install** runs `scripts/install-sidecar-*.ps1|.sh` when `ai-sidecar/.venv` exists.
  - **Packaged Studio:** **Install** bootstraps a writable venv **next to the app** (`{install}/data/sidecar`), overlays bundled `ai-sidecar` sources onto `pkg/` (never wipes a locked dir), installs the selected extra, then restarts the sidecar from that venv (not the frozen binary). Canvas, profile, extras, and tools share that same `{install}/data` folder (`profile/`, `addons/`, `tools/`, `exports/`). Requires **Python 3.10–3.12** on PATH for first-time setup. Windows generate / vocal-rvc extras may use a pip fallback when strict pins fail. If the install folder is not writable (Program Files), Studio falls back to the OS app-data directory. If Python or package sources are missing, the UI copies the `npm run sidecar:*` hint instead.

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
