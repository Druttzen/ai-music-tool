# Fail-Safe Ops

**Future standalone app** for GitHub CI diagnosis, PR/review fallback comments, safe auto-fix playbooks, and cloud fix dispatch.

This folder is a **phase 0–1 scaffold** inside the ai-music-tool monorepo. It is not a shippable Electron/Tauri app yet.

## Product split

| Product | Name | Role |
|---------|------|------|
| **A (this folder)** | Fail-Safe Ops | GitHub auto-fix / review-fallback service |
| **B** | Fail-Safe Runtime | In-app detector in ai-music-tool |

Full plan: [`docs/fail-safe-split.md`](../docs/fail-safe-split.md). Current in-app docs: [`docs/fail-safe-bot.md`](../docs/fail-safe-bot.md).

## Classifier (phase 1)

Shared playbooks still live in **`app/lib/fail-safe-bot.js`** (source of truth).

```js
import { classifyFailureText, FAILURE_PLAYBOOKS } from "./lib/classifier.js";
```

`lib/classifier.js` re-exports that module so Ops can grow without forking heuristics. When Ops becomes its own repo (phase 2), ownership flips: package publishes classifier → ai-music-tool imports it.

## What stays elsewhere (do not move yet)

- CI workflows: `.github/workflows/fail-safe-*.yml`
- CLI: `scripts/fail-safe-*.cjs`
- In-app panel / Fix & push / Runtime reporter

Breaking those would break existing maintainer flows. Extract in phase 2 with green CI.

## Non-goals for this scaffold

- Separate desktop shell
- Network server
- Duplicated playbook regexes
