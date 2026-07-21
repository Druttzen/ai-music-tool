# Music Video suite handoff

AI Music Creator can export a **music-video** folder for external GPU tools such as [Glitchframe](https://github.com/6Morpheus6/Glitchframe).

## Install

1. Open **Suite Addons** in the left sidebar.
2. Use **Download / Install Music Video (Glitchframe)** (opens the project README / releases when no packaged installer exists).
3. Follow Glitchframe’s own setup (local GPU / Python).

## Handoff v1

From **Cover & Music Video** (Analyzers step):

1. Optionally generate a FLUX cover (`npm run sidecar:cover` / `sidecar:cover-ref`).
2. Click **Export for Music Video**.
3. Desktop builds write:

`Documents/AI Suite/exports/music-video/music-video-handoff.json`

The folder contains copied audio and cover files plus stable `audioPath` / `coverPath`
entries in the JSON, alongside `prompt`, `bpm`, `idea`, and `exportsDir`.

4. Upload the exported audio and optional cover in Glitchframe's Gradio UI. The handoff
folder opens automatically; the JSON is metadata for future/native integrations and does
not assume an undocumented Glitchframe command-line protocol.

## Sidecar covers (independent)

| Script | Capability |
|--------|------------|
| `npm run sidecar:cover` | Text → album cover (FLUX.1-schnell) |
| `npm run sidecar:cover-ref` | Reference image → cover (FLUX img2img) |

Neither requires the Music Video addon.
