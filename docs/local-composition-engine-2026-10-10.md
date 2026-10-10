# Local learned composition engine — 2026-10-10

## What public evidence says about Suno

[Suno CEO Mikey Shulman's January 2025 interview](https://www.amplifypartners.com/barrchives/how-suno-builds-ai-models-for-musicians)
describes Transformer architecture, autoregressive generation, substantial work on audio tokenization,
and user comparisons as training signals. This is historical first-party testimony, not a disclosed
v6 specification. No publicly verified v6 weights, parameter count, full architecture or reproducible
training recipe were recovered. A client's JavaScript/WASM cannot expose unpublished server weights.

The engineering inference is to invest in learned musical generation, token planning, training data
and human preferences. GPU inference speed and offline execution alone do not establish musical
parity with Suno v6. We have not trained a new foundation model or demonstrated that parity.

## Implemented in 0.50.56–0.50.58

`AI composition from prompt` enables the trained ACE-Step 5Hz LM. For an instrumental idea,
`/format_input` develops its description and arrangement with duration/tempo/key constraints.
For a vocal idea without supplied lyrics, `/v1/create_sample` creates lyrics first and the formatter
then receives the requested duration. The installed vocal test exposed overlong proposed lyrics;
0.50.57 supplies duration and a sung-word budget at creation time too. The installed test showed that
instructions alone were insufficient: a later run returned 132 space-delimited words in Chinese for
an English idea, whereas the earlier English plan had 127 words. Version 0.50.58 adds an explicit
vocal-language selector, defaults unspecified vocal composition to English, and validates generated
language metadata, language tags, incompatible Chinese characters for selected Latin languages, and
the word budget (two words per requested second). It attempts at most three proposals and rejects
unsuitable output before audio generation. Accepted generated words are preserved through formatting.
These checks do not prove linguistic accuracy, singing alignment or a musically complete ending.
Supplied lyrics remain unchanged in the generation input.

The original musical direction plus expanded caption, lyrics/directions and musical metadata drive ACE-Step generation with
`thinking=true`, which requests semantic audio-code planning before the DiT renders the audio.
Caption/language rewriting inside the second stage is disabled to keep the saved plan as its input.
The selected loaded LM is explicitly forwarded. Windows uses PyTorch; managed servers prefer a
complete cached 1.7B checkpoint and enable CPU offload. Existing external server selection remains
under its owner's control. Missing/disabled LM or failed composition is an error, with no template
substitute or silent switch to direct generation.

The development run's formatter emphasized chiptune when the idea also requested trance. The original
direction is therefore retained in the actual generation prompt ahead of the expanded arrangement.
This avoids losing the user's instructions but does not prove that the model follows every instruction.

The request preserves the original idea, chosen duration, seed and musical constraints. The public
plan includes the loaded planner identity and the LM identity reported by the completed audio task
(empty when the server does not report it). Suggested and requested duration are separate. The seed
controls audio generation; the upstream API does not expose a deterministic formatter seed, so a
repeated idea need not create the same plan. A proposed arrangement is guidance, not verified
transcription of the rendered song. No subjective quality score or v6 equivalence is inferred.

Plan, audio and settings survive workspace save/reload; the portable Suno handoff includes the plan.
Nothing is uploaded to Suno by this feature.

Primary implementation references:

- [ACE-Step 1.5 source and architecture](https://github.com/ace-step/ACE-Step-1.5)
- [ACE-Step paper](https://arxiv.org/abs/2602.00744)
- Installed source: `F:\ACE-Step-1.5\acestep\api\http\sample_format_routes.py`
- Installed source: `F:\ACE-Step-1.5\acestep\api\llm_generation_inputs.py`

## Hardware and further model work

This machine has an RTX 4070 SUPER with 12 GB VRAM, Ryzen 9 5900X and 64 GB RAM. Both 0.6B and
1.7B planners are cached. The 1.7B planner was explicitly initialized through the idle local server's
official API and returned a developed instrumental caption, section directions, 130 BPM, F major
and the requested 30-second duration. Earlier SFT comparison runs had LM thinking disabled.

Further work toward stronger musical composition needs a curated dataset with usable rights,
prompt/arrangement annotations, held-out musical evaluations and listener preferences, followed by
actual fine-tuning and evaluation. Changing inference settings or adding an interface is not training.
Larger open architectures must be profiled on this hardware before promising an offline deployment.

## Validation

Automated validation: 663 frontend tests in 128 files; 191 Python tests passed, one skipped and one
deselected. Lint, generated contracts (53 schemas), Next production build, Rust build and both Windows
installers passed. Checks include LM failure, constrained duration, preserved lyrics, vocal planning,
cancellation before submission, managed startup and typed plan access.

Physical 0.50.56 validation used `B:\AI Music Creator Studio Offline Drafts\ai-music-studio.exe` with
the offline launcher and existing cached models. The installed title and sidecar health both reported
0.50.56/CUDA. No reference audio or track DNA was sent in these generation requests.

| Installed job | Prompt task | Result |
| --- | --- | --- |
| `2e9bfd85a54d4eac` | Synthpop, AI-written English vocals | 30s SFT, 50 steps, seed 124, LM thinking on; both planner and audio task reported 1.7B LM |
| `73018b46f783425b` | Heroic instrumental trance | 30s SFT, 50 steps, seed 123; learned plan returned 120 BPM, D minor and arrangement directions |
| `281f8979979543c4` | Cancellation during composition | Cancelled cooperatively before audio submission; previous cached take retained |

Native playback advanced to 2.330667s for the vocal draft and 2.210667s for the instrumental draft,
with `readyState=4` and no media errors. Both WAV exports are 48 kHz stereo, exactly 30s, finite
samples, peak 0.89125. The exported briefs use the composition's actual direction/lyrics and retain
the learned plan, rather than unrelated earlier project tags.

- Vocal export: `B:\AI Music Creator Studio Phase Test Final\data\exports\suno-draft-1791636132409.wav`
  SHA256 `46f597cdc457fe4169f24b2deddd8eac685689a1058660a18d222d19ca42126d`
- Instrumental export: `B:\AI Music Creator Studio Phase Test Final\data\exports\suno-draft-1791636310827.wav`
  SHA256 `53820ba5753af3db03de80b6ddd208e0a1cf23c0e2401c5dece6c44eb029095b`

GPU sampling during vocal composition reached a maximum total allocation of 10,104 MiB on the
12,282 MiB card. This is whole-device allocation, not isolated per-model VRAM. It validates this
tested configuration's ability to run, not maximum achievable inference speed or musical superiority.

The vocal plan proposed more lyrics than the short clip could contain. A local creation probe with
explicit duration and word-budget instructions returned a shorter plan, but the installed 0.50.57 run
failed the English requirement. A subsequent live 0.50.58 validation probe rejected all three
unsuitable proposals and stopped before audio generation. Short automatically written vocal songs
are therefore an unresolved model capability, not a successful v6-level feature. Longer duration or
user-supplied lyrics remain alternatives. The instrumental path succeeded. The model can still
misinterpret genre, language or structure. Metadata, plans and file integrity do not substitute for
listening evaluations.

On 0.50.57 restart, the instrumental audio, original idea, complete plan and generation controls were
restored; title and sidecar both reported 0.50.57 and CUDA, with zero generation requests on reload.
During forced test upgrades an owned old sidecar initially held the port; it was identified by its
installed runtime path and previous app parent PID, then stopped. A clean launch restored the
embedded CUDA runtime. The external ACE-Step server was preserved throughout.

Detailed machine-readable evidence and screenshots remain in ignored `test-results/engine-research`.
User audio and generated WAVs are not committed to Git.
