# AI Music Creator — Prompt Control Room

**Version 0.7.0**

A Next.js app for building dense, reproducible prompts for AI music workflows (especially **Suno-like** layouts): genres, grooves, sounds, lyric direction, presets, optional reference analyzers, and export blocks that respect **Style** / **Lyrics** field limits. Ships as a static web app and an optional **Electron** Windows installer.

## Highlights (v0.7.0)

- **Guided Suno path** — Step-through workflow, Polish step, progressive style preview, **Style** capped at **1000 characters** with priority ordering on copy.
- **Expanded English style vocabulary** — Large curated catalog including world/regional styles paired with instruments, sound-design FX, environment beds, orchestral and band instruments, moods, and fusion labels; English-only picker with dedupe.
- **Track analyzer (local)** — Drop **WAV / MP3 / OGG / M4A** for a Sonoteller-style report: editable summary, genres, moods, instruments, BPM/key estimates, and a **highlight** section with full-track + zoomed **waveforms** (drag amber handles to set the range).
- **Audio DNA → Suno** — **Merge into Suno fields** applies tempo, genres, sounds, rhythms, mood sliders, a compact **`AUDIO:`** rule line, and copies the track summary into **Goal** and **Notes** when present.
- **Image analyzer** — Drop **JPG / PNG** for palette-driven genre/sound suggestions; merges into **`IMAGE:`** rule lines and guided fields.
- **Waveform persistence** — Peak data is saved in the project JSON; audio files are cached in **IndexedDB** (with lookup keys) so waveforms and playback can be restored after reload. **Attach audio** reconnects a matching file if the cache is missing.
- **Version-aware reset** — Bumping `package.json` version clears saved prompts/presets/history so upgrades do not carry stale style state.
- **Refactored UI** — Analyzer logic in `use-analyzers`, splash/header in `app-shell`, splash timing via `useSyncExternalStore` (no hydration mismatch in dev).
- **Packaged assets** — `public/bones-logo.png`, root `icon.ico`, and `build/AI_Music_Creator_README.pdf` included for Electron builds.
- **Live length readout** — Style box and lyrics direction character counts next to analyzers (same strings as the validator).
- **Presets & history** — Factory and custom presets, project save/import/export JSON, variation engine, Co‑Producer helpers, Suno language index and symbol guides.

## Requirements

- **Node.js** 18+ recommended  
- **npm** (ships with Node)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Debug (Next.js + Node inspector)

```bash
npm run debug
```

Starts dev with `--inspect=9241`. In VS Code / Cursor, use **Run and Debug → “Attach to Node (Next main — 9241)”** or launch **“Next.js: debug (npm run debug)”** (see `.vscode/launch.json`).

Stop stuck dev/debug ports on Windows:

```bash
npm run stop
```

## Production build

```bash
npm run build
```

**Pre-ship check** (ESLint, zero warnings, then production build):

```bash
npm run check
```

`npm run lint` runs ESLint alone.

Static export output is written to `out/` (see `next.config.js` — `assetPrefix: "./"` for Electron-friendly relative assets).

## Desktop (Electron)

```bash
npm run dist
```

Runs `npm run build`, prepares `out/` for Electron (`npm run prepare:electron-dist`), then **electron-builder**. Installer output under `electron-dist/` (see `package.json` `build` section). Packaged README PDF is opened once on first launch (`main.js`).

If `dist` fails because `electron-dist/win-unpacked` is locked, close any running **AI Music Creator** instance and Explorer windows in that folder, or run `npm run stop` and retry.

## Saved data

| Storage | What |
|--------|------|
| `localStorage` | Autosaved project (`ai_music_creator_visual_tool_v3`), custom presets, prompt history |
| `sessionStorage` | Splash intro seen flag |
| **IndexedDB** (`ai-music-creator`) | Cached audio blobs for waveform rehydrate (not in exported JSON) |
| **Export JSON** | Full project including `audioAnalysis.waveformPeaks`; re-import on another machine restores the timeline (use **Attach audio** for playback) |

## Version source of truth

The UI reads **`APP_VERSION`** from `package.json` via `NEXT_PUBLIC_APP_VERSION` in `next.config.js`. Bump **`package.json`** `version` for releases; the fallback in `app/lib/music-config.js` should match for dev without env.

## Author

**DJ M@D**

---

_Legacy Next.js starter sections were replaced with this project README as of v0.6.1._
