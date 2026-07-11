# Canvas handoff — AI Music Tool → AI Canvas Tool

After dropping an image in **Drag & Drop Analyzers**, click **Open in Canvas Tool → Spotify loop**.

## How it works

1. Artwork is saved to `Documents/AI Suite/exports/`
2. `handoff.json` is written with track title, artist, and art path
3. **AI Canvas Tool** launches and imports the handoff automatically (when installed)

Shared paths and canvas executable candidates live in [`lib/suite-handoff-paths.json`](../lib/suite-handoff-paths.json) (used by Tauri and Electron).

## Desktop builds

| Build | Bridge |
|-------|--------|
| **Tauri Studio** (primary) | Native `export_canvas_handoff` command |
| **Electron** (legacy) | `window.electronAPI.openInCanvasTool` via `lib/suite-bridge.cjs` |

Browser-only dev (`npm run dev:web`) shows a status message — handoff requires a desktop shell.

## Dev

```bash
npm run tauri:dev    # recommended
npm run electron     # legacy — requires npm run build first
```

Install **AI Canvas Tool** from your suite repo (`ai-canvas-tool/release`) so the launcher can find the executable.
