# Clean vocal separation — 0.50.62

## Changes

- The editor recommends `Clean vocals (FT2 Bleedless)` when Mel-Band is installed. Standard Kim vocals and explicit Demucs four-stem separation remain selectable.
- Clean mode uses `melband-roformer-kimmel-ft2-bleedless`, with the creator's 44,100 Hz configuration, 11-second chunks and overlap 8. Input is resampled to the model rate; stems are resampled back to the original rate and exact frame count. Mono is preserved.
- Vocals and `input − vocals` are exported as 32-bit float WAV. Independent clipping no longer corrupts reconstruction.
- Separation runs on a worker thread so health/UI requests can proceed during inference. The job worker permits inline child separation jobs used by vocal transformation.
- Models return to CPU after inference, freeing GPU memory. Cancellation is checked between model chunks. Failed jobs remove temporary outputs.
- The installed-app test exposed Demucs' dependency on a missing `ffprobe` executable. WAV, MP3 and FLAC now decode directly with libsndfile and resample to Demucs' model rate. Its outputs also use float WAV and the model returns to CPU afterward. Optional FFmpeg decoding remains for other formats.
- Inference requires local checkpoint **and** config; it cannot silently download missing assets. Known checkpoint checksums are verified on load. Clean-mode config is also pinned by checksum. Downloads happen during explicit setup and replace files only after successful verification.
- Both checkout setup and packaged extra installation provision the clean checkpoint. `scripts/install-clean-vocal-model.ps1` provisions it separately into the configured `STUDIO_DATA_DIR`.

## Model provenance

Creator files: [pcunwa/Kim-Mel-Band-Roformer-FT](https://huggingface.co/pcunwa/Kim-Mel-Band-Roformer-FT). Inference implementation/registry: [openmirlab/melband-roformer-infer](https://github.com/openmirlab/melband-roformer-infer). Tested runtime: `melband-roformer-infer==0.1.5`, PyTorch 2.7.1+cu128, RTX 4070 SUPER.

Pinned SHA-256:

| File | SHA-256 |
| --- | --- |
| kimmel_unwa_ft2_bleedless.ckpt | `3c450bd66a98b49dd03231fc5ebb84121eef8418236b179423c2b171d62b04d9` |
| config_kimmel_unwa_ft.yaml | `0942cb7da8e86ac1be840cc7b9647831c11ffe00327a0b239df256031e6c8355` |

The preexisting standard Kim checkpoint was truncated to 11,091,968 bytes. It was repaired to 913,106,900 bytes and verified against `87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e`. The new loader rejects truncated/corrupt cached checkpoints.

## Controlled audio measurement

A local Windows synthesized **speech** recording was mixed with a 13.278-second instrumental excerpt. Both component WAVs were retained independently. They were normalized to RMS 0.08 each and mixed at 48 kHz stereo. The instrumental excerpt came from the previous local instrumental draft; this measures rejection of that particular backing, not a universal instrumental dataset.

| Measurement | Standard Kim, corrected rate | FT2 Bleedless |
| --- | ---: | ---: |
| Vocal SI-SDR | 22.55 dB | 22.70 dB |
| Retained reference voice amplitude | 0.9907 | 0.9895 |
| Linear projection onto known backing | −49.45 dB | −48.41 dB |
| Vocals + instrumental maximum reconstruction error | 2.98 × 10⁻⁸ | 2.98 × 10⁻⁸ |

FT2 output on **the backing alone**: RMS 0.00002284, **−70.89 dB** relative to input. The linear projection metric estimates the component correlated with the known backing; it does not measure every nonlinear artifact. These figures do not establish perfect separation for real singing or arbitrary songs. Standard and FT2 performed similarly on this short speech fixture.

A second FT2 pass was evaluated: SI-SDR 22.702 dB, voice amplitude 0.98949, backing projection −48.423 dB. The difference was negligible, so the product uses one pass rather than adding processing cost without measured benefit.

The 30-second local vocal draft separated on CUDA in 12.6 seconds, producing finite 48 kHz stereo stems of exactly 1,440,000 frames. Summing them reconstructed the decoded input to within 5.96 × 10⁻⁸. No isolated singing reference exists for this draft, so no singing-purity score is assigned.

## Verification

- 665 frontend tests passed across 129 files; lint passed.
- 216 Python tests passed, one skipped and one slow test deselected.
- 50 Rust desktop-app tests passed. All 53 API contracts verified.
- Regression coverage includes 16/44.1/48 kHz mono/stereo, unclipped float WAV reconstruction, offline missing-config handling, atomic rejected downloads, worker responsiveness and nested-job deadlock prevention.
- The final frontend test run was performed after packaging: the first concurrent run collided with the build's resource copying, causing a filesystem error in the version-sync test. The sequential rerun passed all 665 tests. Source, bundled resource and installed runtime checksums match.

## Physical installed-app tests

The app was built as NSIS/MSI and installed at `B:\AI Music Creator Studio Offline Drafts`, using the existing data profile at `B:\AI Music Creator Studio Phase Test Final\data`. The final window and sidecar both report 0.50.62. Models were provisioned beforehand; inference ran with Hugging Face and Transformers offline settings enabled.

1. Installed 0.50.61 separated the previous 30-second vocal draft using the recommended clean mode. Both download buttons saved real WAVs. Cold separation took 19.33 seconds on CUDA. The source is unchanged in 0.50.62.
2. The full user-provided `Theme of Simon.B.mp3` (233.88 seconds, stereo 48 kHz) separated in 61.25 seconds in the installed app. Both exported stems are finite float WAVs with exactly 11,226,240 frames. Maximum reconstruction error is 2.98 × 10⁻⁸.
3. The Suno reference's clean vocal output is almost silent: RMS 0.00008310, peak 0.009074. This is **not** proof of preserving singing: the model found little vocal content. The known-voice fixture and the clearly vocal 30-second draft are the preservation checks. No ground-truth vocal exists for the Suno file.
4. After fixing the actual `ffprobe` failure, installed 0.50.62 separated the full Suno reference with explicit Demucs in 10.29 seconds on CUDA. All four app download buttons produced finite stereo float WAVs at 44.1 kHz with 10,314,108 frames each (233.88 seconds).
5. Installed 0.50.62 repeated clean-mode separation of the entire Suno reference in 63.31 seconds on CUDA. Both download buttons were exercised again. During the Demucs job, 10 health requests returned HTTP 200 (maximum latency 40.3 ms); during clean separation, 63 returned HTTP 200 (maximum 41.5 ms). These measurements cover active inference, excluding later large file exports and idle restarts.

Clean exports are retained as `Theme of Simon.B-clean-vocals.wav` and `Theme of Simon.B-clean-instrumental.wav`. The four-stem comparison vocal is retained separately as `Theme of Simon.B-demucs-vocals.wav`. The vocal draft export is also copied to `Clean vocal demo 30s.wav`. Changing models and exporting with the default name can overwrite that model's same-name stem; the comparison copies preserve both results.

## Limit

No learned separator can guarantee absolutely zero instrumental bleed and complete preservation of every vocal detail for every mix. Dense synthesizers, choirs, voice-like instruments, reverb and effects can be ambiguous. The UI states this limitation; a valid WAV or a finite waveform is not treated as proof of vocal purity.
