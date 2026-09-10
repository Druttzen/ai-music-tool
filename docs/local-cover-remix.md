# Local cover / remix engine

Reverse-engineer a track you load in **Analyzers**, then generate a **cover** or
**remix** entirely inside Studio. This does **not** build a Suno paste pack and
does not call Suno.

Album-art **Cover Tools** (FLUX) are unrelated — those make images, not songs.

## Modes

| Mode | Backend | Needs |
|------|---------|--------|
| **Cover** (preferred) | ACE-Step full song from track DNA (BPM/key/style prompt) | `npm run sidecar:acestep` + ACE API |
| **Cover** (fallback) | MusicGen melody-conditioned clip using your track as melody | `npm run sidecar:generate` |
| **Remix** | Vocal-transform remux (pitch/formant on stems) | `npm run sidecar:stems` or `sidecar:stems-melband` |

## Flow

1. Drop your song on Analyzers (audio analysis runs).
2. Open **Local cover / remix** under the track editor.
3. Choose **Cover** or **Remix**, optional lyrics (ACE), duration / pitch, highlight.
4. **Generate cover** / **Generate remix** — result loads in the player (optional download).

## DNA

The engine builds an internal prompt from the analyzer report (genres, mood,
tempo, key, etc.) via `app/lib/local-track-dna.js`. That prompt is sent to the
local generator only — it is not applied to Suno Style fields unless you
separately use “Build Suno v5.5 Style → merge.”

## Files

- `app/lib/local-track-dna.js` — DNA + engine selection
- `app/lib/local-cover-remix-engine.js` — job runner
- `app/hooks/analyzers/use-local-cover-remix.js` — UI hook
- `app/components/local-cover-remix-controls.jsx` — controls
