# Architecture convergence

AI Music Creator owns music prompting, analysis, generation, vocal workflows, mastering, and portable music exports. Canvas is the only direct visual-app integration.

Other AI Creator projects collaborate through the neutral [Music Exchange](music-exchange.md) bundle. They may import its project, prompt, analysis, artwork metadata, and optional audio sidecar, but Music Creator does not launch or configure those consumers.

Plan phases (status): Electron sunset truth → sidecar `device` / `registry` / `jobs` → UI capabilities helper → **retire Electron train** (**done** as of `studio-v0.50.21`; shell/dead-code removed after `studio-v0.50.22`).

## Desktop shell

Canonical desktop is **Tauri Studio** (`src-tauri`). Shared Canvas discovery lives in [`lib/suite-handoff-paths.json`](../lib/suite-handoff-paths.json) + [`lib/suite-handoff-config.cjs`](../lib/suite-handoff-config.cjs). Do not add Electron IPC or packaging.

| Surface | Path | Role |
|---------|------|------|
| Updates | [`app/lib/desktop-update-bridge.js`](../app/lib/desktop-update-bridge.js) | Signed Tauri updater |
| Music Exchange | [`app/hooks/project-actions/use-export-actions.js`](../app/hooks/project-actions/use-export-actions.js) | Portable download |
| Canvas handoff | [`app/lib/suite-canvas-client.js`](../app/lib/suite-canvas-client.js) | `exportCanvasHandoffNative` |
| Addons (Canvas) | [`app/lib/canvas-addon-client.js`](../app/lib/canvas-addon-client.js) | `install_canvas_addon` / `launch_canvas_addon` |

Do not add consumer-specific render settings, executable discovery, or launch IPC to Music Creator. Extend the portable exchange contract instead.

## Sidecar convergence

| Module | Role |
|--------|------|
| [`ai_sidecar/device.py`](../ai-sidecar/ai_sidecar/device.py) | DeviceInfo + VRAM-tier DevicePolicy (CUDA / MPS / CPU) |
| [`ai_sidecar/registry.py`](../ai-sidecar/ai_sidecar/registry.py) | CapabilitySpec catalog + install hints |
| [`ai_sidecar/jobs.py`](../ai-sidecar/ai_sidecar/jobs.py) | Single-worker JobManager; stems + generate runners |

Health exposes `device` (string), `device_info`, and `capabilities` while keeping legacy boolean flags.

Packaged user-data `pkg/` is **overlaid** from bundle sources (never `remove_dir_all`). Sidecar CORS includes `Access-Control-Allow-Private-Network` for the Tauri webview. BLIP caption negotiates Transformers 5 `image-text-to-text`. Lyrics synthesis can use transformers TTS when RVC/DiffSinger are not ready.

Fable 5 was a soak-test studio for these packaging lessons. Useful runtime/packaging behavior now lives here; the Fable 5 test project is retired.

Install extras (Windows npm scripts; `.sh` counterparts under `scripts/`):

| Script | Extra |
|--------|-------|
| `npm run sidecar:stems` | Demucs |
| `npm run sidecar:stems-melband` | Mel-Band RoFormer |
| `npm run sidecar:generate` | MusicGen |
| `npm run sidecar:classify` | Genre classifier |
| `npm run sidecar:vision` | BLIP / CLIP |
| `npm run sidecar:cover` | Album cover (FLUX text) |
| `npm run sidecar:cover-ref` | Album cover from image |
| `npm run sidecar:vocal` | Vocal DSP (scipy) |
| `npm run sidecar:vocal-ml` | Vocal torch stack |
| `npm run sidecar:vocal-rvc` | RVC |
| `npm run sidecar:all` | All optional extras |

## Ship commands

```bash
npm run ship:tag                 # studio-v* only (Electron retired)
```

See [desktop.md](desktop.md).
