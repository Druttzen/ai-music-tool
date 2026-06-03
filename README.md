# AI Music Creator — Prompt Control Room

**Version 0.7.7**

A Next.js app for building dense, reproducible prompts for AI music workflows (especially **Suno-like** layouts): genres, grooves, sounds, lyric direction, presets, optional reference analyzers, and export blocks that respect **Style** / **Lyrics** field limits. Ships as a static web app and an optional **Electron** Windows installer.

## Highlights (v0.7.7)

- **Cleanup tooling** — `npm run cleanup:dist:sudo` and `npm run cleanup:sudo` for locked `electron-dist*` folders on Windows.
- **Version fallback sync** — in-app version matches `package.json` when env injection is unavailable.
- **Export tests** — WAV 24-bit filename and PCM header coverage in vitest.

## Highlights (v0.7.6)

- **WAV 24-bit export** — honest third studio format alongside 16-bit WAV and MP3.
- **Undo keeps compact waveforms** — peak arrays ≤4096 samples restore on revert.
- **Desktop update controls** — “Check for updates” and “Restart to install” in the packaged app header.
- **Pinned Electron toolchain** — `electron@41.3.0` and `electron-builder@26.8.1` for reproducible builds.

## Highlights (v0.7.5)

- **Undo snapshot fix** — capture uses the correct slim state (guided step, variations, history).
- **Honest studio export** — WAV and MP3 only; legacy `flac` requests map to WAV.
- **Release workflow** — push a `v*` tag to publish the Windows installer and `latest.yml` for auto-update.
- **Vitest 4** — clears the npm audit advisory on the test runner.

## Highlights (v0.7.4)

- **Turbopack root** — `turbopack.root` in `next.config.js` fixes dev crashes when Next mis-detects `app/` as the workspace.
- **Dev debug** — `npm run debug` uses a single inspector on port **9241** (`scripts/debug-dev.ps1`); `npm run stop` also clears stray Next `node` processes.
- **Undo** — Snapshot restores **guided step**, **variations**, and **prompt history**; audio rehydrates from IndexedDB when cached.
- **MP3 fallback** — If MP3 encode fails in the worker, export falls back to WAV with a status message.
- **`npm run cleanup:dist`** — Removes locked `electron-dist*` folders when Windows/Cursor releases them.

## Highlights (v0.7.2)

- **Analyzer honesty** — In-app banners clarify that track/image scans are local heuristics, not ML classification.
- **Lyrics priority trim** — Suno Lyrics paste matches Style: theme/language/sections first, long bodies trim from the end (≤5000).
- **Studio export** — Background worker with progress bar; WAV / MP3; highlight-loop export.
- **Undo snapshot** — Revert to last snapshot before preset load, import, merge, or variations.
- **Variation A/B** — Side-by-side compare with changed-line summary.
- **CI** — GitHub Actions runs `npm test` + `npm run check` on push/PR.
- **Electron auto-update** — Checks GitHub releases when running a packaged build.

## Highlights (v0.7.1)

- **Guided Suno path** — Step-through workflow, Polish step, progressive style preview, **Style** capped at **1000 characters** with priority ordering on copy.
- **Expanded English style vocabulary** — Large curated catalog including world/regional styles paired with instruments, sound-design FX, environment beds, orchestral and band instruments, moods, and fusion labels; English-only picker with dedupe.
- **Track analyzer (local)** — Drop **WAV / MP3 / OGG / M4A** for a Sonoteller-style report: editable summary, genres, moods, instruments, BPM/key estimates, and a **highlight** section with full-track + zoomed **waveforms** (drag amber handles to set the range).
- **Audio DNA → Suno** — **Merge into Suno fields** applies tempo, genres, sounds, rhythms, mood sliders, a compact **`AUDIO:`** rule line, and copies the track summary into **Goal** and **Notes** when present.
- **Image analyzer** — Drop **JPG / PNG** for palette-driven genre/sound suggestions; merges into **`IMAGE:`** rule lines and guided fields.
- **LUFS meter (EBU R128)** — After attach/analyze, shows **gated integrated LUFS** and **true peak (dBTP)** using a **BS.1770-4**-style engine (libebur128-aligned K-weighting and oversampling).
- **Studio WAV export** — Three local mastering presets: **Streaming** (−14 LUFS integrated + −1 dBTP limit), **Wide spatial** (stereo width), **Punch** (low-end and dynamics). Exports 16-bit stereo WAV in the browser.
- **Waveform persistence** — Autosave/history omit heavy peak arrays; **IndexedDB** caches audio for rehydrate. **Export JSON** keeps full `waveformPeaks`; **import** preserves them. **Attach audio** reconnects playback when the cache is missing.
- **Version-aware reset** — A **major** `package.json` version bump clears the autosaved project and analyzer state; **presets and history are kept**. Patch/minor bumps migrate the saved project in place.
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

Starts `next dev --inspect=9241` (one inspector port). In VS Code / Cursor, attach to **9241** (see `.vscode/launch.json`).

Stop stuck dev/debug ports on Windows:

```bash
npm run stop
```

Remove stale packaging folders (when not locked):

```bash
npm run cleanup:dist
```

### Electron auto-update

Packaged builds check **GitHub Releases** for `Druttzen/ai-music-tool` on startup. Updates require a published release with `latest.yml` from `electron-builder --publish` (or manual upload). Dev/`npm run electron` skips update checks.

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

Runs `npm run build`, regenerates **`build/AI_Music_Creator_README.pdf`** from this README (`npm run build:readme-pdf`), prepares `out/` for Electron (`npm run prepare:electron-dist`), then **electron-builder**. Installer output under `electron-dist/` (see `package.json` `build` section). The PDF opens once on first launch (`main.js`).

Regenerate the PDF alone:

```bash
npm run build:readme-pdf
```

If `electron-dist/win-unpacked` is locked, `prepare:electron-dist` automatically falls back to `electron-dist-fresh`, `electron-dist-v{version}` (e.g. `electron-dist-v071`), or a timestamped `electron-dist-build-*` folder. Close any running **AI Music Creator** instance and Explorer windows in old output folders if you want the default `electron-dist/` path back.

## Saved data

| Storage | What |
|--------|------|
| `localStorage` | Autosaved project (`ai_music_creator_visual_tool_v3`), custom presets, prompt history (slim snapshots — no waveform peaks in history/autosave) |
| `sessionStorage` | Splash intro seen flag |
| **IndexedDB** (`ai-music-creator`) | Cached audio blobs for waveform rehydrate (not in exported JSON) |
| **Export JSON** | Full project including `audioAnalysis.waveformPeaks`; re-import restores peaks and timeline (attach audio on another machine for playback if cache is empty) |

## Studio export notes

- Processing runs **locally** in the browser; long tracks can take time (max **10 minutes** per export).
- **Streaming** targets **−14 LUFS** integrated loudness — common for Spotify/YouTube-style delivery, not a substitute for a certified broadcast meter or mastering engineer.
- **Wide spatial** is **stereo enhancement**, not Dolby Atmos.

## Version source of truth

The UI reads **`APP_VERSION`** from `package.json` via `NEXT_PUBLIC_APP_VERSION` in `next.config.js`. Bump **`package.json`** `version` for releases; the fallback in `app/lib/music-config.js` should match for dev without env.

## Author

**DJ M@D**

---

_Legacy Next.js starter sections were replaced with this project README as of v0.6.1._
