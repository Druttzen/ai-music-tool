# Canvas handoff — AI Music Tool → AI Canvas Tool

**AI Canvas Tool** is the visual integration explicitly supported by Music Creator.

## Install from the app

1. Open the left **Addons** panel
2. Click **Download / Install Canvas**
3. Studio downloads the latest Setup.exe into `{install}/data/archives/canvas-setup/` and **silently** installs into `{install}/data/addons/canvas/` (same data tree as the app — no GUI installer)
4. Click **Open AI Canvas Tool**, or drop album art in Analyzers → **Open in Canvas Tool → Spotify loop**

**Manual build (optional):**

```bash
git clone https://github.com/Druttzen/ai-canvas-tool.git
cd ai-canvas-tool
npm install
npm run dist:setup
```

Then place `AI.Canvas.Tool-*-Setup.exe` in `{Studio data}/archives/canvas-setup/` and use **Download / Install Canvas** again.

When a track is analyzed in Music Creator, **Open in Canvas Tool** also exports `track-audio-*` to the suite exports folder and sets `audioPath` in `handoff.json` for preview sync in Canvas Tool.

Status shows **Installed** when an executable is found under `{STUDIO_DATA}/addons/canvas/` (or `$APPDIR` colocated candidates). Foreign Program Files / `%LOCALAPPDATA%\Programs` copies are not treated as Installed; Install may **relocate** them once into the Studio app data folder.

## How handoff works

1. Artwork (and optional audio) is saved under `{install}/data/exports/` (or `STUDIO_DATA_DIR/exports/`)
2. `handoff.json` is written at `{install}/data/handoff.json` with track title, artist, and art path
3. **AI Canvas Tool** launches and imports the handoff automatically (when installed)

Shared paths, executable candidates, and Canvas install metadata live in `lib/suite-handoff-paths.json` (used by Tauri Studio). Installer discovery is limited to Studio data / app-dir candidates; a one-time relocate can copy an already-installed Canvas into `{STUDIO_DATA}/addons/canvas`.

## Desktop builds

| Build | Bridge |
|-------|--------|
| **Tauri Studio** (primary) | `export_canvas_handoff`, `suite_canvas_addon_status`, `install_canvas_addon`, `launch_canvas_addon` |

Browser-only dev (`npm run dev:web`) cannot install or launch Canvas (desktop shell required). Electron packaging is retired; see [desktop.md](desktop.md).

## Dev

```bash
npm run tauri:dev    # recommended
```

Manual install: download from [ai-canvas-tool releases](https://github.com/Druttzen/ai-canvas-tool/releases) or build locally (`npm run dist:setup`).
