# Publish (Tauri Studio)

End-to-end path from a green tree to a GitHub Release. Primary train: **`studio-v*`**.

One-shot checklist + gates:

```bash
npm run ship:ready -- --print    # checklist only
npm run ship:ready               # sync + check:ci:e2e-subset
npm run ship:ready -- --full     # + sidecar smoke + local tauri:build
```

## Steps

### 1. Start clean

```bash
git checkout master
git pull
git status   # commit or stash before ship:tag
```

Merge open release PRs first (CI green).

### 2. Automated gates

| Command | What it covers |
|---------|----------------|
| `npm run ship:ready` | Version sync + unit/lint/build/pytest/locks + Playwright subset |
| `npm run ship:ready -- --smoke` | Above + `test:smoke` (sidecar must be startable) |
| `npm run ship:ready -- --tauri` | Above + local `tauri:build` (slow; mirrors CI installer) |
| `npm run ship:ready -- --full` | e2e-subset + smoke + tauri:build |
| `npm run ship:preflight -- -E2eSubset` | Same gate family as pre-tag (PowerShell) |

CI already runs the same core gates on every push / PR (`check`, e2e*, `tauri-smoke`).

### 3. Manual Studio smoke

```bash
npm run tauri:dev
```

Or install the local build from `src-tauri/target/release/bundle/` after `--tauri` / `npm run tauri:build`.

Minimum click-through:

- [ ] Sidecar comes up (analyze a track)
- [ ] Waveform / highlight
- [ ] Export or LUFS if you use DSP
- [ ] Vocal Embed plan/synthesize if you ship vocal features
- [ ] Canvas handoff only if AI Canvas Tool is installed; verify Music Exchange download separately

### 4. Optional ML extras

Only if those features matter for this release:

```bash
npm run test:smoke
npm run sidecar:stems && npm run test:smoke:stems
npm run sidecar:generate && npm run test:smoke:generate
npm run test:smoke:vocal
```

### 5. Version bump (if not already)

1. Bump `version` in `package.json`
2. `npm run sync:version` (aligns Tauri / dsp-core / sidecar)
3. Commit on `master` (or your release branch)

### 6. Tag and publish

```bash
npm run ship:tag                 # studio-vX.Y.Z only → tauri-studio-release.yml
npm run ship:tag -- --electron   # also legacy Electron v* (maintenance)
```

`ship:tag` refuses a dirty working tree, runs `check:full --e2e-subset`, creates/pushes the tag(s).

GitHub Actions builds Windows / macOS / Linux installers and creates the Release:

https://github.com/Druttzen/ai-music-tool/releases

### 7. Post-publish verify

- [ ] Release page lists `.exe` / `.msi` / `.dmg` / Linux packages
- [ ] Install Windows build on a clean profile
- [ ] Analyze a track once (managed sidecar)

## What publish does *not* include

- **In-app Studio auto-update** — release builds are signed with `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; `tauri-action` publishes updater archives, `.sig` files, and `latest.json` before making the release public.
- **Electron auto-update** — only applies to legacy `v*` Electron builds.

## Related

| Doc / script | Role |
|--------------|------|
| [desktop.md](desktop.md) | Tauri vs Electron trains |
| [ci-reliability.md](ci-reliability.md) | Local vs CI gates |
| `npm run ship:preflight` | Sync + check:full; optional `-E2e` / `-E2eSubset` / `-Tauri` / `-Dist` / `-TagOnly` |
| `npm run fail-safe:run` | Classify + auto-fix if gates fail |
