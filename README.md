# AI Music Creator — Prompt Control Room

**Version 0.32.0**

A Next.js app for building dense, reproducible prompts for AI music workflows (especially **Suno-like** layouts): genres, grooves, sounds, lyric direction, presets, optional reference analyzers, and export blocks that respect **Style** / **Lyrics** field limits. Ships as a static web app, an optional **Electron** Windows installer, and a **Tauri** desktop build with native DSP export and Python sidecar integration.

## Highlights (v0.32.0)

- **`npm run check:full`** — unit + lint + build + sidecar pytest (release and CI gate).
- **`npm run ship:preflight`** — sync versions, `check:full`, optional `-E2e` and `-Dist` before tagging.
- **Hardened version sync** — Cargo.lock refresh fails loud; Windows file-write retries.
- **Weekly ci-vocal-ml** — scheduled vocal/OpenVPI e2e in addition to manual dispatch.

## Highlights (v0.31.0)

- **OpenVPI inference UX** — ready banner, dedicated synthesize button, `.ds` attached to synth envelopes, `openvpi-diffsinger-v1` engine label.
- **Maestro coach + LLM** — Polish step chips for vocal handoff and OpenVPI `.ds` when Co-Producer LLM is enabled.
- **ci-vocal-ml** — handoff, Maestro vocal embed, and OpenVPI inference e2e specs wired in.

## Highlights (v0.30.0)

- **Maestro LLM vocal embed** — `focusVocalEmbed` command and `vocalEmbedBrief` artifact; offline enrich when the model omits the brief.
- **Shared vocal embed turn** — `buildMaestroVocalEmbedTurn` powers offline and LLM paths.
- **Maestro LLM e2e** — mocked chat completions assert enriched vocal embed brief.

## Highlights (v0.29.0)

- **Handoff pack e2e** — align + export asserts plan, align-preview, OpenVPI `.ds`, and README downloads.
- **Handoff unit coverage** — `exportVocalEmbedHandoffPack` verifies multi-file filenames when align and `.ds` are present.

## Highlights (v0.28.0)

- **Maestro vocal embed** — offline replies for “show openvpi ds” with brief artifact and scroll to Vocal Embed Studio.
- **Align invalidation on lyrics** — stored alignment clears when generated lyrics change.
- **OpenVPI `.ds` auto-refresh** — recomputes stored segments when the vocal plan updates.
- **Sidecar plan metadata** — `/vocal-embed/plan` reports align method and OpenVPI segment count.

## Highlights (v0.27.0)

- **OpenVPI `.ds` session persistence** — align preview localStorage carries `openvpiDs`; restored on bundle import.
- **Plan export embeds `.ds`** — vocal embed plan JSON includes `openvpiDs` when segments are ready.
- **Bundle openvpiDs e2e** — export round-trip when analyzed track + stored align exist.
- **Coach OpenVPI e2e** — Polish step chip scrolls to Vocal Embed Studio.

## Highlights (v0.26.0)

- **OpenVPI `.ds` in handoff pack** — align + export handoff downloads `openvpi-ds.json` alongside plan and audio.
- **Bundle carries OpenVPI `.ds`** — project bundle export embeds DS segments when align + ready vocal plan exist.
- **Coach OpenVPI nudge** — Polish step suggests exporting `.ds` for DiffSinger when lyrics and voice are ready.
- **OpenVPI ds export e2e** — Playwright path for client-side `.ds` JSON download.

## Highlights (v0.25.0)

- **OpenVPI `.ds` export** — client-side and sidecar `/vocal-embed/ds-export` for DiffSinger segment JSON.
- **Synthesize with saved alignment** — lyrics-only preview when align preview is stored (no guide re-upload).
- **Maestro coach e2e** — Playwright path for MusicGen sketch → Maestro scroll chip.
- **ci-vocal-ml** — project bundle vocal-align e2e specs in optional workflow.

## Highlights (v0.24.0)

- **Bundle vocal align e2e** — export/import round-trip for `vocalEmbed` in project bundles.
- **Align invalidation** — clearing alignment when instrumental or guide vocal changes.
- **Export UX** — bundle and plan export toasts/labels when alignment is included.
- **Maestro offline e2e** — Playwright path for heuristic style-prompt reply.

## Highlights (v0.23.0)

- **Aligned vocal plan export** — MFA/heuristic `alignedWords` merge into plan JSON, handoff, and synthesis envelopes.
- **Download align JSON** — standalone alignment preview export from Vocal Embed Studio.
- **Step coach Maestro nudge** — Polish step suggests Maestro when a MusicGen sketch is loaded.
- **Coach scroll targets** — `showAnalyzers` scrolls to `drag-drop-analyzers` panel.

## Highlights (v0.22.0)

- **Vocal align in project bundle** — export/import carries align-preview JSON with instrumental/guide names.
- **MusicGen sketch badges** — track analyzer shows MusicGen + melody/highlight mode chips.
- **Highlight merge e2e** — Playwright asserts `·HL` in merged Suno rules after highlight generate.
- **Maestro coach scroll** — step coach can scroll to Maestro chat (`data-testid="maestro-chat-panel"`).
- **Co-Producer LLM advisory** — sketch brief includes melody/highlight mode context.

## Highlights (v0.21.0)

- **MG merge tags** — Suno AUDIO rule line suffixes `·mel` / `·HL` for melody and highlight-melody MusicGen sketches.
- **Vocal align persistence** — alignment preview cached per instrumental; survives panel navigation until track changes.
- **Align & export handoff e2e** — Playwright coverage for one-click align + handoff pack.
- **Step coach scroll** — Vocal Embed coach actions scroll to the studio panel.
- **Genre model label** — track analyzer shows sidecar HF genre model when DistilHuBERT (or override) is active.

## Highlights (v0.20.0)

- **MusicGen highlight melody e2e** — Playwright path: patch highlight range → melody + highlight checkboxes → merge (skips without `generate_available`).
- **Maestro highlight melody** — “Regenerate highlight melody” chip/command with `useHighlightMelody` artifact; Co-Producer notes highlight sketches.
- **Vocal Embed align & export handoff** — one-click align JSON + plan/audio pack for external vocal stacks.
- **E2E analysis patch hook** — `aimc-e2e-patch-audio-analysis` for highlight-range tests in dev.

## Highlights (v0.19.0)

- **Vocal Embed align e2e** — Playwright path for alignment preview + one-click align & synthesize (skips without sidecar).
- **ci-vocal-ml workflow** — optional GitHub Actions job for vocal DSP e2e and vocal-ml stack smoke.
- **Maestro LLM native artifacts** — system prompt requires model-populated style/lyrics/hooks; melody command enriches `musicGenPrompt`.
- **sidecar:vocal** — lightweight scipy install script for vocal synthesis without full torch stack.

## Highlights (v0.18.0)

- **Vocal Embed one-click path** — Align & synthesize preview; handoff pack includes `align-preview.json`.
- **Maestro melody regenerate** — `generateMusicGenMelody` command + suggestion chip when a MusicGen sketch is loaded.
- **Co-Producer hooks + sketch** — LLM hooks see loaded MusicGen analyzer context.
- **MusicGen highlight melody** — optional waveform highlight region as melody reference.
- **CC0 multi-tag + surprise** — toggle multiple tags; surprise pick from filtered pool; reference blocks in import pool.

## Highlights (v0.17.0)

- **Maestro LLM full artifacts** — `stylePrompt`, `lyrics`, and `hooks` in LLM JSON + offline enrich fallbacks; copy chips match offline Maestro.
- **Co-Producer LLM hooks** — Generate Hooks uses the same LLM settings when enabled; heuristic fallback on errors.
- **MusicGen sketch in advisory** — Improve Prompt references loaded MusicGen analyzer reports (prompt, BPM, key, melody mode).
- **Melody-conditioning e2e** — Playwright path: upload track → melody mode → generate & merge (skips without `generate_available`).

## Highlights (v0.16.0)

- **Maestro LLM suggestion chips** — LLM JSON includes `suggestions`; fallback chips when omitted; same tap-to-send UX as offline Maestro.
- **MusicGen live e2e** — Playwright spec skips unless sidecar reports `generate_available`; optional `ci-musicgen.yml` workflow.
- **CC0 import in CI** — `awesome-suno-sync` job re-imports at rotation offset 0 and fails on catalog drift.

## Highlights (v0.15.0)

- **Maestro LLM artifacts** — `musicGenPrompt` in LLM JSON responses; auto-filled when `generateMusicGen` fires; copy chip in chat.
- **Co-Producer LLM advisory** — Improve Prompt uses the same LLM settings as lyrics when enabled; heuristic fallback on errors.
- **MusicGen merge tests** — unit coverage for `buildAudioAnalyzerPatch` MG rule line.
- **CC0 rotation** — import script rotates the 400-concept cap monthly (+ metal/classical/latin/folk/reggae/k-pop sources); override with `AIMC_CC0_ROTATE_OFFSET`.

## Highlights (v0.14.0)

- **MusicGen → Suno loop** — generate & play merges into Suno fields (AUDIO + MG prompt line); librosa re-analyze on generated WAV; melody conditioning from current track (`POST /generate/melody`).
- **WaveSurfer default** — pro waveform editor on by default (classic highlight editor opt-out via localStorage).
- **Vocal Embed depth** — MFA/heuristic alignment preview, handoff pack export, RVC smoke spec (skips unless configured).
- **CC0 tag filters** — filter 400 community concepts by genre keyword in Style Prompt Library.
- **Co-producer / Maestro** — MusicGen sketch hints and Maestro `musicGenPrompt` artifact.

## Highlights (v0.13.9)

- **MusicGen playback** — Generate & play loads WAV into track analyzer waveform; Maestro/co-producer can trigger sketches.
- **CC0 library** — **400 concepts** (cap reached).

## Highlights (v0.13.7)

- **CC0 concept expansion** — awesome-suno import now includes `examples/` markdown + era/trend supplemental lines (up to 400 cap).
- **MusicGen scaffold** — opt-in `POST /generate` sidecar endpoint (`npm run sidecar:generate`; CC-BY-NC weights).
- **WaveSurfer prototype toggle** — one-click “Try WaveSurfer prototype” in the track analyzer (persists in localStorage).

## Highlights (v0.13.6)

- **Vocal Embed E2E polish** — guide vocal + lyrics defaults to lyric synthesis with optional MFA/OpenVPI timing; OpenVPI status in UI; synthesis engine returned from sidecar header.
- **Style library quick picks** — Metaphor roll, Era anchors, 2026 trends, and CC0 concept shortcuts in the Style prompt library.
- **Suno lyric consistency** — instrumental Lyrics box matches the `[Instrumental]` / `[No Vocals]` scaffold everywhere.

## Highlights (v0.13.5)

- **Research roadmap** — BPM evocative descriptors, v5.5 negative guard packs, era-anchored + 2026 trend catalogs, Maestro metaphor surprise rolls.
- **Sidecar upgrades** — optional DistilHuBERT genre model (`AIMC_GENRE_MODEL`), CLIP zero-shot vision tags on `/analyze-image`, MFA guide-vocal alignment hook for OpenVPI DiffSinger `.ds` timing.
- **Catalog refresh** — stayen/suno-reference re-sync; awesome-suno import cap raised to 400.

## Highlights (v0.13.4)

- **Maestro catalog grounding** — local retrieval from style catalog + CC0 concepts for LLM prompts (`maestro-catalog-grounding.js`).

## Highlights (v0.13.3)

- **BLIP image captioning** — optional `POST /analyze-image` via sidecar `vision` extra; merged into pixel analyzer.
- **CC0 awesome-suno concepts** — `npm run import:awesome-suno` into Style Prompt Library.

## Highlights (v0.13.2)

- **OpenVPI DiffSinger** — real inference via `diffsinger_openvpi.py` (variance + acoustic); configure `AIMC_DIFFSINGER_ROOT` + checkpoint exps.

## Highlights (v0.13.1)

- **Maestro polish coach** — step 6 nudges track analysis, voice character, lyrics, and Vocal Embed preview.
- **Vocal Embed E2E smoke** — `npm run test:smoke:vocal` validates plan handoff with sidecar running.
- **`.env.vocal` loader** — copy `ai-sidecar/env.vocal.example` → `ai-sidecar/.env.vocal` for model paths without system env.

## Highlights (v0.13.0)

- **RVC / DiffSinger integration** — configure user-owned models via `AIMC_RVC_MODEL`, `AIMC_RVC_API_URL`, or `AIMC_DIFFSINGER_CMD/URL`; `GET /vocal-embed/models` + UI stack badges.
- **Engines** — `rvc-conversion-v1`, `diffsinger-v1`, plus existing placement-mix and DSP paths.
- **`npm run sidecar:vocal-ml`** — installs torch vocal stack for model integrations.

## Highlights (v0.12.2)

- **Vocal DSP v1** — sidecar `vocal` extra enables guide vocal pitch conversion (`guide-conversion-v1`) and lyrics-only synthesis (`lyrics-synth-v1`) from section timing; health reports `vocal_ml_available`.
- **Vocal Embed Studio** — stack status badges, lyrics-only preview when vocal DSP is on, guide file optional in lyrics mode.

## Highlights (v0.12.1)

- **Vocal Embed placement-mix v1** — sidecar `POST /vocal-embed/synthesize` ducks the instrumental under lyric sections and overlays a guide vocal; UI adds guide vocal upload and **Synthesize placement-mix preview** (downloads WAV). Optional `vocal` extra adds scipy HPF; future `vocal-ml` reserved for RVC/DiffSinger.

## Highlights (v0.12.0)

- **Focused Suno step UI** — when Prompt Engine is Suno-like, only panels for the current guided step are shown (Style Presets on step 1, Music Controls on groove step, Analyzers on Polish, etc.). **Show all tools** restores the full studio; preference persists locally.
- **Maestro step coach** — after you work on a step, a banner nudges you to **Proceed to next step** or **Apply** one-click fixes (genre anchors, lyric draft, Suno validator cleanup).
- **Vocal Embed Studio** — plan local vocal placement on an analyzed instrumental (section timing, voice character, mix brief) without Suno's generation engine. Export JSON or **Send plan to sidecar** (`POST /vocal-embed/plan`) for validation and future DiffSinger/RVC synthesis.
- **High-precision Voice Character** — richer trait map (pitch range, vibrato, jitter/shimmer, articulation) for mimic-style Suno voice prompts.
- **Audio upgrades** — FLAC uploads with librosa sidecar fallback when the browser cannot decode; browser MP3 export raised to **256 kbps**; WAV 16/24-bit and native LAME MP3 via `dsp-core` unchanged.

## Highlights (v0.11.0)

- **Maestro workspace commands** — chat can now run the app: "use the track analysis" / "use the image analysis" merges analyzer DNA into Suno fields, "take me to polish" / "final step" jumps the guided path. Works offline and via the LLM backend (sanitized command whitelist).
- **Remix & extend in chat** — "remix it" rerolls groove/palette/mood while keeping your genre identity; "extend the track" lengthens the structure (bridge → final chorus → outro) to match Suno's Extend workflow.
- **LLM provider presets** — one-click OpenAI, OpenRouter, Groq, Mistral, Ollama (local), and LM Studio (local) setup in Co-Producer settings; local providers work without an API key. The same backend powers Maestro Chat.
- **Analyzer-aware suggestions** — when a track or image analysis exists, Maestro proactively suggests merging it.

## Highlights (v0.10.0)

- **Maestro — AI Chat Music Creator** — a conversational co-producer panel: describe the track ("dark techno at 140 bpm with whispered vocals") and Maestro sets genres, tempo, mood sliders, vocals, sounds, and lyric direction in the project as you talk. Ask for lyrics, hooks, the ≤1000-char Suno style prompt, or "surprise me". Fully offline heuristic engine with an optional OpenAI-compatible LLM mode (reuses Co-Producer settings); all LLM patches are sanitized to a key whitelist before touching project state. Chat history persists locally (60 turns).
- **Performance & dead-code pass** — loudness re-measurement now keys on the audio source (no full blob re-decode on unrelated edits); removed redundant memoized prompts and unused exports across audio-enhancer, export formats, studio export client, and video handoff.
- **Dependency refresh** — Next, ESLint config, Tailwind, Vitest, Electron 43, and friends bumped to latest patch/minor releases.
- **24 new unit tests** for the Maestro engine (parsing, replies, patch sanitizing, LLM protocol).

## Highlights (v0.9.13)

- **Tauri studio release** — GitHub Actions builds Windows/macOS/Linux installers; tag `studio-v*` to publish ([studio-v0.9.13](https://github.com/Druttzen/ai-music-tool/releases/tag/studio-v0.9.13)).
- **Demucs stem separation** — Track analyzer can call the sidecar `/separate` endpoint and download stem WAVs when the `stems` extra is installed.
- **Native MP3 export (Tauri)** — `dsp-core` encodes MP3 via LAME; Tauri studio export accepts `"mp3"` alongside WAV.
- **Video Creator handoff (Tauri)** — Parity with Electron for opening exported audio in the video workflow.
- **Version sync** — `npm run sync:version` aligns Tauri, dsp-core, sidecar, `package-lock.json`, `APP_VERSION` fallback, and MusicBrainz User-Agent from `package.json`.

## Highlights (v0.9.11)

- **Style-DNA Search** — Search by artist/title, Spotify track URL, or YouTube link; optional Spotify audio features (danceability, energy, valence, tempo, key) map to Suno genres, mood, and paste-ready style tokens. MusicBrainz fallback when Spotify is not configured.
- **Apply Style DNA** — One-click merge into project fields with `REF:` rule line, Goal reference, and guided Polish step.
- **148 unit + 41 e2e tests** — Style-DNA mapper unit tests and MusicBrainz-mocked e2e smoke.

## Highlights (v0.9.10)

- **Shareable project bundles** — Export Bundle JSON includes project snapshot, custom style presets, character voice presets, and studio session; import merges presets and still accepts legacy flat project files.
- **Suno re-import loop** — Paste finished Suno Style/Lyrics, compare vs project-built paste, use pasted fields for Prompt Preview/copy, or apply pasted Lyrics back into generated lyrics.
- **144 unit tests** — project bundle parse/export and Suno re-import diff/override coverage.
- **39 e2e tests** — bundle export/import smoke and Suno re-import panel flow.

## Highlights (v0.9.9)

- **Standard engine preview cleanup** — Prompt Preview and Copy Prompt use the same paste-ready Style/Lyrics slices as Suno-like (comma-separated Style, bracket Lyrics scaffolds) instead of `STYLE:` / `RULES:` blocks.
- **Paste-ready e2e smoke** — Playwright asserts Prompt Preview, Lyric field preview, and clipboard copy contain no `DNA:`, `theme:`, `sounds:`, or section-label wrappers.
- **136 unit + 36 e2e tests** — four new paste-ready preview specs plus existing suite.

## Highlights (v0.9.8)

- **Paste-ready prompt boxes** — Style, Lyrics, analyzer extract, voice style, and guided-path copy blocks output Suno-ready text only (comma-separated Style tokens, bracket Lyrics scaffolds; no `DNA:` / `theme:` / tips in `<pre>` or copy payloads).
- **Voice Character Studio integrations** — Guided Polish step hints, Co-Producer voice context in lyrics/hooks, **Analyze vocal character →** handoff from the track analyzer.
- **Online Suno catalog sync** — `npm run sync:suno-catalog` refreshes meta-tags, structure tags, and trademark guards from [stayen/suno-reference](https://github.com/stayen/suno-reference) into the language index and validation rules.
- **136 unit + 32 e2e tests** — usable Style/Lyrics export, analyzer style prompt, catalog sync, and studio handoff coverage.

## Highlights (v0.9.7)

- **YouTube URL sync on session restore** — linked reference URL shows in the studio input after import, reload, and preset load (draft state only while typing before link).
- **Reset clears voice studio session** — Reset to Default clears active analysis, YouTube ref, and compact lines; saved character presets are kept (like custom style presets).
- **123 unit + 31 e2e tests** — session reload YouTube assertion and Reset-to-Default studio coverage.

## Highlights (v0.9.6)

- **Character preset undo snapshots** — revert restores `characterVoicePresets`; capture before studio import/delete.
- **Studio session in project JSON** — optional `characterVoiceStudioSession` (analysis, compact Style/metatag, YouTube ref, preset name) on export, autosave, import, and undo.
- **123 unit + 30 e2e tests** — session reload and snapshot revert coverage for Voice Character Studio.

## Highlights (v0.9.5)

- **Character presets in project JSON** — optional `characterVoicePresets` on export, manual save, and autosave; restored on import and reload.
- **118 unit + 28 e2e tests** — project import with bundled character presets survives page reload.

## Highlights (v0.9.4)

- **Voice Character Studio hardening** — normalize presets from localStorage; clear stale YouTube refs on load; safe `textureTags` validation on import.
- **Studio UX polish** — compact Style line + lyric metatag copy blocks; YouTube URL field syncs on preset load/clear; hardened preset import (functional merge, read errors, storage checks on regenerate).
- **116 unit + 27 e2e tests** — adds YouTube-clear and compact-metatag Playwright coverage for Voice Character Studio.

## Highlights (v0.9.3)

- **Voice Character Studio** — analyze vocal files for trait-based Suno prompt DNA (register, breath, vibrato, dynamics); optional YouTube metadata link; save/load character presets.
- **Character preset JSON** — export and import character presets as JSON (envelope or bare map); merge into localStorage.
- **115 unit + 25 e2e tests** — Voice Character Studio Playwright coverage (import, load, export, regenerate, vocal analyze).

## Highlights (v0.9.2)

- **Snapshot field extraction** — `pickSnapshotFields` + `useSnapshotFields` slim the workspace provider; snapshot keys live in one place in `project-state.js`.
- **Guided Suno e2e** — Playwright walks factory preset → step navigation → final Style copy under the 1000-character cap (18 e2e tests total).
- **103 unit tests** — adds coverage for `pickSnapshotFields` alongside the existing suite.

## Highlights (v0.9.1)

- **Thin page shell** — `useProjectWorkspaceProvider` orchestrates hooks; `page.jsx` is ~61 lines (layout only).
- **Modular workspace** — pipeline input, workspace value builder, and snapshot helpers split into dedicated modules.
- **E2e workflow coverage** — 17 Playwright tests: audio/image analyzer merge → Suno copy, instrumental → timed lyrics, plus shared test helpers.
- **101 unit tests** — unchanged green suite with release CI running full `npm run check`.

## Highlights (v0.9.0)

- **Architecture refactor** — `useReducer` project state, persistence/actions hooks, three-column workspace layout, and co-producer engine extracted from the main page (~780 lines vs ~2,035).
- **Reliability** — route error boundary, 60s Co-Producer LLM abort/timeout, `safeLocalStorage`, pinned deps, release CI runs full `npm run check`.
- **Performance** — memoized workspace context, `React.memo` on heavy panels, prompt pipeline keyed on analyzer summary only (not waveform peak edits).
- **Tests** — 101 unit tests (audio cache + IndexedDB, co-producer engine, audio analyzer) plus Playwright e2e smoke coverage.

## Highlights (v0.8.4)

- **Reset clears Lyric Style Prompt** — blank placeholder until vocal mode and theme are set; generated lyrics/hooks cleared on reset.
- **E2e + unit tests** for lyric prompt blank slate after Reset to Default.

## Highlights (v0.8.3)

- **Analyzer catalog sync** — audio/image DNA suggestions map to Suno genre/instrument/rhythm pills (BPM-aware).
- **8 new factory presets** — Trap, Pop, Lo-Fi, Reggaeton, Metal, Jazz, Afrobeats, Detroit Techno.
- **Expanded vocal roles** — whispered, raspy, autotuned, duet, crowd chant, stacked harmonies.
- **Co-Producer LLM** — Spanish/non-English section-tag rules in system prompts.
- **Lyric prompt cleanup** — language rules without redundant boilerplate.

## Highlights (v0.8.2)

- **Suno lyric languages** — full language catalog (strong + extended tiers), grouped Language selector, Suno section-tag rules in lyric prompts and Co-Producer.
- **Suno genres & instruments** — ~130 genres, ~150 instruments/textures, searchable grouped pickers; Style Prompt Library still adds 900+ genre-wheel fusion phrases.
- **CI e2e** — Playwright smoke tests run on every push/PR alongside unit tests and build.

## Highlights (v0.8.1)

- **Reset to Default → blank slate** — clears all preselected genres, sounds, rules, and lyrics so you can build step by step from guided step 1 (factory presets stay in the sidebar).
- **Reset e2e test** — Playwright coverage for blank-slate reset behavior.

## Highlights (v0.8.0)

- **Co-Producer Generate Lyrics** — after picking **Lyric Style**, generate editable lyric drafts matched to that style prompt (Another take, stale-style warning, char budget).
- **Style-aware hooks** — hook sketches tied to the same Lyric Style presets.
- **Instrumental → lyrics** — timed scaffold plus Co-Producer singable draft and hooks in one step.
- **Optional LLM backend** — OpenAI-compatible API (key stored locally); falls back to built-in templates.
- **Swedish / mixed language** phrase pools per style.

## Highlights (v0.7.9)

- **Studio export fix** — Electron desktop no longer stalls at 5%; falls back to main-thread export when Web Workers are unavailable on `file://`.

## Highlights (v0.7.8)

- **Lyrics on instrumentals** — after uploading a track, **Add lyrics timed to this track** builds a [Verse]/[Chorus] scaffold locked to BPM, duration, and highlight/drop.
- **Auto vocal switch** — leaves Instrumental mode, merges track DNA, strips “no vocals” rules, and jumps to the Lyric direction step.

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
- **Packaged assets** — `public/bones-logo.webp`, root `icon.ico`, and `build/AI_Music_Creator_README.pdf` included for Electron builds.
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

If folders stay locked (Cursor/Electron holding files), run elevated cleanup — it removes what it can and schedules the rest for delete on next reboot:

```bash
npm run cleanup:dist:admin
```

Old installer output under `dist/` is gitignored; safe to delete locally anytime.

### Electron auto-update

Packaged builds check **GitHub Releases** for `Druttzen/ai-music-tool` on startup. Updates require a published release with `latest.yml` from `electron-builder --publish` (or manual upload). Dev/`npm run electron` skips update checks.

## Production build

```bash
npm run build
```

**Pre-ship check** (unit tests, ESLint, production build, sidecar pytest):

```bash
npm run check:full
```

Full CI parity including Playwright e2e (restarts sidecar):

```bash
npm run check:full:e2e
```

One-shot pre-tag gate (sync versions + `check:full`; add `-E2e` or `-Dist` as needed):

```powershell
npm run ship:preflight
npm run ship:preflight -- -E2e -Dist
```

Quick check without sidecar pytest:

```bash
npm run check
```

`npm run lint` runs ESLint alone.

Static export output is written to `out/` (see `next.config.js` — `assetPrefix: "./"` for Electron-friendly relative assets).

## Desktop (Tauri)

Requires **Rust** (`cargo`), **Tauri CLI**, and a Python **3.11–3.12** venv for the sidecar (see `ai-sidecar/README.md`). On first run, `ensure-sidecar-binary.ps1` builds or copies the sidecar binary.

```bash
npm run tauri:dev
```

Development with sidecar + Tauri webview (same Next dev server as Electron path).

```bash
npm run tauri:build
```

Production installers under `src-tauri/target/release/bundle/`. CI publishes tagged releases as **`studio-v*`** (separate from Electron **`v*`** tags). Every push to `master` also runs a **`tauri-smoke`** compile check (Linux `cargo build` + sidecar bundle).

### Sidecar + Demucs stems

See [`ai-sidecar/README.md`](ai-sidecar/README.md). Quick path:

```bash
npm run bootstrap        # Rust + Python 3.12 if missing (Windows)
npm run sidecar:stems    # one-time torch + demucs install (~2 GB)
npm run sidecar
npm run test:smoke:stems # Demucs UI e2e (slow on CPU)
```

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

The UI reads **`APP_VERSION`** from `package.json` via `NEXT_PUBLIC_APP_VERSION` in `next.config.js`. Bump **`package.json`** `version` for releases, then run **`npm run sync:version`** so Tauri, dsp-core, sidecar, lockfile, and JS fallbacks stay aligned.

## Author

**DJ M@D**

---

_Legacy Next.js starter sections were replaced with this project README as of v0.6.1._
