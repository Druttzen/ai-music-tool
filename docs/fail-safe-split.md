# Fail-safe product split

Architecture plan to divide today’s monolithic fail-safe bot into two products.
See also: [fail-safe-bot.md](fail-safe-bot.md) (current in-repo behavior).

**Status:** Phase 0–1 scaffolded (docs + module boundaries). Full Ops app and live Runtime→GitHub reporting are deferred.

---

## Product names

| Product | Suggested name | One-liner |
|---------|----------------|-----------|
| **A** | **Fail-Safe Ops** | Standalone GitHub auto-fix / review-fallback service |
| **B** | **Fail-Safe Runtime** | In-app background health detector that reports errors for agents |

Alternate labels if branding needs clarity: Ops = “GitHub auto-fix service”; Runtime = “in-app sentry-like detector”.

---

## Today (pre-split)

Everything lives inside **ai-music-tool**:

| Layer | Path | Role |
|-------|------|------|
| Classifier / playbooks | `app/lib/fail-safe-bot.js` | `FAILURE_PLAYBOOKS`, `classifyFailureText`, runtime health report, agent prompt |
| In-app panel | `app/components/fail-safe-bot-panel.jsx` | Health strip, Fix & push, Bug found dialog |
| Hooks | `app/hooks/use-fail-safe-*.js` | Probe, fix-push, dialog session |
| Maintainer auth | `app/lib/maintainer-settings.js` + sidecar `AIMC_MAINTAINER` | Gates Fix & push |
| Sidecar | `ai-sidecar/ai_sidecar/fail_safe_fix.py` | Local fix+push / cloud `repository_dispatch` |
| CLI | `scripts/fail-safe-*.cjs` | `run`, `auto`, `fix-push`, cloud dispatch, PR comments |
| CI | `.github/workflows/fail-safe-*.yml` | Diagnose failed CI; cloud auto-fix |
| Cursor rule | `.cursor/rules/fail-safe-auto-fix.mdc` | Agent auto-fix when chat has fail-safe output |

**In-app Fix & push / Bug found today:** panel probes sidecar health → actionable warn/fail → dialog → maintainer-only sidecar `/fail-safe/fix-push` runs `fail-safe:run` + commit + push `cursor/fail-safe-auto-*` (or cloud workflow). End-user installs without maintainer mode cannot push.

---

## Product A — Fail-Safe Ops

**Scope (moves out over time):**

- CI diagnosis from GitHub Actions logs
- PR / commit comments with classified playbooks
- Safe auto-fix playbooks (Cargo.lock, eslint `--fix`, catalog import)
- Review fallback when Cursor Bugbot / paid review fails (billing)
- Cloud dispatch (`fail-safe-auto-fix.yml` / `repository_dispatch`)
- Maintainer Fix & push orchestration (CLI + future Ops UI)

**Future home:** `fail-safe-ops/` (this repo for now; later its own app / repo).

**Scaffold (phase 0–1):** `fail-safe-ops/README.md` + `fail-safe-ops/lib/classifier.js` re-exporting the live classifier from `app/lib/fail-safe-bot.js` (single source of truth — do not fork playbooks yet).

---

## Product B — Fail-Safe Runtime

**Scope (stays / grows inside ai-music-tool):**

- Background health (sidecar offline, librosa missing, window/`unhandledrejection` errors)
- Classify runtime errors (reuse playbooks where relevant)
- Format a report for maintainers/agents
- Open a **GitHub issue** and/or **agent branch** with the error log
- **No** silent auto-push from end-user installs
- Telemetry / reporting only with explicit consent + feature flag (default **OFF**)

**Scaffold (phase 0–1):** `app/lib/fail-safe-runtime-reporter.js` — payload + branch naming + local queue. Wire is opt-in; GitHub write deferred to phase 3.

---

## What stays vs what moves

### Stays in ai-music-tool (Runtime + thin Ops clients)

- In-app panel, Bug found dialog, runtime health probe
- `fail-safe-runtime-reporter.js` (+ future background listener)
- Sidecar health endpoints used by the panel
- Electron/Tauri packaging of Runtime (not a separate desktop app for users)
- Cursor rule for **agent fix** when a Runtime report appears in chat (alongside Ops CI prompts)

### Moves to Fail-Safe Ops (eventually)

- `scripts/fail-safe-bot.cjs`, `fail-safe-bot-comment.cjs`, `fail-safe-bot-agent.cjs`, `fail-safe-fix-and-push.cjs`, `fail-safe-cloud-dispatch.cjs`, `fetch-ci-failure.cjs`
- `.github/workflows/fail-safe-bot.yml`, `fail-safe-auto-fix.yml` (or call Ops from them)
- Sidecar `fail_safe_fix.py` Fix & push (or Ops replaces it)
- Pure classifier / playbooks once extracted to a shared package Ops owns

### Shared (phase 1)

- Classifier API: keep **`app/lib/fail-safe-bot.js` as source of truth**
- `fail-safe-ops/lib/classifier.js` re-exports it (document reverse ownership in phase 2)

---

## Protocol: Runtime (B) → GitHub

Default path for end-user / consenting reporter installs:

1. **Detect** (local only): window error, unhandled rejection, sidecar fail, classified runtime issue.
2. **Format** payload via `formatRuntimeReportPayload` (issue-ready markdown + metadata).
3. **Queue** locally (`aimc.failSafeRuntime.queue`) — never network-post without consent + enable.
4. **Deliver** (phase 3+, maintainer-configured target repo only):

| Mechanism | When | Notes |
|-----------|------|--------|
| **GitHub Issue** | Default for user-reported runtime | Labels: `fail-safe-runtime`, `needs-agent`, optional severity |
| **Branch** `cursor/runtime-fail-<slug>` | Maintainer / CI agent path | Push error log file + optional minimal repro; open draft PR or leave for Agent |
| **Artifact** | Optional CI attachment | Upload `.fail-safe-runtime-report.md` on issue / workflow |

**Branch naming:** `cursor/runtime-fail-<YYYYMMDD>-<shortHash>` (see reporter).

**Not allowed for Product B on end-user installs:**

- Auto-commit / auto-push to `master` or user forks without maintainer auth
- Calling `/fail-safe/fix-push` or cloud dispatch unless `AIMC_MAINTAINER` + explicit user action

Ops (A) remains the only path that auto-fixes and pushes under maintainer/CI credentials.

---

## Security & consent

| Rule | Detail |
|------|--------|
| Fix & push | Maintainer mode only (`AIMC_MAINTAINER` + repo root / PAT for cloud) |
| Runtime report enable | Default **OFF** — `isRuntimeReportingEnabled()` |
| Telemetry consent | Separate flag — `hasRuntimeTelemetryConsent()`; both required to enqueue |
| No silent network | Phase 0–1 only queues locally; no GitHub API from Runtime yet |
| Secrets | Never put tokens in Runtime payloads; redact env-like strings in logs |
| User installs | May copy report / open issue manually; never push code |

---

## Migration phases

### Phase 0 — Docs + stubs (this PR)

- [x] `docs/fail-safe-split.md` (this doc)
- [x] Point `docs/fail-safe-bot.md` + Cursor fail-safe rule at the split
- [x] `fail-safe-ops/` README + classifier re-export stub
- [x] `app/lib/fail-safe-runtime-reporter.js` + opt-in queue hook
- [ ] Do **not** cut a release; do **not** break existing CI / panel

### Phase 1 — Shared classifier boundary

- [x] Re-export entry: `fail-safe-ops/lib/classifier.js` → `app/lib/fail-safe-bot.js`
- [ ] Optional: thin shared package name (`@aimc/fail-safe-classifier`) when Ops leaves the monorepo
- [ ] Keep all existing imports (`scripts/fail-safe-bot-import.cjs`, tests) unchanged

### Phase 2 — Separate Ops app

- Extract CLI + workflows into Fail-Safe Ops (Electron/Tauri or CLI-first)
- Ops owns playbook source; ai-music-tool depends on published package or git submodule
- In-app Fix & push becomes “open Ops” / “dispatch Ops” for maintainers

### Phase 3 — In-app background reporter

- Window / promise / sidecar listeners behind enable + consent
- Maintainer-configured GitHub issue create (PAT or device flow)
- Agent branch `cursor/runtime-fail-*` for maintainer machines only
- Cursor rule: treat Runtime issue bodies like CI fail-safe prompts

---

## Non-goals (near term)

- Full separate Electron/Tauri Ops UI in this PR
- Moving workflows out of ai-music-tool yet
- Auto-reporting from production user builds without consent
- Duplicating `FAILURE_PLAYBOOKS` into two copies
