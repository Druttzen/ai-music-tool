# Architecture convergence

AI Music Creator owns music prompting, analysis, generation, vocal workflows, mastering, and portable music exports. Canvas is the only direct visual-app integration.

Other AI Creator projects collaborate through the neutral [Music Exchange](music-exchange.md) bundle. They may import its project, prompt, analysis, artwork metadata, and optional audio sidecar, but Music Creator does not launch or configure those consumers.

Plan phases: Electron sunset truth → sidecar `device` / `registry` / `jobs` → UI capabilities helper → retire default Electron train.

## Electron IPC inventory (cutover checklist)

| Surface | Path | Role | Tauri parity |
|---------|------|------|--------------|
| Bridge | [`app/lib/electron-bridge.js`](../app/lib/electron-bridge.js) | `isElectronApp`, update APIs | N/A (web/Tauri skip) |
| Updates hook | [`app/hooks/use-electron-updates.js`](../app/hooks/use-electron-updates.js) | Check / quit-and-install (Electron only) | Studio: manual `studio-v*` install until updater lands |
| Preload API | [`preload.js`](../preload.js) | `window.electronAPI` | — |
| Main process | [`main.js`](../main.js) | Window, updater, IPC | [`src-tauri`](../src-tauri) |
| Music Exchange | [`app/hooks/project-actions/use-export-actions.js`](../app/hooks/project-actions/use-export-actions.js) | Browser download | Same portable download |
| Canvas handoff | [`app/lib/suite-canvas-client.js`](../app/lib/suite-canvas-client.js) | `electronAPI.openInCanvasTool` | `exportCanvasHandoffNative` |
| Canvas integration | [`app/lib/canvas-addon-client.js`](../app/lib/canvas-addon-client.js) | `installCanvasAddon` / `launchCanvasAddon` | `install_canvas_addon` / `launch_canvas_addon` |
| Canvas bridge | [`lib/suite-bridge.cjs`](../lib/suite-bridge.cjs) | Electron Canvas paths + install | Shared `lib/suite-handoff-paths.json` |

Do not add consumer-specific render settings, executable discovery, or launch IPC to Music Creator. Extend the portable exchange contract instead.

## Sidecar convergence

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
