# AI Music Creator — Prompt Control Room

**Version 0.7.0**

A Next.js app for building dense, reproducible prompts for AI music workflows (especially **Suno-like** layouts): genres, grooves, sounds, lyric direction, presets, optional audio/image analyzers, and export blocks that respect **Style** / **Lyrics** field limits.

## Highlights (v0.7.0)

- **Guided Suno path** — Step-through workflow, Polish step, progressive style preview, **Style** capped at **1000 characters** with priority ordering on copy.
- **Expanded English style vocabulary** — Large curated catalog including **world/regional styles paired with instruments**, sound-design FX, environment beds, orchestral and band instruments, moods, and fusion labels; English-only picker with dedupe.
- **Analyzers** — Drag-drop audio DNA and image→style merges into compact **`AUDIO:` / `IMAGE:`** rule lines (metrics + groove retained first when trimming); merge respects guided caps on genres/sounds/rhythms.
- **Refactored analyzer/UI shell** — Audio/image analyzer logic now lives in a dedicated hook, and splash/header rendering is split into reusable components for easier future maintenance.
- **Packaged asset cleanup** — The BONES VIBRATION logo is now a checked-in static SVG, and Electron packaging no longer depends on missing icon/PDF assets.
- **Live length readout** — Style box and lyrics direction character counts next to analyzers (same strings as the validator).
- **Presets & history** — Factory and custom presets, project save/import, variation engine, Co‑Producer helpers, Suno language index and symbol guides.

## Requirements

- **Node.js** 18+ recommended  
- **npm** (ships with Node)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
```

**Pre-ship check** (ESLint, zero warnings, then production build):

```bash
npm run check
```

`npm run lint` runs ESLint alone.

Static output is produced by Next.js (`out/` when configured for export, or standard App Router build — see `next.config.js`).

## Desktop (Electron)

```bash
npm run dist
```

Uses **electron-builder**; installer output under `electron-dist/` (see `package.json` `build` section).

## Version source of truth

The UI reads **`APP_VERSION`** from `package.json` via `NEXT_PUBLIC_APP_VERSION` in `next.config.js`. Bump **`package.json`** `version` for releases; the fallback in `app/lib/music-config.js` should match for dev without env.

## Author

**DJ M@D**

---

_Legacy Next.js starter sections were replaced with this project README as of v0.6.1._
