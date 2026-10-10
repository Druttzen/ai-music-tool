# Offline generation research — 10 October 2026

## What the public evidence establishes

The objective is to make useful local style drafts before uploading a chosen
audio file to Suno. This investigation found no verified public Suno v6 weights,
training recipe or runnable implementation. A browser inspector can expose
client code and requests; it cannot reveal the server's trained model weights.
No account requests, private credentials or Suno generation credits were used.

Suno's [v6 announcement](https://about.suno.com/blog/introducing-v6) describes
new generation capabilities and music partnerships, without publishing a
reproducible engine. Its [current model guide](https://help.suno.com/en/articles/13924737)
lists v6, v6-wild and v6-mini. These product descriptions do not identify the
architecture, parameter count, codec, dataset or inference settings needed to
rebuild v6. Treating an inferred design as Suno's actual engine would be misleading.

[Bark](https://github.com/suno-ai/bark) is Suno's open text-to-speech/audio
project. Its README explicitly distinguishes it from the text-to-music product.
Its Transformer/audio-token design is useful research background, but neither
Bark weights nor its EnCodec implementation constitute Suno v6.

## Available local engines

| Engine | Published approach and practical role | Implication for this machine |
| --- | --- | --- |
| [MusicGen](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md) | Autoregressive audio tokens, 32 kHz EnCodec; useful short instrumental drafts. Medium is the documented quality/compute compromise. | Retain cached Stereo Small/Medium; preserve genuine stereo. Selecting Medium or upsampling does not add a newly trained singing model. |
| [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | Language-model planning followed by diffusion generation; optional planning and different DiT checkpoints. | Best immediate complementary path for lyrics/full songs, subject to actual hardware tests. |
| [YuE2](https://github.com/multimodal-art-projection/YuE) | Symbolic planning, autoregressive semantic generation, flow acoustic generation and 48 kHz stereo VAE. | Official quickstart targets Linux and recommends at least 24 GB VRAM. This 12 GB Windows GPU is below that recommendation. |
| [HeartMuLa](https://github.com/HeartMuLa/heartlib) | Lyrics/style-conditioned language model and HeartCodec audio decoding. | Interesting alternative; released 3B model and optional lazy loading need separate integration and resource tests. |
| [SongBloom](https://arxiv.org/abs/2506.07634) | Autoregressive structure sketch followed by diffusion refinement. | Architectural evidence for staged generation, not a tested replacement in this application. |
| [StepAudio 3 Music](https://arxiv.org/abs/2609.16034) | Planning, flow/DiT synthesis and preference optimization. | Its inspected [official demo](https://huggingface.co/spaces/stepfun-ai/StepAudio-3-Music/blob/main/README.md?code=true) requires a cloud API key. An offline music checkpoint was not verified. |

MusicGen's [paper](https://arxiv.org/abs/2306.05284) and official documentation
describe a single-stage token model, four codebooks at 50 Hz and licensed
training audio. The published weight license includes a noncommercial condition.
Personal offline use does not create additional training data or change model
capacity. Longer generated previews and mastering can help workflow, but cannot
establish equivalence to a different trained model.

The [ACE-Step tutorial](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Tutorial.md)
distinguishes Turbo (normally 8 steps), SFT (normally 50 steps, with CFG) and
Base (editing/training). SFT offers more detail/control in some cases; the
authors caution that Turbo can be cleaner. Base is consequently not labelled
as a universal quality upgrade. XL's larger memory requirement also matters:
the normal 2B model is the practical initial choice here. The
[ACE-Step paper](https://arxiv.org/abs/2602.00744) supplies the research basis;
the [official SFT checkpoint](https://huggingface.co/ACE-Step/acestep-v15-sft)
is the source used for the one-time download.

YuE2's authors report a WildSongBench result for best-of-eight selection that
exceeds their reported Suno v6 result. This is an authors' benchmark with
specific selection settings, not independent proof of equivalence and not a
result obtained by this app. The repository's current main branch is YuE2;
the original YuE lives on a separate branch. Its useful lesson for this
implementation is to generate alternatives and keep the original candidates,
rather than assume one sample always represents an engine's best result.

HeartMuLa's [paper](https://arxiv.org/abs/2601.10547) separates alignment,
transcription, codec and song generation. The inspected implementation had
unreleased/TODO components, including reference conditioning. Those capabilities
must not be advertised as already integrated here.

## Implemented improvement

The app now offers a local MusicGen search over two, three or four seeds.
Generation runs sequentially through the existing job worker. Every take is
retained and stored in the local audio cache. Users can listen, export a take
or select another cached take without running generation again.

[LAION CLAP](https://github.com/LAION-AI/CLAP) provides audio/text embeddings.
The [official unfused checkpoint](https://huggingface.co/laion/clap-htsat-unfused)
is loaded on CPU from the local cache, without remote code. Candidate ranking
uses cosine similarity to the style prompt. With a reference file it uses
0.6 × prompt similarity + 0.4 × reference similarity. These weights are our
engineering choice, not a learned Suno matching rule. Scores are displayed as
raw similarities, not percentages or sound-quality grades.

For reproducibility, audio is decoded at 48 kHz mono for scoring only. We take
10-second windows from the beginning, middle and end of at most the first
60 seconds, average normalized features and normalize again. Original stereo
WAVs remain unchanged. This method can miss a later chorus or stylistic change.
CLAP cannot prove good mastering, lyrics, melody identity, musical development
or perceptual equivalence. Listening remains necessary. Missing ranker weights
leave all takes usable and explicitly unranked.

Reference comparison is optional. Melody conditioning is separately optional
and uses MusicGen's existing melody-capable model route. A comparison file alone
does not silently force melody conditioning. Generation settings, actual seeds
and the selected candidate are recorded in the export brief.

ACE-Step now exposes an explicit SFT choice, prompt guidance, normal 50-step
settings and persisted seed/prompt/lyrics. A missing SFT checkpoint gives a
clear installation error; it is not silently replaced by Turbo. An already
running foreign ACE server is preserved, including the existing refusal to
change its loaded model.

### Preparing the comparison cache once

Use the installed GPU runtime's Python with `scripts/prepare-draft-ranker.py`
and `--cache-dir` set to the same Hugging Face cache used by the installed app.
The helper downloads the official processor/model. Subsequent scoring loads
cached files only. MusicGen and ACE-Step weights must likewise be prepared
before an offline session. Offline flags verify cached model operation; they
are not a machine-wide network disconnection.

The installed app sets both `HF_HOME` and `HF_HUB_CACHE` to the specified cache
folder. The preparation helper mirrors both variables; setting only `HF_HOME`
would put downloads in a nested `hub` folder that the installed app does not use.

## User-provided reference

Analyzed locally: `C:\Users\micke\Downloads\Theme of Simon.B.mp3`.

| Measurement | Observed result |
| --- | --- |
| Duration | 233.88 seconds |
| Sample rate / channels | 48 kHz / 2 |
| SHA256 | `fb2dc785d1f0de29f1c472b54d1dadc79f2fc1330a90d83db7fc9715f950eb39` |
| First-minute tempo estimate | 99.38 BPM; half/double-time ambiguity applies |
| Best of 16 tested CLAP descriptions | Melodic trance (0.5532), synthwave (0.5191), chiptune/game synths (0.5038), techno (0.4797) |

These are relative embedding matches among selected descriptions, not verified
genre labels or an aural review. The test prompt derived from them is:

> Melodic trance instrumental, video game inspired synthesizer lead,
> arpeggiated analog synthesizers, pulsing bass, driving electronic drums,
> energetic cinematic mood, clean stereo mix

No claim is made that this reproduces the reference melody or Suno's model.
The installed analyzer later estimated 125 BPM over the longer song and classified
its sampled segment as pop/disco. The disagreement with the first-minute estimate
illustrates sampling/model uncertainty; neither is presented as verified tempo
or genre. Native loudness measurement of the reference reported -15.8 LUFS and
-4.6 dBTP. These signal measurements do not score the composition.
Installed-app evidence and actual comparison results are recorded in the
[installed test report](installed-engine-comparison-2026-10-10.md). The MP3
and intermediate audio evidence are not committed to Git.

## Further work supported by the evidence

The strongest remaining improvements require more than wrapper code: targeted
training/adapters, suitable licensed data, stronger lyrics/vocal generation,
long-form structure and human listening comparisons. Candidate ranking can
reduce wasted trials and steer style now. A defensible claim of Suno parity
would require matched prompts/durations, blind listening, repeated seeds and
separate style, vocals, composition and sound-quality ratings. The current
implementation does not claim that result.
