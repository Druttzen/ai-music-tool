# Canvas handoff — AI Music Tool → AI Canvas Tool

**AI Canvas Tool** is a **suite addon** fused into Music Creator.

## Install from the app

1. Open the left **Suite Addons** panel
2. Click **Download / Install Canvas**
3. Finish the installer (local Setup.exe, GitHub release asset, or browser download page)
4. Click **Open Canvas Tool**, or drop album art in Analyzers → **Open in Canvas Tool → Spotify loop**

Status shows **Installed** when an executable from [`lib/suite-handoff-paths.json`](../lib/suite-handoff-paths.json) `canvasCandidates` is found.

## How handoff works

1. Artwork is saved to `Documents/AI Suite/exports/`
2. `handoff.json` is written with track title, artist, and art path
3. **AI Canvas Tool** launches and imports the handoff automatically (when installed)

Shared paths, executable candidates, and addon install metadata live in `lib/suite-handoff-paths.json` (used by Tauri and Electron).

## Desktop builds

| Build | Bridge |
|-------|--------|
| **Tauri Studio** (primary) | `export_canvas_handoff`, `suite_canvas_addon_status`, `install_canvas_addon`, `launch_canvas_addon` |
| **Electron** (legacy) | `window.electronAPI.openInCanvasTool` / `installCanvasAddon` / `launchCanvasAddon` via `lib/suite-bridge.cjs` |

Browser-only dev (`npm run dev:web`) opens the GitHub install page; handoff/launch requires a desktop shell.

## Dev

```bash
npm run tauri:dev    # recommended
npm run electron     # legacy — requires npm run build first
```

Manual install: build **AI Canvas Tool** (`ai-canvas-tool` → `npm run dist:setup`) so the launcher finds `release/` or Program Files paths listed in the shared config.
