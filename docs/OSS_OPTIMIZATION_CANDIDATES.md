# OSS Optimization Candidates

This registry tracks open-source projects reviewed for improving AI Music Creator.
Default rule: prefer permissive licenses (MIT, Apache-2.0, BSD, ISC, CC0). Do not
bundle AGPL/GPL or non-commercial model weights in core product paths.

## Accepted For Near-Term Integration

| Candidate | License | Area | Decision |
| --- | --- | --- | --- |
| librosa | ISC | Python sidecar audio analysis | Use existing dependency for richer tempo, chroma/key, onset, HPSS, and spectral descriptors. |
| Zod | MIT | Maestro/LLM structured output | Already installed; use it to validate and repair LLM JSON before sanitizing patches. |
| wavesurfer.js | BSD-3-Clause | Browser waveform UX | Added as a disabled-by-default prototype (`NEXT_PUBLIC_WAVESURFER_PROTOTYPE=1`) before any replacement decision. |
| rubato | MIT | Rust DSP sample-rate conversion | Evaluate only if native export needs higher-quality resampling. |
| oximedia-normalize | Apache-2.0 | Rust loudness normalization | Evaluate against current `ebur128` + limiter behavior before adopting. |
| awesome-suno-prompts | CC0 | Style prompt inspiration | Mine concepts only through a curated/generated import; avoid raw dump churn. |

## Optional / User-Installed Integrations

| Candidate | License | Area | Decision |
| --- | --- | --- | --- |
| Ollama | MIT | Local LLM server | Support through existing OpenAI-compatible provider preset; do not bundle. |
| llama.cpp | MIT | Local LLM runtime | Good future target for advanced local setup docs or optional CLI detection. |
| BLIP / CLIP via Hugging Face Transformers | Mixed model licenses | Image captioning | Optional sidecar `vision` extra only; keep browser pixel analyzer as default. |
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

1. Harden Maestro LLM JSON with Zod schemas and explicit command validation.
2. Extend sidecar audio analysis using the existing `librosa` dependency.
3. Add optional image captioning design hooks without requiring torch/transformers.
4. Prototype wavesurfer.js if existing waveform UX becomes a bottleneck.
5. Evaluate DSP crates only after adding benchmark-style tests around current output.

## Current Evaluation Decisions

### Waveform UX

The app already has a custom highlight editor in `app/components/audio-track-editor.jsx`
with waveform persistence through the analyzer state and IndexedDB audio cache. `wavesurfer.js`
is attractive for timeline/regions/minimap/spectrogram plugins, but replacing the current editor
would touch playback, drag handles, e2e analyzer tests, and exported project shape. Decision:
keep `app/components/audio-waveform-pro-prototype.jsx` disabled unless
`NEXT_PUBLIC_WAVESURFER_PROTOTYPE=1` is set, then evaluate Regions/Timeline UX without risking
the stable editor.

### DSP / Export

`dsp-core` currently uses `ebur128`, `symphonia`, `hound`, and `mp3lame-encoder`, with
locked Rust CI for both `dsp-core` and Tauri smoke builds. `oximedia-normalize` and `rubato`
remain good candidates, but adopting either should be driven by a failing quality requirement
(for example: inter-sample clipping, poor resampling, or measurable loudness drift). Decision:
do not add new Rust DSP dependencies during this pass; first extend golden tests if export
quality issues appear.

