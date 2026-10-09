# Original FAS 3C: installed app verification

Original requirements: [recovered web plan](original-web-phase-plan.md).
Implementation: [sidecar contracts](sidecar-contracts.md).

## Automated checks

- Full CI gate: 601 Vitest tests passed; lint, Next production build and Rust
  lock checks passed. Python: 153 passed, 1 skipped, 1 slow test deselected.
- `check:sidecar-contracts`: 48 schemas match the actual Python OpenAPI export.
- Additional CSP regression and generation tests: 7 passed after the physical
  test exposed the blob policy problem.

## Physical installed test

Installed with the built NSIS package into
`B:\AI Music Creator Studio Phase 3C`; installer exited 0. Launched its
`ai-music-studio.exe`, entered Studio through the optional addons screen and
used its managed packaged Python runtime. The previous test data directory was
reused to preserve installed dependencies. Its package stamp was archived to
force the app's normal source refresh.

Worktree, installed resources and running writable package `main.py` hashes
matched. Actual installed HTTP responses: health, presets, vocal model status,
maintainer capabilities and OpenAPI all returned 200. OpenAPI reports 48 schemas
and the new `PublicJobStatus` response model.

Started the real ACE API through the installed sidecar's existing ensure route.
In the app UI, selected Turbo, 30 seconds and disabled LM thinking. Generated
job `34dca23600e7445a`, polled through running to done, downloaded and analyzed
the result through the real sidecar. Public result: ready true, duration 30,
model `acestep-v15-turbo`, format WAV, no filesystem path. Cancellation after
completion correctly returned `done` and retained the artifact.

Both audio elements loaded the 30-second result with readyState 4. Playback was
started and confirmed unpaused. Native export saved the actual result as
`B:\AI Music Creator Studio Phase Test Final\data\exports\phase-3c-30sec.wav`.
Independent inspection: 48 kHz stereo, 30.0 s, finite samples, RMS 0.092725,
peak 0.891251. This verifies functioning audio; it is not a listening-quality rating.

## Failure found and repaired

The installed security policy blocked fetches of the app's own audio blobs.
A `securitypolicyviolation` event confirmed `connect-src` / `blob`. This broke
WaveSurfer and consumers that read preview bytes. Added `blob:` to production
and development connect policies and a regression test, rebuilt the installer,
reinstalled, relaunched, uploaded the saved real WAV and repeated the test.

The repaired installed app reads all 11,520,088 blob bytes; the player reports
30 seconds and readyState 4. WaveSurfer no longer reports the fetch failure.
Native loudness measurement reports -18.4 LUFS and -0.8 dBTP. Clicking the
actual Measure only export button saved
`C:\Users\micke\Desktop\phase-3c-30sec-enhanced-measure.wav` into the configured
export folder. The old app was exited through its Exit button before reinstall.

Final installed executable SHA256:
`9a7b5e3d83f1c42dec38e142c34e177e379682f870318251675250e258672d18`.
Repaired installer SHA256:
`f5eb2d3b5983d9635f3c4d8b60470854153d94ff5544c55ad977250f6ed678ab`.

Evidence and both installers: local ignored `test-results/installed-phase-3c/`
(runtime JSON, job/cancel JSON, before/after blob checks, screenshots and logs).

Follow-up discovered: ACE needs a visible start action when its API is stopped;
the existing ensure route works but the generation button is disabled. Add that
action and test it during the next installed cycle. MusicGen and optional GPU
extras are absent in this test runtime; absence is reported rather than treated
as a successful model test.
