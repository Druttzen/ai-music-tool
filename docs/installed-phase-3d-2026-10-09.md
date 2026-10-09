# Installed original phase 3D — 2026-10-09

## Build and installation

Installed NSIS build into `B:\AI Music Creator Studio Phase 3D`. Launched the
installed `ai-music-studio.exe` with its own working directory and the existing
isolated test data at `B:\AI Music Creator Studio Phase Test Final\data`.
No development web server or checkout executable was used.

Repaired executable SHA256:
`1334d097f1aa57f59eb1f6137efbc88b3b04fe75a8ff66129e97207c9e40cead`

Installer SHA256:
`8001817ed79b3b0aa131d0ab3f04e00540c0946bd439fb8df5a57bff79b0cecf`

## Tests

- The phase gate passed 620 JavaScript tests and 153 Python tests; lint, production
  build and Rust lock verification passed. Python: one skip, one slow deselection.
- The additional embedded-runtime regression passed. All 50 Rust tests passed
  with `--test-threads=1`. A parallel run exposed a pre-existing collision between
  two physical Canvas installer tests staging the same setup file (49 passed,
  one Windows sharing violation); no unrelated production code was changed.
- Actual audio upload, Maestro merge and Polish navigation completed in the
  installed UI. Command outcomes appear on their assistant turns.
- Stopped only the idle ACE API process previously started by this test. The new
  Start local ACE-Step button launched its replacement and health subsequently
  enabled Generate full song. Turbo exists; Quality remains correctly disabled.
- A blank MusicGen description produced a failed command while the independent
  Polish navigation completed.
- A real MusicGen job `083574ee40274e0c` reported started with its real job ID.
  After model download, the installed Cancel generation control stopped it at
  a cooperative generation progress point. Backend confirmed cancelled, no
  error and no artifact. This was not an optimistic UI cancellation.
- A second real job `ff1fa33f103949ae` finished normally. Maestro changed from
  started to completed on the same assistant turn, retained its job ID and
  reported the audio filename, model and duration. The independent navigation
  result remained completed.
- Native playback was unpaused, readyState 4, duration 10 seconds. Saved through
  Rust to `data\exports\phase-3d-musicgen-10sec.wav`: 640044 bytes, 32000 Hz,
  10.0 seconds, all finite samples, RMS 0.344786. This establishes successful
  generation and playable bytes; it is not a claim of musical quality.
- Repeated the actual Measure only export from the installed UI.

## Physical bug found and fixed

Installing MusicGen in embedded CPython failed to import `setuptools.build_meta`
inside pip's isolated dependency build. The embedded `_pth` ignores the isolated
PYTHONPATH overlay. For embedded-runtime installs only, pip now uses the explicitly
installed hatchling, editables, setuptools and wheel backends without build
isolation. Normal venv installs retain their original isolation behavior.

Rebuilt, reinstalled and repeated the actual UI Install action. Encodec, Flashy,
ANTLR and AudioCraft wheels built; installation finished successfully and the
managed sidecar restarted. `from audiocraft.models import MusicGen` succeeds in
the installed runtime. CPU inference is used in this runtime; xFormers reports
its optional compiled CUDA extensions unavailable.

Reference for the managed build requirements:
https://pip.pypa.io/en/stable/reference/build-system/#disabling-build-isolation

## Evidence

Ignored `test-results/installed-phase-3d/` contains installers, build/check logs,
native test logs, screenshots, captured install events and actual public job
responses. Model downloads are real files in the isolated installed cache.
