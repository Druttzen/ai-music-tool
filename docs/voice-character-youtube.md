# Voice Character Studio — YouTube reference

Voice Character Studio can link a **YouTube URL** as a stylistic reference (not for impersonation). The app resolves metadata and optional sonic DNA through the AI sidecar.

## Requirements

1. **AI sidecar running** — `npm run sidecar` or Tauri auto-spawn.
2. **yt-dlp on PATH** (recommended) — richer title/artist parsing and sonic signature download.
3. **ffmpeg on PATH** — required when sonic signature analysis runs on downloaded audio.

### Install yt-dlp

**Windows (winget):**

```powershell
winget install yt-dlp
```

**macOS (Homebrew):**

```bash
brew install yt-dlp
```

**Linux (pip):**

```bash
python3 -m pip install -U yt-dlp
```

Verify:

```bash
yt-dlp --version
```

## Workflow in the app

1. Open **Voice Character Studio** in the workspace.
2. Paste a YouTube watch or `youtu.be` URL in the reference field.
3. Click **Link YouTube reference** — the sidecar calls `POST /youtube/resolve`.
4. Optional: **Apply Music DNA** uses `POST /youtube/sonic-signature` (downloads a short preview via yt-dlp, analyzes with librosa).
5. Compact voice style + lyric metatag blocks update; session persists in localStorage and project bundle export.

## Sidecar endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /youtube/resolve` | Title, artist parse, thumbnail, duration |
| `POST /youtube/sonic-signature` | BPM/key/energy fusion for replication pack |

If yt-dlp is missing, resolve falls back to oEmbed (metadata only — no sonic download).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Sidecar unavailable” | Start sidecar; check `http://127.0.0.1:8723/health` |
| Link succeeds but no sonic merge | Install yt-dlp + ffmpeg; retry Apply Music DNA |
| Age-restricted / blocked videos | yt-dlp may need cookies — use a public/unlisted reference clip |
| CI / headless | E2e uses mocked resolve; live sonic tests skip without deps |

## Tests

- Unit: `tests/youtube-music-dna.test.js`, `ai-sidecar/tests/test_youtube_resolve.py`
- E2e: `tests/e2e/voice-character-studio.spec.js`
