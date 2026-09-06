# Extracting Fail-Safe Ops to its own repo

Checklist for spinning `@aimc/fail-safe-ops` out of **ai-music-tool**.
Until this happens, Ops stays in-monorepo (`fail-safe-ops/`).

## Keep in ai-music-tool (Runtime)

- `app/lib/fail-safe-runtime-*.js`, panel, listeners
- Sidecar health / maintainer Fix & push endpoints used by Studio
- Cursor rule for Runtime reports in chat

## Move with Ops

| Path today | Role |
|------------|------|
| `fail-safe-ops/` | CLI + local UI shell |
| `scripts/fail-safe-*.cjs` | Diagnose / auto / fix-push / cloud / runtime deliver |
| `.github/workflows/fail-safe-*.yml` | CI diagnose + cloud auto-fix |
| Classifier SoT | Today: `app/lib/fail-safe-bot.js` — **move playbooks into Ops** then re-export thin stubs from the app |

## Target layout (new repo)

```
fail-safe-ops/
  package.json          # @aimc/fail-safe-ops
  bin/fail-safe-ops.cjs
  bin/fail-safe-ops-ui.cjs
  ui/
  lib/classifier.js     # owns FAILURE_PLAYBOOKS after extract
  scripts/              # moved fail-safe-*.cjs
  .github/workflows/
```

## Migration steps

1. Create empty `Druttzen/fail-safe-ops` (or org equivalent).
2. Copy `fail-safe-ops/` + wrapped `scripts/fail-safe-*.cjs` + workflow YAMLs.
3. Move `FAILURE_PLAYBOOKS` / `classifyFailureText` into Ops `lib/classifier.js`.
4. In ai-music-tool: replace `app/lib/fail-safe-bot.js` playbooks with a re-export from the published package (or git submodule / workspace).
5. Point Studio panel **Copy Ops auto** / docs at the Ops package README.
6. Retarget GitHub Actions `repository_dispatch` / cloud fix to the Ops repo.
7. Delete duplicated scripts from ai-music-tool once CI is green on both sides.

## Non-goals until extract

- Full Electron/Tauri Ops desktop app
- Silent Runtime auto-push from end-user installs

See [fail-safe-split.md](../docs/fail-safe-split.md).
