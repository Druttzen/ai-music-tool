# OSS Optimization Candidates

This registry tracks open-source projects reviewed for improving AI Music Creator.
Default rule: prefer permissive licenses (MIT, Apache-2.0, BSD, ISC, CC0). Do not
bundle AGPL/GPL or non-commercial model weights in core product paths.

## Accepted For Near-Term Integration

| Candidate | License | Area | Decision |
| --- | --- | --- | --- |
| librosa | ISC | Python sidecar audio analysis | Use existing dependency for richer tempo, chroma/key, onset, HPSS, and spectral descriptors. |
| Zod | MIT | Maestro/LLM structured output | **Adopted** — `repairMaestroLlmJson` + Zod schemas in `maestro-chat-llm.js` strip unknown keys / coerce shapes, then `sanitizeMaestroPatch`. |
| wavesurfer.js | BSD-3-Clause | Browser waveform UX | **Default ON** in Highlight editor; set `NEXT_PUBLIC_WAVESURFER_PROTOTYPE=0` or use classic toggle (`aimc-classic-waveform`) to opt out. |
| flacenc | Apache-2.0 | Pure-Rust FLAC encode | **Adopted** in `dsp-core` Studio export. |
| rusty_aac | MIT/Apache-2.0 | Pure-Rust AAC-LC encode | **Adopted** in `dsp-core` with custom ISOBMFF M4A mux. |
| rubato | MIT | Rust DSP sample-rate conversion | **Adopted** in `dsp-core` — Studio export resamples to 48 kHz. |
| oximedia-normalize | Apache-2.0 | Rust loudness normalization | Deferred — keep `ebur128` + true-peak limiter; revisit only if goldens regress. |
| awesome-suno-prompts | CC0 | Style prompt inspiration | Imported via `npm run import:awesome-suno` into Style Prompt Library (`awesomeSunoConcepts`). |

## Optional / User-Installed Integrations

| Candidate | License | Area | Decision |
| --- | --- | --- | --- |
| Ollama | MIT | Local LLM server | Support through existing OpenAI-compatible provider preset; do not bundle. |
| llama.cpp | MIT | Local LLM runtime | Good future target for advanced local setup docs or optional CLI detection. |
| BLIP / CLIP via Hugging Face Transformers | Mixed model licenses | Image captioning | Optional sidecar `vision` extra — `POST /analyze-image` (BLIP base + CLIP zero-shot tags). Browser pixel analyzer remains default. |
| Demucs | MIT code | Stem separation | Already used as optional `stems` extra; keep heavy install opt-in. |
| Spleeter | MIT | Faster stem separation | Possible optional fallback if users prefer speed over quality; no default bundle. |

## Rejected For Core Bundling

| Candidate | License / Risk | Reason |
| --- | --- | --- |
| Essentia / Essentia.js | AGPLv3 | Excellent MIR, but AGPL is too risky for bundled Electron/Tauri app. |
| Essentia pretrained models | Often CC BY-NC-SA | Non-commercial weights conflict with general app distribution. |
| madmom pretrained models | CC BY-NC-SA | Source is BSD, but model/data licenses are not safe for bundled commercial use. |
| Open-Unmix `umxl` weights | CC BY-NC-SA | Avoid bundling non-commercial weights. |
| Unknown-license Suno prompt dumps | Unknown / CC BY-NC | Use only clearly licensed sources such as CC0, and prefer curated concepts. |

## Integration Order

1. ~~Harden Maestro LLM JSON with Zod schemas and explicit command validation.~~ — **done** (`repairMaestroLlmJson` + Zod in `maestro-chat-llm.js`).
2. ~~Extend sidecar audio analysis using the existing `librosa` dependency.~~ — **done** (sonic `time_signature` / `timeline_segments` promoted into merge, Suno style, and track editor).
3. ~~Optional image captioning via `POST /analyze-image` (vision extra)~~ — **done** (`npm run sidecar:vision`).
4. ~~Prototype wavesurfer.js~~ — **shipped default-on** (opt out with `NEXT_PUBLIC_WAVESURFER_PROTOTYPE=0` or classic toggle).
5. Evaluate DSP crates only after adding benchmark-style tests around current output.
6. Maestro LLM catalog grounding — local retrieval from style catalog + CC0 concepts (`maestro-catalog-grounding.js`).
7. Roadmap leftovers — tempo descriptors, negative guard packs, era/trend catalogs, metaphor surprise rolls, ~~DistilHuBERT genre override~~ (document + classify install hint; set `AIMC_GENRE_MODEL`), ~~MFA guide-vocal alignment guided setup~~ (`docs/mfa.md` + ready/heuristic badges; CLIP vision tags: **done**).
8. ~~MusicGen opt-in endpoint (`POST /generate`)~~ — **done** (`npm run sidecar:generate`; CC-BY-NC weights not bundled).

## Current Evaluation Decisions

### Waveform UX

The app already has a custom highlight editor in `app/components/audio-track-editor.jsx`
with waveform persistence through the analyzer state and IndexedDB audio cache. `wavesurfer.js`
is attractive for timeline/regions/minimap/spectrogram plugins, but replacing the current editor
would touch playback, drag handles, e2e analyzer tests, and exported project shape. Decision:
`app/components/audio-waveform-pro-prototype.jsx` is **on by default** (v0.14+). Opt out with
`NEXT_PUBLIC_WAVESURFER_PROTOTYPE=0` or the Highlight section classic-waveform toggle
(`aimc-classic-waveform` in localStorage). Continue evaluating Regions/Timeline UX against the
classic editor path.

### DSP / Export

`dsp-core` uses `ebur128`, `symphonia` (mp3/aac/alac/isomp4/caf/ogg/vorbis/flac/wav),
`hound`, `mp3lame-encoder`, `rubato` (48 kHz export resample), `flacenc` (FLAC export),
and `rusty_aac` (AAC-LC → M4A mux), with locked Rust CI for both `dsp-core` and Tauri smoke
builds. Streaming preset targets −14 LUFS integrated with a true-peak limiter at
−1 dBTP. `oximedia-normalize` remains deferred while goldens stay green.

