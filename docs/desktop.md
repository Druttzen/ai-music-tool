# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path going forward. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (EBU R128 LUFS, encoded-audio loudness, studio export)
- Managed Python **AI sidecar** spawn on demand
- Native **video handoff** to AI Video Creator via `video-handoff-bridge.ts`

## Legacy: Electron

The **Electron** installer (`npm run dist`, `main.js`) remains for existing installs but is **deprecated**. Do not start new desktop features on Electron IPC.

| Capability | Tauri (primary) | Electron (legacy) |
|------------|-----------------|-------------------|
| Auto-updates | Tauri updater (when configured) | `electron-updater` |
| Native DSP | `dsp-bridge.ts` | Browser / lamejs only |
| Sidecar | Managed spawn in Tauri shell | Manual `npm run sidecar` |
| Video handoff | `exportVideoHandoffNative` | `window.electronAPI.exportVideoHandoff` |

Electron is tried **after** Tauri in `exportVideoHandoff` so Tauri builds get the native path first.

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

## CI

- `tauri-smoke` — Tauri build smoke on every push
- `release.yml` — publishes Windows installer on version tags (`npm run ship:tag`)
