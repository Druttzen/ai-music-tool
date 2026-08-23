# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path going forward. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (EBU R128 LUFS, encoded-audio loudness, studio export)
- Managed Python **AI sidecar** spawn on demand
- Native **canvas handoff** to AI Canvas Tool for Spotify loops via `canvas-handoff-bridge.ts` — see [canvas-handoff.md](canvas-handoff.md)
- Portable **Music Exchange** downloads for collaboration with other AI Creator projects (no app-specific native bridge)
- Signed **Studio auto-updates** from the latest `studio-v*` GitHub Release

## Legacy: Electron

The **Electron** installer (`npm run dist`, `main.js`) remains for existing installs but is **deprecated**. Do not start new desktop features on Electron IPC.

**Sunset timeline (updated for v0.50.2+):**

| Train | Tag | Status |
|-------|-----|--------|
| **Tauri Studio (canonical)** | `studio-v*` | Default `npm run ship:tag` |
| **Electron (legacy)** | `v*` | Opt-in only: `npm run ship:tag -- --electron` or `workflow_dispatch` on `release.yml` |

Last dual-tag default ship was **v0.50.2**. From the next release onward, `ship:tag` pushes **studio only** unless `--electron` is passed. Electron auto-update users should migrate to Studio installers; maintenance Electron builds remain via `npm run dist` / manual workflow.

### Studio updates

Tauri Studio checks the latest GitHub Release automatically after startup. When a newer signed `studio-v*` build exists, the header offers **Download and restart**. Packages are verified with the updater public key before installation.

The first updater-enabled release must still be installed manually because older Studio builds do not contain the updater plugin. Every later signed release can update in-app.

| Capability | Tauri Studio (primary) | Electron (legacy / maintenance-only) |
|------------|------------------------|--------------------------------------|
| Updates | Signed `latest.json` + Tauri updater on `studio-v*` releases | `electron-updater` on `v*` releases |
| Native DSP | `dsp-bridge.ts` | Browser / lamejs only |
| Sidecar | Managed spawn in Tauri shell | Manual `npm run sidecar` |
| Canvas handoff | `exportCanvasHandoffNative` | `window.electronAPI.openInCanvasTool` |

The desktop shell only launches Canvas. Other projects consume the neutral Music Exchange JSON and optional audio sidecar selected by the user.

### Addons install (in-app)

Left sidebar **Addons**:

- **Canvas** — Download / Install and Open work in Tauri Studio (and legacy Electron). The web UI alone cannot install Canvas.
- **Sidecar extras** (MusicGen, cover, stems, vision, …) —
  - **Dev / checkout:** **Install** runs `scripts/install-sidecar-*.ps1|.sh` when `ai-sidecar/.venv` exists.
  - **Packaged Studio:** **Install** bootstraps a writable venv **next to the app** (`{install}/data/sidecar`), overlays bundled `ai-sidecar` sources onto `pkg/` (never wipes a locked dir), installs the selected extra, then restarts the sidecar from that venv (not the frozen binary). Canvas, profile, extras, and tools share that same `{install}/data` folder (`profile/`, `addons/`, `tools/`, `exports/`). Requires **Python 3.10–3.12** on PATH for first-time setup. Windows generate / vocal-rvc extras may use a pip fallback when strict pins fail. If the install folder is not writable (Program Files), Studio falls back to the OS app-data directory. If Python or package sources are missing, the UI copies the `npm run sidecar:*` hint instead.

Electron is **maintenance-only**: no new desktop features on Electron IPC. Prefer Studio for all contributor and release work.

## Development

```bash
# Web + sidecar (recommended for UI work)
npm run dev

# Tauri desktop
npm run tauri:dev

# Legacy Electron (deprecated)
npm run electron   # requires npm run build first
npm run dist       # Windows NSIS installer
```

## CI & releases

- `tauri-smoke` — Tauri build smoke on every push
- `tauri-studio-release.yml` — publishes **Tauri** studio builds on `studio-v*` tags (**default ship**)
- `release.yml` — Electron installer via **manual** `workflow_dispatch` only (no automatic `v*` push from default `ship:tag`)

```bash
npm run ship:tag              # studio-vX.Y.Z only
npm run ship:tag -- --electron  # also push vX.Y.Z for legacy Electron
```

See [desktop.md](desktop.md).

## Publish

Full path until GitHub Release: **[publish.md](publish.md)**.

```bash
npm run ship:ready -- --print    # checklist
npm run ship:ready               # gates (e2e subset)
npm run ship:tag                 # studio-v* → CI publish
```
