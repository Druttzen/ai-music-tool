# Fail-Safe Ops

**CLI-first** GitHub CI diagnose / auto-fix / review-fallback service (Product A),
plus a **local UI shell** (`ui`) for paste-and-diagnose.

Lives in the ai-music-tool monorepo for now. Full Electron/Tauri Ops app and
workflow extraction remain deferred.

## Commands

From repo root:

```bash
# Classify a CI failure log
gh run view <id> --log-failed | npm run fail-safe-ops -- diagnose -

# Safe auto-fix once (Cargo.lock / eslint / catalog)
npm run fail-safe-ops -- run
npm run fail-safe-ops -- run -- --dry

# Fetch CI failure + agent fix prompt
npm run fail-safe-ops -- auto

# Maintainer fix + push
npm run fail-safe-ops -- fix-push

# Deliver a Runtime report JSON as a GitHub issue (+ optional --branch / --pr)
npm run fail-safe-ops -- deliver-runtime report.json
npm run fail-safe-ops -- deliver-runtime report.json -- --branch
npm run fail-safe-ops -- deliver-runtime report.json -- --pr

# Local Ops shell (http://127.0.0.1:8787)
npm run fail-safe-ops -- ui
npm run fail-safe-ops -- ui -- --port 8790
```

Wrappers call existing `scripts/fail-safe-*.cjs` so CI workflows stay unchanged.

## Classifier

Shared playbooks still live in **`app/lib/fail-safe-bot.js`**.

```js
import { classifyFailureText } from "./lib/classifier.js";
```

## Product split

| Product | Name | Role |
|---------|------|------|
| **A (this folder)** | Fail-Safe Ops | GitHub auto-fix / review-fallback |
| **B** | Fail-Safe Runtime | In-app detector (`app/lib/fail-safe-runtime-*.js`) |

Plan: [`docs/fail-safe-split.md`](../docs/fail-safe-split.md).

## Extract to separate repo

See [`EXTRACT.md`](EXTRACT.md) for the migration checklist (workflows, classifier ownership, Studio stubs).
