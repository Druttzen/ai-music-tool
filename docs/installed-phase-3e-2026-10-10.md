# Original phase 3E: installed verification

The recovered [original plan](original-web-phase-plan.md) is implemented through
3E. Phase 3F explicitly defers cover persistence; no cover storage was added.

The final NSIS installer exited 0 and the executable was launched from
`B:\AI Music Creator Studio Phase 3E` with isolated test data under
`B:\AI Music Creator Studio Phase Test Final\data`. Tests used the installed
Tauri WebView, not a development server.

## Results

- 640 JavaScript tests passed across 124 files; 153 Python tests passed, one
  skipped and one slow test deselected. Lint, production build, Rust lock checks
  and the 49-schema generated contract check passed.
- Imported the bundle exported by the actual phase 3D app. Generated three new
  variations and restored their history row. All three variations and the
  three-row history remained; the selected numeric ID matched a retained row.
- Imported legacy string IDs while existing separate history was present, saved
  and reloaded. Both persistent history copies retained the imported IDs, the
  selected legacy ID still matched, extension metadata survived, and all three
  variations remained. This test failed before the final import repair.
- Earlier installed iterations verified recovery from individual malformed
  history/variation entries: valid entries loaded, the original was backed up,
  and the whole project was not quarantined. Automated tests also cover failure
  to write that backup without overwriting the original autosave.
- The installed extracted source prompt now contains actual analyzer tags and
  tempo without literal `undefined` values.

Physical tests found and drove fixes for restoring an older history list that
removed the clicked row, new variation snapshots capturing the previous list,
and stale separate history overwriting imports on reload. The entry contracts
are documented in [project-entry-contracts.md](project-entry-contracts.md).

Exit Studio intentionally resets the workspace. Reload retention was tested
with WebView reload, which preserves the session by design.

## Artifact identity

Installed executable SHA256:
`291bb0b022bb64d7bf521fa7f179747aca5c949f007f0dcc048a98b067864b3e`

Installer SHA256:
`e64785184346fa1c2a18635c49ff7516c02cf367cefccede972fef8138dda06a`

Local evidence: ignored `test-results/installed-phase-3e/`, including
`final-variation-restore.json`, `final-import-reload.json`, recovery evidence,
red/green regression results, full check/build logs and `setup-final.exe`.

## Original phase closure

| Phase | Evidence |
| --- | --- |
| 3A cancellation | Inherited cancellation tests plus real MusicGen cooperative cancellation in installed 3D |
| 3B artifacts | Inherited artifact tests and actual public job/audio responses in installed 3C/3D |
| 3C generated contracts | [Installed 3C report](installed-phase-3c-2026-10-09.md) |
| 3D Maestro outcomes | [Installed 3D report](installed-phase-3d-2026-10-09.md) |
| 3E history/variations | This report |
| 3F cover persistence | Deferred by the original plan |

These checks do not claim that every optional model was installed or that local
generation matches a commercial model's musical quality. The user's subsequent
MusicGen quality and Suno data requests are additional work after this baseline.
