# Security

AI Music Creator is a **local-first** prompt studio. This document summarizes how secrets, network exposure, and optional ML stacks are handled.

## Reporting issues

Open a [GitHub issue](https://github.com/Druttzen/ai-music-tool/issues) with **Security** in the title for suspected vulnerabilities. Do not paste live API keys.

## API keys and credentials

| Storage | Keys | Included in project export? |
|---------|------|----------------------------|
| `localStorage` | Co-Producer LLM (`apiKey`), Style DNA (Spotify/AudD) | **No** — project autosave uses `SNAPSHOT_FIELD_KEYS` only |
| `sessionStorage` | Maintainer GitHub PAT (fail-safe cloud / Runtime deliver) | **No** — session only; cleared when the tab closes |
| Project JSON / bundle | Genres, lyrics, presets, voice profiles | Yes (creative data only) |

**Reset to Default** clears Co-Producer LLM and Style DNA keys via `clearStoredCredentials()`. Export shows a reminder when credentials are still stored locally. Maintainer PATs are never written to `localStorage` (legacy values are migrated once into `sessionStorage` then removed).

Never commit `.env` files or paste keys into issues.

## AI sidecar (localhost)

The Python sidecar binds to **127.0.0.1:8723** by default. It has **no user accounts**; security relies on loopback binding and optional token auth.

### Optional token (`AIMC_SIDECAR_TOKEN`)

When set, all routes except `/health`, `/docs`, and `/openapi.json` require header:

```http
X-AIMC-Sidecar-Token: <token>
```

- **Tauri Studio** generates a token when spawning the managed sidecar and passes it to the webview over IPC (`SidecarStatus.auth_token`).
- **Manual dev** (`npm run sidecar`) leaves the token unset — backward compatible for browser dev.
- **MCP stdio bridge** (`ai_sidecar/mcp_stdio.py`) reads `AIMC_SIDECAR_TOKEN` from the environment when calling the sidecar.

Threat model: protects against **other local processes** on the same machine calling the sidecar. It does not protect against malware running as the same user.

## Desktop CSP (Tauri)

Tauri Studio uses a restrictive Content-Security-Policy (see `src-tauri/tauri.conf.json`): scripts and styles from `'self'`, `connect-src` limited to localhost sidecar and GitHub release checks.

## MusicGen / Audiocraft

MusicGen weights are **CC-BY-NC** (non-commercial). The sidecar and UI warn before generation. Do not use generated audio commercially without a separate license from Meta.

## Release trains

Two tag families can ship installers:

| Tag | Target | How to ship |
|-----|--------|-------------|
| `studio-v*` | Tauri Studio (**primary**, default) | `npm run ship:tag` |
| `v*` | Legacy Electron (deprecated) | `npm run ship:tag -- --electron` or manual `release.yml` |

Both run `npm run check:full` (unit + lint + build + sidecar pytest) before building.

**Updates:** Electron `v*` builds use `electron-updater`. Studio `studio-v*` builds require installing the new package from Releases until a Tauri updater is configured.

## Electron sunset

Electron is deprecated. Default `ship:tag` no longer pushes `v*` (as of post-0.50.2 process). Use Studio installers (`studio-v*`). See [docs/desktop.md](docs/desktop.md) and [docs/architecture-convergence.md](docs/architecture-convergence.md).
