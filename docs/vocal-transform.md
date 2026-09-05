# Vocal region transform

Transform **selected time ranges** on the vocal stem of an existing mix
(e.g. a Suno export), then export a remixed full track and/or a parallel
acapella with only the new vocals.

## Pipeline

1. Demucs stem separation (`npm run sidecar:stems`)
2. Apply effect / RVC only inside the chosen regions (with short crossfades)
3. Remix transformed vocals + instrumental stems

## Modes

| Mode | Needs | Effect |
|------|-------|--------|
| `pitch` | stems | Pitch shift (semitones) |
| `formant` | stems | Crude formant shift |
| `robot` | stems | Ring-mod style robotic timbre |
| `rvc` | stems + RVC | Voice conversion (`sidecar:vocal-rvc` or `AIMC_RVC_API_URL`) |

## API

`POST /vocal-transform` (multipart):

- `file` — mix WAV/MP3
- `mode` — `pitch` \| `formant` \| `robot` \| `rvc`
- `regions_json` — JSON array of `{ "start_sec": number, "end_sec": number }` (empty = whole track)
- `pitch_semitones` — float (RVC / pitch / formant)
- `formant_shift` — float (formant mode)
- `output` — `remix` \| `vocals` \| `both` (default)

Primary response is the remix WAV (or vocals-only when `output=vocals`).
When both are produced, headers include:

- `X-Vocal-Transform-Vocals-Url` → `/vocal-transform/download/{job_id}/vocals`

Also: `GET /vocal-transform/download/{job_id}/remix|vocals`.

`/health` exposes `vocal_transform_available` when Demucs is installed.
