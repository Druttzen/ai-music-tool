//! Sample-rate conversion for Studio export delivery (48 kHz).

use anyhow::{anyhow, Context, Result};
use rubato::{FftFixedIn, Resampler};

use crate::loudness::EXPORT_SAMPLE_RATE;

/// Resample interleaved f32 to [`EXPORT_SAMPLE_RATE`] when needed.
/// Returns (samples, channels, sample_rate).
pub fn resample_interleaved_to_export_rate(
    samples: &[f32],
    channels: u32,
    sample_rate: u32,
) -> Result<(Vec<f32>, u32, u32)> {
    if channels == 0 {
        return Err(anyhow!("resample: channels=0"));
    }
    if sample_rate == 0 {
        return Err(anyhow!("resample: sample_rate=0"));
    }
    if samples.len() % channels as usize != 0 {
        return Err(anyhow!("resample: incomplete interleaved frame"));
    }
    if sample_rate == EXPORT_SAMPLE_RATE || samples.is_empty() {
        return Ok((samples.to_vec(), channels, sample_rate));
    }

    let ch = channels as usize;
    let frames_in = samples.len() / ch;
    if frames_in == 0 {
        return Ok((Vec::new(), channels, EXPORT_SAMPLE_RATE));
    }

    let chunk = 1024usize;
    let mut resampler = FftFixedIn::<f32>::new(
        sample_rate as usize,
        EXPORT_SAMPLE_RATE as usize,
        chunk,
        2,
        ch,
    )
    .context("creating FFT resampler")?;

    // Planar input buffers filled chunk-by-chunk.
    let mut waves_in: Vec<Vec<f32>> = (0..ch).map(|_| Vec::with_capacity(chunk)).collect();
    let expected_frames = ((frames_in as u128 * EXPORT_SAMPLE_RATE as u128
        + sample_rate as u128 / 2) / sample_rate as u128) as usize;
    let delay = resampler.output_delay();
    let required_frames = expected_frames + delay;
    let mut out: Vec<f32> = Vec::with_capacity((required_frames + resampler.output_frames_max()) * ch);

    let mut frame = 0usize;
    while frame < frames_in {
        let take = (frames_in - frame).min(chunk);
        for c in 0..ch {
            waves_in[c].clear();
            for f in 0..take {
                waves_in[c].push(samples[(frame + f) * ch + c]);
            }
            // Pad partial final chunk with zeros (FftFixedIn expects fixed input size).
            while waves_in[c].len() < chunk {
                waves_in[c].push(0.0);
            }
        }

        let waves_out = resampler
            .process(&waves_in, None)
            .context("resampling chunk")?;

        let frames_out = waves_out.first().map(|v| v.len()).unwrap_or(0);
        // FFT blocks have variable output size. Keep all output until final trimming.
        for f in 0..frames_out {
            for c in 0..ch {
                out.push(waves_out[c][f]);
            }
        }
        frame += take;
    }

    // Flush the remaining signal and filter delay, including very short input.
    let zeros: Vec<Vec<f32>> = (0..ch).map(|_| vec![0.0; chunk]).collect();
    while out.len() / ch < required_frames {
        let waves_out = resampler.process(&zeros, None).context("flushing FFT resampler")?;
        let frames_out = waves_out.first().map(|v| v.len()).unwrap_or(0);
        for f in 0..frames_out {
            for c in 0..ch {
                out.push(waves_out[c][f]);
            }
        }
    }

    let start = delay * ch;
    out.copy_within(start..start + expected_frames * ch, 0);
    out.truncate(expected_frames * ch);
    Ok((out, channels, EXPORT_SAMPLE_RATE))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn resamples_44100_to_48000() {
        let sr_in = 44_100u32;
        let n = sr_in as usize; // 1s
        let mut samples = Vec::with_capacity(n * 2);
        for i in 0..n {
            let s = (2.0 * PI * 440.0 * i as f32 / sr_in as f32).sin() * 0.25;
            samples.push(s);
            samples.push(s);
        }
        let (out, ch, sr) = resample_interleaved_to_export_rate(&samples, 2, sr_in).unwrap();
        assert_eq!(ch, 2);
        assert_eq!(sr, EXPORT_SAMPLE_RATE);
        let frames = out.len() / 2;
        let expected = EXPORT_SAMPLE_RATE as usize;
        assert!(
            (frames as i64 - expected as i64).abs() < 2000,
            "frames={frames} expected~{expected}"
        );
    }

    #[test]
    fn passthrough_when_already_48k() {
        let samples = vec![0.1f32, -0.1, 0.2, -0.2];
        let (out, ch, sr) = resample_interleaved_to_export_rate(&samples, 2, 48_000).unwrap();
        assert_eq!(ch, 2);
        assert_eq!(sr, 48_000);
        assert_eq!(out, samples);
    }

    #[test]
    fn exports_exact_frame_count_including_short_and_partial_chunks() {
        for rate in [8_000u32, 22_050, 44_100, 96_000] {
            for frames in [1usize, 17, 1024, 1025, 44_100] {
                let samples = vec![0.25f32; frames * 2];
                let (out, _, _) = resample_interleaved_to_export_rate(&samples, 2, rate).unwrap();
                let expected = ((frames as u64 * 48_000 + rate as u64 / 2) / rate as u64) as usize;
                assert_eq!(out.len(), expected * 2, "rate={rate} frames={frames}");
            }
        }
    }

    #[test]
    fn compensates_filter_delay_for_an_impulse() {
        let mut samples = vec![0.0f32; 4410];
        samples[882] = 1.0;
        let (out, _, _) = resample_interleaved_to_export_rate(&samples, 1, 44_100).unwrap();
        let peak = out.iter().enumerate().max_by(|(_, a), (_, b)| a.abs().total_cmp(&b.abs())).unwrap().0;
        assert_eq!(peak, 960);
    }
}
