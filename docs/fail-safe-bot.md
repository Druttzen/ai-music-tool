# Fail-safe bot

Automatic build/CI failure detection, safe fallbacks, and optional auto-fix for AI Music Creator.

## In-app panel

**Drag & Drop Analyzers** includes a **Fail-safe bot** strip that:

- Monitors sidecar/runtime health
- Shows safe fallback when sidecar is offline (heuristic analyzers still work)
- Lists fix commands you can copy for local dev
- Reminds you to run `npm run fail-safe:run` before push

## CLI commands

| Command | Action |
|---------|--------|
| `npm run fail-safe:run` | Run `check:ci`; classify failure; auto-fix rust locks, eslint, catalog drift once; re-run |
| `npm run fail-safe:run -- --dry` | Classify only — no auto-fix |
| `npm run fail-safe:fetch-ci` | Pull failed GitHub Actions log for current branch |
| `npm run fail-safe:auto` | Format agent prompt from latest CI failure |

### Auto-fix playbooks (safe, idempotent)

| Failure | Auto-fix |
|---------|----------|
| Cargo.lock drift | `cargo build` in `src-tauri` + `dsp-core` |
| ESLint | `eslint . --fix` |
| CC0 catalog drift | `npm run import:awesome-suno` |

Other failures (tests, e2e, pytest) are classified with fix commands but require manual/agent fixes.

## With pre-push hook

```bash
npm run hooks:install   # pre-push → check:ci
npm run fail-safe:run   # stronger: classify + auto-fix + retry
```

Skip hook once: `SKIP_CI_PREFLIGHT=1 git push`

## Agent / Cursor

Paste output of `npm run fail-safe:auto` into Agent chat, or use the fail-safe Cursor rule (install via `npm run fail-safe:install-cursor` when available).

Classified failure kinds live in `app/lib/fail-safe-bot.js` (`FAILURE_PLAYBOOKS`).

## GitHub

`.github/workflows/fail-safe-bot.yml` comments on PRs when CI fails with classified fix hints.

See also: [ci-reliability.md](ci-reliability.md), [sourcery-auto-fix.md](sourcery-auto-fix.md).
