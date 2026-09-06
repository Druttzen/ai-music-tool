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
    let mut out: Vec<f32> = Vec::with_capacity(
        ((frames_in as f64) * (EXPORT_SAMPLE_RATE as f64) / (sample_rate as f64) * 1.05) as usize
            * ch,
    );

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
        // Drop padded silence on the last partial chunk proportionally.
        let keep = if take < chunk {
            ((frames_out as f64) * (take as f64) / (chunk as f64)).round() as usize
        } else {
            frames_out
        };
        for f in 0..keep {
            for c in 0..ch {
                out.push(waves_out[c][f]);
            }
        }
        frame += take;
    }

    // Flush remaining delay line.
    let zeros: Vec<Vec<f32>> = (0..ch).map(|_| vec![0.0; chunk]).collect();
    if let Ok(waves_out) = resampler.process(&zeros, None) {
        let frames_out = waves_out.first().map(|v| v.len()).unwrap_or(0);
        // Only keep a small tail proportional to resampler latency (~chunk), not a full pad.
        let keep = frames_out.min(chunk);
        for f in 0..keep {
            for c in 0..ch {
                out.push(waves_out[c][f]);
            }
        }
    }

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
}
