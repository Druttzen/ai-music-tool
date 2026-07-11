# CI reliability

GitHub Actions runs many parallel jobs. Most **avoidable** failures come from:

1. **Stale `Cargo.lock`** — adding a Rust dependency without updating the lockfile breaks `tauri-smoke` (`cargo build --locked`).
2. **Skipping local gates** — pushing before `npm run check:full` or e2e subset.

## Local gates

| Command | What it runs |
|---------|----------------|
| `npm run check` | Unit + lint + build |
| `npm run check:full` | Above + sidecar pytest + **rust lockfile verify** |
| `npm run check:ci` | Same as `check:full` (pre-push default) |
| `npm run check:ci:e2e-subset` | `check:ci` + Playwright release subset |
| `npm run check:rust-locks` | Fast `cargo metadata --locked` on `dsp-core` + `src-tauri` |

Install the pre-push hook:

```bash
npm run hooks:install
```

Skip once: `SKIP_CI_PREFLIGHT=1 git push`

## Fixing lockfile drift

If `npm run check:rust-locks` fails:

```bash
cd src-tauri && cargo build    # or dsp-core
git add src-tauri/Cargo.lock
```

## CI job map

| Job | Purpose |
|-----|---------|
| `check` | `check:full` (unit, lint, build, pytest, rust locks) |
| `tauri-smoke` | Full Tauri compile on Linux |
| `e2e-subset` | Release Playwright subset |
| `e2e` | Full Playwright suite |

When `check` fails, fix before waiting on slower e2e jobs.

## Fail-safe bot

`npm run fail-safe:run` runs `check:ci`, classifies failures, and auto-fixes rust lock drift / eslint / catalog drift once before retrying.

See [fail-safe-bot.md](fail-safe-bot.md) for in-app panel, GitHub PR comments, and agent prompts.
