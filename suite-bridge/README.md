# Suite bridge — AI Music Tool → AI Canvas Tool

After dropping an image in **Drag & Drop Analyzers**, click **Open in Canvas Tool → Spotify loop**.

## How it works

1. Artwork is saved to `Documents\AI Suite\exports\`
2. `handoff.json` is written with track title, artist, and art path
3. **AI Canvas Tool** launches and imports the handoff automatically

## Rebuild desktop app

```bash
npm run build
npm run dist   # or your electron-builder script
```

## Dev

Run Electron (not browser-only) so `window.electronAPI.openInCanvasTool` is available.
