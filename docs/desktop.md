# Desktop builds

**Primary:** [Tauri](https://tauri.app/) (`npm run tauri:dev`, `npm run tauri:build`)

Tauri is the supported desktop path going forward. It bundles:

- Static Next.js export (`out/`)
- Native **dsp-core** (EBU R128 LUFS, encoded-audio loudness, studio export)
- Managed Python **AI sidecar** spawn on demand
- Native **video handoff** to AI Video Creator via `video-handoff-bridge.ts`

## Legacy: Electron

The **Electron** installer (`npm run dist`, `main.js`) remains for existing installs but is **deprecated**. Do not start new desktop features on Electron IPC.

**Sunset timeline:** Electron releases continue through **v0.48.x** for backward compatibility. **v0.49+** will be Tauri-only on the release train; `npm run dist` remains available for maintenance builds but is not part of `npm run ship:tag` or the default developer workflow.

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

## CI & releases

- `tauri-smoke` — Tauri build smoke on every push
- `release.yml` — publishes Windows **Electron** installer on `v*` tags
- `tauri-studio-release.yml` — publishes **Tauri** studio builds on `studio-v*` tags

`npm run ship:tag` pushes **both** `vX.Y.Z` and `studio-vX.Y.Z` so Electron and Tauri release workflows stay aligned.
