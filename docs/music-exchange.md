# Music Exchange

**Music Exchange** is the collaboration boundary between AI Music Creator and other AI Creator projects.

From **Save / Load → Export Music Exchange**, the app downloads:

- `<project>.aimusicbundle.json` with the music project, prompts, presets, and available analysis
- an audio sidecar beside the JSON when the analyzed source is still available in the local cache

The JSON uses bundle format `ai-music-creator-bundle`, version 2. Its `handoff` block declares contract `ai-music-exchange-v1` and describes which music assets are available. Existing importers remain compatible because the established intent wire values are retained.

Music Creator does not discover, configure, or launch consuming applications. This keeps it focused on audio and music while allowing another project to import the portable files through its normal JSON workflow.

Canvas is separate: it remains the only direct application integration and uses [`handoff.json`](canvas-handoff.md) for synchronized audio and artwork.
