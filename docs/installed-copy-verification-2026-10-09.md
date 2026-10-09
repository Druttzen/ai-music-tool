# Installed copy verification — 2026-10-09

This records artifact identity checks. It does not establish completion of the
project phase plan, and no new live app test was run for this report.

## Artifacts

- Worktree: `C:\Users\micke\.codex\worktrees\fas-3e-acestep-lifecycle\ai-music-tool`
- Worktree base commit: `105e49e0d78a51f50a528ceb088fa5c076d2cfe3`; artifact checks used the candidate changes before their local commit.
- Installed test copy: `B:\AI Music Creator Studio Phase Test Final`
- Installer: `src-tauri/target/release/bundle/nsis/AI Music Creator Studio_0.50.49_x64-setup.exe`
- Installer SHA-256: `d070eb744e624813e45c40e7c9b05a627075571df9f0a6e53da448a401662373`
- Installed executable SHA-256: `113f84c1631a0e12ebd06cf8a7a4e354157271d3f7e0ddfb8d947a50b80e2974`

## Checks performed

The following files were read from the worktree, the installed
`resources/ai-sidecar/ai_sidecar` directory, and the installed writable
`data/sidecar/pkg/ai_sidecar` directory. All three copies of each file have the
same SHA-256 hash.

| File | SHA-256 | Bundled copy | Writable runtime copy |
| --- | --- | --- | --- |
| `acestep_lifecycle.py` | `e8dfedd64a0307302d859d51ce24b21f7cb833e7fd706b713f1bb2044e47b38b` | Matches | Matches |
| `main.py` | `a7113ca43433fb6a57c2fe567e922a6d1f00a1c66c40d09e8f3fee6dc6fb2ec6` | Matches | Matches |
| `vocal_env.py` | `0da8b6720807659ca8e9bd5287adddf5d7d581c2687d5329796b7add9137787d1` | Matches | Matches |

The release and installed executables are both 22,561,280 bytes. A complete byte
comparison found exactly three differing bytes, within the Tauri bundle marker:
`__TAURI_BUNDLE_TYPE_VAR_UNK` in the release executable and
`__TAURI_BUNDLE_TYPE_VAR_NSS` in the installed executable. Replacing only that
marker in memory made the complete buffers equal. Neither file was modified.
The locally installed `tauri-bundler-2.9.4/src/bundle.rs` defines that NSIS marker.

The existing screenshot
`B:\AI Music Creator Studio Phase Test Final\after-generation.png` was inspected.
It shows Studio version 0.50.49, `AI sidecar: librosa ready`, and `ACE-Step: ready`.
Its timestamp is 2026-09-26; it is evidence of that earlier session, not current
runtime health or proof that every feature works. The screenshot does not show
the generated audio duration.

## Remaining phase evidence

The authoritative phase plan after FAS 3C has not been located. This candidate
work must not be presented as proof that all planned phases are complete.
GitHub device authorization completed on 2026-10-09. The CLI now reports
`read:project`. Both `gh project list --owner Druttzen --format json` and a
GraphQL query of this repository's `projectsV2` report zero projects.

The user identified `F:\ai-music-tool` as the plan location. A search including
ignored local `.cursor/plans` files found:

- `oss_optimization_5cce3c6b.plan.md`: all tasks marked completed.
- `sibling_apps_reuse_analysis_7f3a9c2e.plan.md`: an older cross-app plan with
  pending tasks. Its direct Video Creator integration conflicts with the
  current `docs/architecture-convergence.md`, which specifies neutral Music
  Exchange exports and Canvas as the only direct visual-app integration.

Neither file defines the continuation after FAS 3C. They are not evidence of a
current complete phase plan, and the older cross-app plan should not silently
replace the current architecture.
