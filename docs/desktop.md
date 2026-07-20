# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path going forward. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (EBU R128 LUFS, encoded-audio loudness, studio export)
- Managed Python **AI sidecar** spawn on demand
- Native **video handoff** to AI Video Creator via `video-handoff-bridge.ts`
- Native **canvas handoff** to AI Canvas Tool for Spotify loops via `canvas-handoff-bridge.ts` — see [canvas-handoff.md](canvas-handoff.md)

## Legacy: Electron

The **Electron** installer (`npm run dist`, `main.js`) remains for existing installs but is **deprecated**. Do not start new desktop features on Electron IPC.

**Sunset timeline (updated for v0.50.2+):**

| Train | Tag | Status |
|-------|-----|--------|
| **Tauri Studio (canonical)** | `studio-v*` | Default `npm run ship:tag` |
| **Electron (legacy)** | `v*` | Opt-in only: `npm run ship:tag -- --electron` or `workflow_dispatch` on `release.yml` |

Last dual-tag default ship was **v0.50.2**. From the next release onward, `ship:tag` pushes **studio only** unless `--electron` is passed. Electron auto-update users should migrate to Studio installers; maintenance Electron builds remain via `npm run dist` / manual workflow.

### Studio updates (current)

Tauri Studio does **not** ship an in-app auto-updater yet (no `tauri-plugin-updater` / pubkey in `tauri.conf.json`). After each `studio-v*` release, users download and install the new build from [GitHub Releases](https://github.com/Druttzen/ai-music-tool/releases). Enabling silent Studio updates is a follow-up that needs signing keys + release endpoint wiring.

| Capability | Tauri Studio (primary) | Electron (legacy / maintenance-only) |
|------------|------------------------|--------------------------------------|
| Updates | **Manual:** download new `studio-v*` installer from GitHub Releases (in-app updater **not configured** yet) | `electron-updater` on `v*` releases |
| Native DSP | `dsp-bridge.ts` | Browser / lamejs only |
| Sidecar | Managed spawn in Tauri shell | Manual `npm run sidecar` |
| Video handoff | `exportVideoHandoffNative` | `window.electronAPI.exportVideoHandoff` |
| Canvas handoff | `exportCanvasHandoffNative` | `window.electronAPI.openInCanvasTool` |

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

See [architecture-convergence.md](architecture-convergence.md) for Electron call-site inventory and sidecar convergence.
