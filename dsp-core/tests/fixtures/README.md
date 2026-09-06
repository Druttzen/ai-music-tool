# ALAC decode fixtures

`sine-alac.caf` — 0.5 s 440 Hz stereo ALAC in CAF (48 kHz), generated with ffmpeg then
rewritten so the `kuki` chunk is a raw 24-byte ALAC magic cookie (Symphonia rejects the
QuickTime `frma`/`alac` atom wrapper FFmpeg embeds).

Regenerate (requires ffmpeg + Python):

```bash
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=0.5:sample_rate=48000" -ac 2 -c:a alac sine-alac.caf
# then unwrap kuki to 24-byte cookie (see decode::tests::decodes_alac_caf_fixture / prior agent script)
```
