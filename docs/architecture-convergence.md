# Architecture convergence

Copy layer discipline from [AI Video Studio](https://github.com/Druttzen/ai-video-studio) into AI Music Creator **without** a rewrite or Next→Vite migration.

Plan phases: Electron sunset truth → sidecar `device` / `registry` / `jobs` → UI capabilities helper → retire default Electron train.

## Electron IPC inventory (cutover checklist)

| Surface | Path | Role | Tauri parity |
|---------|------|------|--------------|
| Bridge | [`app/lib/electron-bridge.js`](../app/lib/electron-bridge.js) | `isElectronApp`, update APIs | N/A (web/Tauri skip) |
| Updates hook | [`app/hooks/use-electron-updates.js`](../app/hooks/use-electron-updates.js) | Check / quit-and-install | Tauri updater when configured |
| Preload API | [`preload.js`](../preload.js) | `window.electronAPI` | — |
| Main process | [`main.js`](../main.js) | Window, updater, IPC | [`src-tauri`](../src-tauri) |
| Video handoff | [`app/hooks/project-actions/use-export-actions.js`](../app/hooks/project-actions/use-export-actions.js) | `electronAPI.exportVideoHandoff` fallback | `exportVideoHandoffNative` first |
| Canvas handoff | [`app/lib/suite-canvas-client.js`](../app/lib/suite-canvas-client.js) | `electronAPI.openInCanvasTool` | `exportCanvasHandoffNative` |
| Suite bridge | [`lib/suite-bridge.cjs`](../lib/suite-bridge.cjs) | Electron suite paths | Shared `lib/suite-handoff-paths.json` |

**Do not remove** Electron handoff fallbacks until Studio canvas + video paths are verified on a tagged `studio-v*` install.

## Sidecar convergence (video patterns)

| Module | Role |
|--------|------|
| [`ai_sidecar/device.py`](../ai-sidecar/ai_sidecar/device.py) | DeviceInfo + VRAM-tier DevicePolicy (CUDA / MPS / CPU) |
| [`ai_sidecar/registry.py`](../ai-sidecar/ai_sidecar/registry.py) | CapabilitySpec catalog + install hints |
| [`ai_sidecar/jobs.py`](../ai-sidecar/ai_sidecar/jobs.py) | Single-worker JobManager; stems + generate runners |

Health exposes `device` (string), `device_info`, and `capabilities` while keeping legacy boolean flags.

Install extras (Windows npm scripts; `.sh` counterparts under `scripts/`):

| Script | Extra |
|--------|-------|
| `npm run sidecar:stems` | Demucs |
| `npm run sidecar:generate` | MusicGen |
| `npm run sidecar:classify` | Genre classifier |
| `npm run sidecar:vision` | BLIP / CLIP |
| `npm run sidecar:vocal` | Vocal DSP (scipy) |
| `npm run sidecar:vocal-ml` | Vocal torch stack |
| `npm run sidecar:vocal-rvc` | RVC |
| `npm run sidecar:all` | All optional extras |

## Ship commands

```bash
npm run ship:tag                 # studio-v* only
npm run ship:tag -- --electron   # also legacy v*
```

See [desktop.md](desktop.md).
