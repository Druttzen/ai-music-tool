# Sourcery auto-fix setup

Automatically forward Sourcery AI PR reviews to the agent and apply fixes.

## What is configured in this repo

| Layer | Purpose |
|-------|---------|
| `.cursor/rules/sourcery-auto-fix.mdc` | Agent always implements Sourcery issues when review text appears in chat |
| `.cursor/hooks.json` | Prepends auto-fix instructions when you paste Sourcery comments |
| `npm run sourcery:fetch` | Pulls latest `@sourcery-ai[bot]` comments from the open PR for current branch |

## Manual workflow (local)

```bash
npm run sourcery:fetch
```

Copy the output into Agent chat, or say: **"apply sourcery review"** after running fetch.

The hook fires automatically when your message mentions Sourcery / `issue_to_address`.

## Pre-push (optional)

Install git hooks so pushes run CI gates first:

```bash
npm run hooks:install
```

## Fully automatic (Cursor Automation — recommended)

Use a **Cursor Automation** so a cloud agent runs when Sourcery comments on a PR:

1. Open **Cursor → Automations → New**
2. **Trigger:** GitHub → Pull request → **Comment added**
3. **Repo:** `Druttzen/ai-music-tool`
4. **Tools:** Comment on PRs
5. **Instructions:**

```
When the new PR comment is from sourcery-ai[bot] (or the body contains "Prompt for AI Agents" / issue_to_address):

1. Read every actionable issue in the Sourcery review.
2. Check out the PR branch and implement minimal fixes.
3. Run npm run check:ci (add check:ci:e2e-subset if e2e files changed).
4. Commit, push to the PR branch.
5. Reply on the PR with a short summary of fixes.

Skip Sourcery marketing/engagement text. Do not merge unless CI is green.
```

Enable **Cloud Agent** in the automation if you want this to run without the desktop IDE open.

## npm scripts

| Script | Action |
|--------|--------|
| `npm run sourcery:fetch` | Print Sourcery review text for current branch PR |
| `npm run check:ci` | Local CI gate before push |
| `npm run hooks:install` | Install pre-push `check:ci` hook |
