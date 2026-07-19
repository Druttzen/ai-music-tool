# Sourcery auto-fix setup

Automatically forward Sourcery AI PR reviews to the agent and apply fixes.

## What is configured in this repo

| Layer | Purpose |
|-------|---------|
| `cursor-settings/sourcery-auto-fix/` | Tracked source for rule + hook (`.cursor/` is gitignored) |
| `npm run sourcery:install-cursor` | Copies rule/hook into `.cursor/` and merges `hooks.json` |
| `npm run sourcery:fetch` | Pulls latest `@sourcery-ai[bot]` comments from the open PR for current branch |
| `npm run sourcery:auto` | Prints a full agent prompt (fetch + auto-fix instructions) |

When **Cursor Bugbot** fails with `Failed to run review: insufficient funds`, use **fail-safe** as the review/fix path instead (`npm run fail-safe:auto`). Sourcery auto-fix still applies when Sourcery comments are present. See [fail-safe-bot.md](fail-safe-bot.md#review-fallback-when-paid-reviewers-fail).

After clone or pull, run once:

```bash
npm run sourcery:install-cursor
```

## Manual workflow (local)

```bash
npm run sourcery:auto
```

Copy the output into Agent chat (the hook and rule auto-trigger fixes when Sourcery text is present).

Or paste a Sourcery PR comment directly — the `beforeSubmitPrompt` hook prepends auto-fix instructions.

## Pre-push (optional)

Install git hooks so pushes run CI gates first:

```bash
npm run hooks:install
```

## Fully automatic (Cursor Automation — recommended)

A **Cursor Automation** draft is available in the repo (open via Cursor → Automations):

- **Trigger:** GitHub → Pull request → **Comment added**
- **Repo:** `Druttzen/ai-music-tool`
- **When:** comment from `sourcery-ai[bot]` or body contains Sourcery review markers

The agent checks out the PR branch, implements fixes, runs `npm run check:ci`, pushes, and replies on the PR.

Enable **Cloud Agent** if you want this without the desktop IDE open.

## npm scripts

| Script | Action |
|--------|--------|
| `npm run sourcery:install-cursor` | Install rule + hook into `.cursor/` |
| `npm run sourcery:fetch` | Print Sourcery review text for current branch PR |
| `npm run sourcery:auto` | Fetch + format agent prompt for auto-fix |
| `npm run check:ci` | Local CI gate before push |
| `npm run hooks:install` | Install pre-push `check:ci` hook |
