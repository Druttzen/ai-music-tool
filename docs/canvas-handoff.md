# Canvas handoff — AI Music Tool → AI Canvas Tool

**AI Canvas Tool** is a **suite addon** fused into Music Creator.

## Install from the app

1. Open the left **Suite Addons** panel
2. Click **Download / Install Canvas**
3. Downloads [AI Canvas Tool v1.1.1+](https://github.com/Druttzen/ai-canvas-tool/releases) automatically when a release exists; otherwise opens **build instructions** on the repo README
4. Finish setup, click **Open Canvas Tool**, or drop album art in Analyzers → **Open in Canvas Tool → Spotify loop**

**Manual build (no release):**

```bash
git clone https://github.com/Druttzen/ai-canvas-tool.git
cd ai-canvas-tool
npm install
npm run dist:setup
```

Then run `release/AI Canvas Tool Setup.exe` or place it in your Downloads folder and use **Download / Install Canvas** again.

When a track is analyzed in Music Creator, **Open in Canvas Tool** also exports `track-audio-*` to the suite folder and sets `audioPath` in `handoff.json` for preview sync in Canvas Tool.

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

Manual install: download from [ai-canvas-tool releases](https://github.com/Druttzen/ai-canvas-tool/releases) or build locally (`npm run dist:setup`).
