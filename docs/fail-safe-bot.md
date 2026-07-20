# Fail-safe bot

Automatic build/CI failure detection, safe fallbacks, and optional auto-fix for AI Music Creator.

> **Product split (in progress):** Fail-safe is dividing into **Fail-Safe Ops** (GitHub auto-fix / review) and **Fail-Safe Runtime** (in-app detector). Architecture + migration: [fail-safe-split.md](fail-safe-split.md). Existing CLI, CI workflows, and in-app Fix & push remain unchanged until phase 2+.

## Quick setup (one command)

```bash
npm run bots:install
```

Installs pre-push hook + Sourcery + Fail-safe Cursor rules into `.cursor/`.

## In-app fix & push (auto-update path)

Maintainers can **fix code from the app** and push to GitHub so all users receive updates via Electron/Tauri auto-update after merge + release.

### Enable maintainer mode

```bash
npm run sidecar:maintainer
```

Sets `AIMC_MAINTAINER=1` and `AIMC_REPO_ROOT` on the sidecar. In the app, expand **Fail-safe bot** and click **Fix & push**.

Flow:
1. Runs `npm run fail-safe:run` (classify + auto-fix)
2. Commits tracked changes
3. Pushes branch `cursor/fail-safe-auto-*` (or `master` if `AIMC_FIX_PUSH_MASTER=1`)
4. Opens a PR when `gh` is available

### Cloud fix (no local git)

Save a GitHub PAT (repo scope) in the expanded panel, or:

```bash
AIMC_GITHUB_TOKEN=ghp_... npm run fail-safe:fix-push:cloud
```

Triggers `.github/workflows/fail-safe-auto-fix.yml` via `repository_dispatch`.

### CLI

| Command | Action |
|---------|--------|
| `AIMC_FIX_PUSH=1 npm run fail-safe:fix-push` | Local fix + commit + push |
| `npm run fail-safe:fix-push:cloud` | Dispatch cloud workflow |

## In-app panel

**Drag & Drop Analyzers** includes a **Fail-safe bot** strip that:

- Monitors sidecar/runtime health (hydration-safe — shows "checking…" until mounted)
- Surfaces **warn/fail** issues first; expand for informational items
- Shows last scan age and copy-fix commands
- Reminds you to run `npm run fail-safe:run` before push

## CLI commands

| Command | Action |
|---------|--------|
| `npm run fail-safe:run` | Run `check:ci`; classify failure; auto-fix rust locks, eslint, catalog drift once; re-run |
| `npm run fail-safe:run -- --dry` | Classify only — no auto-fix |
| `npm run fail-safe:fetch-ci` | Pull failed GitHub Actions log for current branch |
| `npm run fail-safe:auto` | Format agent prompt from latest CI failure |
| `npm run bots:install` | Hooks + Sourcery + Fail-safe Cursor rules |

Last run summary is written to `.fail-safe-last-run.json` (gitignored).

### Auto-fix playbooks (safe, idempotent)

| Failure | Auto-fix |
|---------|----------|
| Cargo.lock drift | `cargo build` in `src-tauri` + `dsp-core` |
| ESLint | `eslint . --fix` |
| CC0 catalog drift | `npm run import:awesome-suno` |

Other failures (tests, e2e, pytest) are classified with fix commands but require manual/agent fixes.

## Pre-push hook

```bash
npm run hooks:install   # or npm run bots:install
```

| Mode | Command |
|------|---------|
| Default | `check:ci` on push; on fail suggests `fail-safe:run` |
| Auto-fix push | `FAIL_SAFE_PRE_PUSH=1 git push` |
| Skip once | `SKIP_CI_PREFLIGHT=1 git push` |

## Agent / Cursor

Paste output of `npm run fail-safe:auto` into Agent chat, or use the fail-safe Cursor rule (`npm run fail-safe:install-cursor` or `bots:install`).

Classified failure kinds live in `app/lib/fail-safe-bot.js` (`FAILURE_PLAYBOOKS`).

## Review fallback (when paid reviewers fail)

**Cause of `Failed to run review: insufficient funds`:** This message comes from **Cursor Bugbot / Cursor paid review** (billing/credits on the Cursor account). It is **not** Sourcery, Codex CLI, or a GitHub Action in this repo. There is no workflow to disable — Bugbot is a Cursor product feature.

**What fail-safe covers vs a full code review:**

| Path | Role |
|------|------|
| Fail-safe bot | Classifies **CI/build** failures, posts playbook comments on failed PR/master CI, safe auto-fixes (locks, eslint, catalog) |
| Sourcery | Optional PR style/correctness nits when available (free for public OSS) |
| Cursor Bugbot | Paid deep review — skip when billing fails |

**Primary review path when Bugbot fails:**

1. Rely on fail-safe PR comments + `npm run fail-safe:auto` / `fail-safe:run` for CI issues.
2. Paste that output (or the billing error) into Cursor Agent — the fail-safe rule treats insufficient-funds review errors as a signal to diagnose CI and fix.
3. If CI is green, Agent does an in-chat defect review of the branch diff instead of retrying Bugbot.
4. Keep using Sourcery when it posts; do not block on Bugbot.

Optional: top up credits at [cursor.com/dashboard](https://cursor.com/dashboard) if you still want Bugbot later.

## GitHub

`.github/workflows/fail-safe-bot.yml` comments on PRs **and master push** CI failures with classified fix hints. That workflow is the in-repo “review-like” feedback on CI failures; it does not depend on Cursor billing.

## Fail-Safe Runtime reporter (opt-in)

In-app background reporting toward GitHub (issue / `cursor/runtime-fail-*` branch) is scaffolded in `app/lib/fail-safe-runtime-reporter.js`. **Default OFF.** Requires both:

- Enable: localStorage `aimc.failSafeRuntime.reportEnabled=1` or `NEXT_PUBLIC_FAIL_SAFE_RUNTIME_REPORT=1`
- Consent: localStorage `aimc.failSafeRuntime.telemetryConsent=1`

Phase 0–1 only queues formatted payloads locally — no silent network and no auto-push from end-user installs. See [fail-safe-split.md](fail-safe-split.md).

See also: [ci-reliability.md](ci-reliability.md), [sourcery-auto-fix.md](sourcery-auto-fix.md), [fail-safe-split.md](fail-safe-split.md).
