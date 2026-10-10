# Recovered ChatGPT Web phase plan

## Source and limits

Source chat: **App analys och uppbyggnad**.
Conversation ID: `6a7f5f98-a2bc-83eb-88c3-30f9173f5a93`.
Source message ID: `c0123e19-20df-4d97-aae7-3adea8a66039`.
Document title: **FABLE 5 — MASTER BUILD SPEC v1**.
Retrieved on 2026-10-09 using the Codex chat reader.

This is a recovered excerpt, not an approved replacement for the current
FAS 3A–3C hardening plan. The original message describes building a local-first
application from the reference repository. The user confirmed that the intended
plan is in **Fortsätt coolpro2 analysen**, not this FABLE specification. The
excerpt below is retained only as a distinct historical source and must not
drive the current continuation.

The chat reader explicitly marks the source message as truncated at 20,000
characters. Phase 7 below is incomplete. Later phases, if any, are unavailable
in this excerpt. No missing text has been reconstructed or invented.

The other source chat, **Fortsätt coolpro2 analysen**
(`6ab54b60-f6b8-83eb-b72e-43bd950e6b48`), currently returns five recent turns.
Those turns confirm FAS 3A completed/merged, FAS 3B PR #53, and FAS 3C next.
They do not expose the complete earlier phase plan.

## Exact available phase-plan excerpt

# 20. PHASE PLAN

## PHASE 0 — ARCHITECTURE FREEZE

No product feature implementation.

Deliver:

- architecture document
- repository structure
- state schema
- capability schema
- job schema
- snapshot schema
- runtime responsibilities
- dependency policy
- test strategy

STOP GATE 0:

Fable must output the final contracts and identify every unresolved architectural decision.

Do not continue until the contracts are internally consistent.

---

## PHASE 1 — FOUNDATION

Implement only:

- Next.js shell
- React workspace
- Tauri 2
- Rust command bridge
- Python sidecar bootstrap
- sidecar manager
- health endpoint
- capability registry
- project reducer
- Zod project schema
- save/load project envelope
- import/export validation
- logging
- test infrastructure

DO NOT implement:

- MusicGen
- Demucs
- RVC
- DiffSinger
- CLIP
- cover generation
- complex LLM workflows

STOP GATE 1:

The app must:

1. launch as desktop application
2. create a blank project
3. edit project state
4. save project
5. load project
6. export project
7. import project
8. start sidecar
9. detect sidecar readiness
10. report capabilities
11. invoke at least one native Rust DSP command
12. pass unit tests
13. pass integration tests
14. pass desktop smoke test

STOP.

---

## PHASE 2 — CORE AUDIO

Implement:

- file import
- audio metadata
- loudness analysis
- waveform
- native mastering/export
- audio cache
- audio job lifecycle where required

STOP GATE 2:

Given the same test audio, results must be deterministic within defined tolerance.

Do not proceed to AI models until audio handling is stable.

---

## PHASE 3 — ANALYZER ENGINE

Implement:

- tempo
- key
- spectral data
- beat data
- harmonic/percussive ratios
- sonic signature
- genre classification capability

STOP GATE 3:

Analyzer results must:

- validate against schemas
- survive project save/load
- survive export/import
- show capability state correctly
- handle missing model dependencies
- never crash the renderer

---

## PHASE 4 — AI GENERATION

Implement:

- generic generation job interface
- MusicGen adapter
- result artifact handling
- progress
- cancellation
- failure recovery

MusicGen must be an adapter, not hardcoded into the entire application.

Example:

```text
GenerationService
      │
      ├── MusicGenAdapter
      └── future adapters
```

STOP GATE 4:

Generation must be usable even when the generation model is unavailable.

The app must fail gracefully and explain why.

---

## PHASE 5 — STEMS

Implement:

- Demucs adapter
- stem job
- stem artifact registry
- cancellation
- progress

STOP GATE 5:

Stem separation must be independent from the UI implementation.

---

## PHASE 6 — VOCALS

Implement:

- vocal plan
- alignment
- synthesis adapter interface
- RVC adapter
- DiffSinger/OpenVPI adapter
- vocal mix/export

STOP GATE 6:

RVC and DiffSinger must remain replaceable engines behind the same higher-level interface.

---

## PHASE 7 — VISION / COVER

Implement:

- image analysis
- captioning
- tagg

---

**End of available source: truncated during Phase 7.**

