# Installed offline drafts and current Suno data — 2026-10-10

Version 0.50.50 was built, installed by NSIS (exit 0) and launched from
`B:\AI Music Creator Studio Offline Drafts\ai-music-studio.exe`, initially PID
38776; the controls repair was installed as PID 40472, and the final audio
cache repair was installed and launched as PID 43724 via `Starta offline studio.cmd`.
It uses isolated data under `B:\AI Music Creator Studio Phase Test Final\data`.
All physical interactions used the installed Tauri WebView.

## Installation and generation

The first same-version 0.50.49 install reused old cached Python sources.
Advancing the product/package version to 0.50.50 refreshed them automatically.
The installed `pkg/ai_sidecar/musicgen.py` SHA256 now matches the source:
`56343725ef8a15e898c7f1df55f90ff8266ded847642524551fb2397488723c8`.
Health reports version 0.50.50, CUDA 12.8, PyTorch 2.7.1+cu128 and an
RTX 4070 SUPER with 12 GB VRAM. No cache stamp was manually forced for the
successful 0.50.50 installation.

Both `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` were set before launch.
Models and dependencies were cached beforehand. This checks cached local
model operation, not an OS-wide network disconnect.

The actual UI defaults were 30 seconds, Stereo Small and style replacement
unchecked. The prompt was:

> French house instrumental, 121 bpm, syncopated electric bass,
> four-on-the-floor drums, filtered disco chords, warm analog synths,
> clean punchy mix

Seed 123, temperature 1, guidance 3, top-k 250, top-p 0.

Job `e7b5ae2aae8443b2` completed with the actual checkpoint
`facebook/musicgen-stereo-small`. Independent file inspection found:

| Measurement | Result |
| --- | --- |
| Duration | 30.0 seconds |
| Sample rate | 32,000 Hz |
| Channels / WAV encoding | 2 / PCM24 |
| Finite samples | All |
| Peak / RMS | 0.95000005 / 0.24161496 |
| Left/right correlation | 0.30557731 |
| Side RMS | 0.14513334 |
| Analyzer tempo estimate | 120.97 BPM |

The nonzero side signal confirms stereo was retained. The tempo is an
estimate, not proof of similarity to a specific song. The player loaded the
30-second audio with readyState 4 and playback advanced, reaching the end
without a media error. The original empty project style remained unchanged.

## Native export and Suno reference

Clicked **Export audio + Suno brief** in the installed UI. It created
`suno-draft-1791616000747.wav` (5,760,044 bytes) and the accompanying text
brief (1,217 bytes) in the isolated exports folder. The brief retains the
prompt, model, duration and sampling settings. The exported audio SHA256
matches the original job artifact exactly:
`10f8aed898347eeba978e081d3aa53ea968b36144ea61522f5144ee1f24eb657`.
The separate saved audition file is `offline-small-30sec.wav`.

Opened the installed Suno reference panel and checked its v6 models,
dated updates, upload guidance and source links. Public product facts and
catalog refresh are documented in [suno-data-2026-10-10.md](suno-data-2026-10-10.md).

## Larger checkpoint

The explicit Stereo Medium five-second job `6d9ff47b36d1424a` completed with
`facebook/musicgen-stereo-medium`. Independent inspection confirmed five
seconds, 32 kHz, stereo PCM24, all finite samples and a nonzero side signal.
It did not silently use Small.

The pre-repair 30-second job `ba70ac1fedcc4dca` also completed using Stereo
Medium. The analyzed tempo was 121 BPM. Its output is `offline-medium-30sec.wav`:
30 seconds, 32 kHz, stereo PCM24, finite samples, peak 0.95000005, RMS
0.19373729, side RMS 0.15353408. Left/right correlation was -0.25949275;
this wide output warrants a listening check in mono before a final mix.
No claim of superior musical quality follows from these measurements.
This take inherited analyzer report wording and a randomized seed because
of the player-mount issue, so it is not a controlled comparison with Small.

The installed UI exported this take as `suno-draft-1791616408462.wav` plus
its text brief. The audio SHA256 matches the job artifact:
`1cc6c76b776e0f41b8e74d489b8e4fbd0aa2ad48e3e1265d8f96cc565fa66e19`.
Native playback advanced without a media error. GPU memory was nearly full
during the larger-model test; success here is not a guarantee on another
machine or with additional models occupying VRAM.

## Checks and artifact identity

650 JavaScript tests passed across 127 files; lint passed. The full backend
gate passed 161 Python tests, one skipped and one deselected. Production
build, generated contracts (49 schemas) and Rust lock checks passed.
The version change was followed by a successful Tauri build and contract/lock
checks. A later physical test discovered the initial player mount resetting
generation controls, including the explicit seed. Restoring recorded take
settings and excluding generated report labels from subsequent prompts fixed
this; regression tests cover the issue.

A reload test also found that generated audio had never been written into
the existing local audio cache, despite its analysis being persisted. The
generation hook now caches MusicGen and ACE-Step audio before attaching it;
cache failures preserve the current playable result and show an export warning.
An IndexedDB integration regression confirms retrieval from serialized analysis
without a temporary player URL, and covers unavailable storage.

The repaired controls were verified with job `041ce884732b4596` (Small, five
seconds): after the first player mount, prompt, seed 123, model and duration
were preserved. Job `f3b3c87f61ea4c98` then produced 30 seconds with Stereo
Medium using the exact original French house prompt and seed 123. Its saved
file is `offline-medium-30sec-final.wav`, stereo PCM24 at 32 kHz, with finite
samples, RMS 0.19208255 and left/right correlation 0.45203032. The installed
Suno export `suno-draft-1791617235161.wav` and brief retained these settings;
the exported audio matches the job artifact SHA256:
`53b846d018c1a610258e79c2179028b68f056ee2409ef2cad86528a87c7fc048`.
These controlled takes verify the workflow and tempo, not Suno quality parity.

The final cache-repaired installation generated another 30-second Stereo Small
take, job `d413f1886b7443b2`, with the original prompt and seed 123. Its audio
is byte-identical to the earlier Small take (SHA256 `10f8aed898347eeba978e081d3aa53ea968b36144ea61522f5144ee1f24eb657`).
After a real WebView reload, the local cache restored both players at duration
30 and readyState 4, and restored prompt, model, duration and seed 123 in the
controls. Playback advanced without a media error. The installed UI then
exported the restored audio as `suno-draft-1791617889811.wav` plus its correct
brief; its hash still matched the original job artifact. This closes the
observed audio-persistence defect. The final audition copy is
`offline-small-30sec-final.wav`.

`Starta offline studio.cmd` in the installed folder reuses this isolated,
prepared GPU runtime and cache; it was used to launch the final app. Launching
the executable with a different data directory may require dependencies and
model downloads again. The final app remains open for auditioning.

Installed executable SHA256:
`500f7c73d35610c0a635d068b051a5637c2e8a4cb8064469e6c59e21174fce52`.

Installer SHA256:
`2b289065b54d4cb6ffd7c5a3f8b25423872f6f2124b1e0108f82fa653f6bb0a0`.

Local evidence is in ignored `test-results/offline-suno/`: build/check logs,
installed job results, audio measurements, source/artifact hashes, playback
and style-retention proof, and the rendered Suno reference text.

The isolated runtime received CUDA dependencies separately; the installer
does not automatically upgrade every CPU installation to these CUDA wheels.
Successful generation, stereo retention and tempo estimates do not establish
Suno v6 quality or vocal equivalence. The authorized Suno account inspection
currently requires the user to finish signing in; no account songs were
claimed as analyzed and no Suno generation/upload was performed.
