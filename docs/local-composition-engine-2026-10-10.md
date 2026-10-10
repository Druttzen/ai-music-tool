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

## 0.50.59: separate instruction and semantic music models

The 1.7B audio-token model's unsuccessful short-lyric planning motivated a separate local
instruction model. The new path is:

1. Cached Qwen3-4B Q4_K_M weights, llama.cpp CUDA inference and a bounded reasoning step develop
   motif notes/rhythm, named chord progression, timed sections, tempo/key and optional sung words.
2. An owned, authenticated loopback process is terminated before semantic music inference.
3. The cached ACE-Step 5Hz 1.7B model plans semantic audio tokens with thinking enabled.
4. ACE-Step SFT generates the waveform from the accepted musical direction and lyrics.

This integrates trained models; it does not train a new music foundation model or recover Suno's
private weights. Qwen is a general instruction model, not an audio music model. Its descriptions
can contain theoretical errors. Neither valid JSON nor a detailed plan proves the rendered music
follows the motif and harmony. Blind listening and independent musical evaluations are required.

Generated lyrics have constrained character length and a checked word budget/language. Arrangement
sections must be contiguous from zero to the exact requested duration. Invalid proposals are retried
up to three times and then fail before audio submission. Supplied lyrics are preserved. Installed
instruction-model failures are surfaced; they do not silently fall back to a weaker planner.
Profiles without the optional composer cache retain the earlier ACE text-planning route.

The plan and export retain separate instruction/semantic model identities and measured GPU layer
offloading. A direct hardware probe confirmed all 37 Qwen layers on RTX 4070 SUPER and retained
138 BPM/A minor. Whole-device GPU memory during another probe was approximately 9.5 GB.

Install once online with `npm run sidecar:composer -- -DataDir "<studio data directory>"`.
The installer pins model and runtime SHA256 digests. Cached inference uses local files and loopback
requests, with no generation credits. Weights and CUDA runtime are kept outside Git and the app installer.
`AIMC_COMPOSER_GPU_LAYERS=0` selects CPU; a smaller integer selects partial GPU offloading.

Primary implementation references:

- [Qwen3-4B model and license](https://huggingface.co/Qwen/Qwen3-4B-GGUF)
- [Pinned llama.cpp server interface](https://github.com/ggml-org/llama.cpp/blob/b11541/tools/server/README.md)
- [ACE-Step architecture and implementation](https://github.com/ace-step/ACE-Step-1.5)
- [Official Suno v6 announcement](https://about.suno.com/blog/introducing-v6)

The public v6 announcement describes capabilities, not a reproducible architecture or released
weights. Historical Suno Transformer/audio-token descriptions must not be presented as verified
v6 internals. Offline installation is a practical advantage, not evidence of superior musical ability.

[LeVo 2's research paper](https://arxiv.org/abs/2606.30642) is a relevant additional architecture:
its semantic music LM plans mixed tokens, another stage refines vocal/accompaniment tracks, and a
diffusion codec reconstructs audio. Its authors separate musicality learning, SFT and preference
alignment (offline/semi-online DPO). This supports researching actual musical training and alignment,
rather than assuming more descriptive prompts alone deliver commercial-model equivalence. LeVo 2
has not been installed or benchmarked on this machine; its reported comparisons are not proof of
Suno v6 parity here.

## Installed 0.50.59 findings and 0.50.60 correction

The installed 0.50.59 used cached Qwen (37/37 CUDA layers), ACE semantic LM 1.7B and SFT.
Prompt-only vocal job `668b3334af8046d2` and instrumental job `35bb8456c1dd4cfd` completed
30-second waveform generation. Native playback clocks reached 1.777085s and 1.749323s respectively,
with readyState 4 and no media errors. The instruction runtime was absent after generation.

The vocal test revealed a UI restoration bug: a previous instrumental `unknown` language appeared
as English in the dropdown but was sent unchanged. Although the AI wrote English lyrics, this failed
the selected-language contract. 0.50.60 normalizes restored instrumental language to English for vocals
in both the UI and backend and adds regression coverage. 0.50.59 is not the final accepted vocal test.

0.50.60 automated checks: 664 frontend tests/128 files, 208 Python tests passed, one skipped and one
deselected; lint and generated contracts passed. Both Windows installers and production builds are
checked separately below with final installed evidence.

Final installed 0.50.60 vocal job `898ab20a32b64bd0` completed from an idea with no supplied lyrics,
reference audio or track DNA. After switching from the restored instrumental take, both the actual
dropdown value and returned plan were `en`. The job reported Qwen3-4B Q4_K_M, CUDA/37 GPU layers,
ACE semantic LM `acestep-5Hz-lm-1.7B`, and SFT waveform generation. Timed sections covered 0–30s.
Native playback advanced to 1.755612s, readyState 4, with no media errors.

Export: `B:\AI Music Creator Studio Phase Test Final\data\exports\suno-draft-1791639995434.wav`,
48 kHz stereo, exactly 30s, finite samples, peak 0.89125; SHA256
`a965dc27f652f4bd4f20853e47b77a99a10c15b5b0a4d0cd76e3d6d78d8971f1`.
The matching TXT includes the actual idea, AI-written lyrics and complete composition plan.
This verifies the creation/export pipeline, not sung-word accuracy or superiority to Suno.

The 0.50.60 installer and embedded health reported the same version with CUDA. Restart restored the
preceding Qwen instrumental plan, all 37 GPU-layer provenance and cached audio with zero generation
requests. Final installed executable SHA256:
`a39cc3aafff2bd5333bc250d6c4ba63e9739df7663d163b40e75091c44935544`.

Cancellation tests:

- `d01ba5e0e9f24a28`: cancellation raced with completion of instruction planning and reached semantic
  music rendering. It finished cooperatively as `cancelled`, exposed no new audio and retained the
  accepted 30-second vocal cache. The foreign ACE server's running render was not forcibly stopped.
- `fd0fd59d2c884731`: cancelled at instruction progress 0.12 for a 120-second request. The owned
  llama runtime was observed running before cancellation and absent afterward. No audio was submitted,
  status was `cancelled`, and the preceding vocal cache remained unchanged.

After restoring the duration control to 30s, final page reload retained the accepted English vocal
take and composition plan without new generation requests. Offline tests mean inference against the
local cached models with offline flags; network access was not disabled at the operating-system level.
