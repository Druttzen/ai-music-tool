# Style catalog research features

Shipped research helpers for Suno v5.5-style prompting. All run **locally** in the browser — no extra API keys.

## Where to find them

Open **Style Prompt Library** (`suno-english-style-prompt-picker.jsx`) or use Maestro Chat surprise rolls.

| Feature | Module | UI / trigger |
|---------|--------|----------------|
| BPM evocative descriptors | `app/lib/tempo-descriptors.js` | Auto-appended to Suno Style paste when tempo is numeric only |
| Negative guard packs | `app/lib/suno-negative-guards.js` | Instrumental / anti-mud rules in guided Style line |
| Era-anchored genres | `app/lib/style-catalog-extensions.js` | **Era anchors** quick picks |
| 2026 trend micro-genres | `app/lib/style-catalog-extensions.js` | **2026 trends** quick picks |
| Metaphor style rolls | `app/lib/metaphor-style.js` | **Metaphor roll** button; Maestro offline surprise |

## Tempo descriptors

`formatTempoWithDescriptor("128 BPM")` → `128 BPM, driving and upbeat`

Used in `buildSunoPastedStyleLine` when the tempo string lacks an adjective.

## Negative guards

`selectNegativeGuards({ vocal, rules, max: 3 })` adds instrumental anti-vocal phrases without bloating the Style cap.

## Era & trend catalogs

Merged into `style-prompt-catalog.js` lazy chunks. Maestro catalog grounding (`maestro-catalog-grounding.js`) can retrieve entries for LLM context when Co-Producer LLM is enabled.

## Metaphor rolls

`rollMetaphorStyle()` picks a creative production metaphor (e.g. “neon rain on glass”) for one-shot Style experiments.

## Tests

- `tests/roadmap-v0.13.5.test.js` — tempo, guards, era/trend IDs, metaphor
- `tests/awesome-suno-catalog.test.js` — catalog import integrity
- `tests/maestro-catalog-grounding.test.js` — retrieval for Maestro

## Related

- [panel-inventory.md](./panel-inventory.md) — guided panel map
- [voice-character-youtube.md](./voice-character-youtube.md) — YouTube reference + yt-dlp
