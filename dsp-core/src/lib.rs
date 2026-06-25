//! Cross-platform audio DSP core.
//!
//! Replaces the hand-ported EBU R128 meter and mastering chain in the browser
//! (`app/lib/lufs-meter.js`, `app/lib/audio-enhancer.js`) with native Rust.

mod decode;
mod loudness;
mod mastering;

use anyhow::{Context, Result};
use serde::Serialize;

pub use mastering::{export_mastered_bytes, ExportMasteredResult, MAX_EXPORT_DURATION_SEC};

/// Loudness measurement result — mirrors JS `measureIntegratedLoudnessSync`.
#[derive(Debug, Clone, Serialize)]
pub struct Loudness {
    pub integrated_lufs: f64,
    pub true_peak_dbtp: f64,
    pub sample_peak_dbfs: f64,
    pub channels: u32,
    pub sample_rate: u32,
    pub duration_sec: f64,
}

/// Measure loudness of a WAV file (fast path via `hound`).
pub fn measure_loudness_wav(path: &str) -> Result<Loudness> {
    let mut reader =
        hound::WavReader::open(path).with_context(|| format!("failed to open {path}"))?;
    let spec = reader.spec();
    let channels = spec.channels as u32;
    let sample_rate = spec.sample_rate;

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<std::result::Result<_, _>>()
            .context("reading float samples")?,
        hound::SampleFormat::Int => {
            let scale = (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .map(|s| s.map(|v| v as f32 / scale))
                .collect::<std::result::Result<_, _>>()
                .context("reading integer samples")?
        }
    };

    loudness::measure_interleaved(&samples, channels, sample_rate)
}

/// Measure loudness from encoded audio bytes (any supported format).
pub fn measure_loudness_bytes(bytes: Vec<u8>) -> Result<Loudness> {
    let (samples, channels, sample_rate) = decode::decode_interleaved(bytes)?;
    loudness::measure_interleaved(&samples, channels, sample_rate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    fn write_sine(path: &std::path::Path) {
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 48_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(path, spec).unwrap();
        let amplitude = 0.5f32;
        for n in 0..48_000 {
            let s = (2.0 * PI * 1000.0 * n as f32 / 48_000.0).sin() * amplitude;
            let v = (s * i16::MAX as f32) as i16;
            writer.write_sample(v).unwrap();
            writer.write_sample(v).unwrap();
        }
        writer.finalize().unwrap();
    }

    #[test]
    fn measures_sine_tone_wav_path() -> Result<()> {
        let path = std::env::temp_dir().join("dsp_core_sine_path.wav");
        write_sine(&path);
        let r = measure_loudness_wav(&path.to_string_lossy())?;
        assert_eq!(r.channels, 2);
        assert_eq!(r.sample_rate, 48_000);
        assert!(r.integrated_lufs.is_finite());
        assert!(r.true_peak_dbtp <= 0.5);
        let _ = std::fs::remove_file(&path);
        Ok(())
    }

    #[test]
    fn measures_sine_tone_from_bytes() -> Result<()> {
        let path = std::env::temp_dir().join("dsp_core_sine_bytes.wav");
        write_sine(&path);
        let bytes = std::fs::read(&path)?;
        let r = measure_loudness_bytes(bytes)?;
        assert_eq!(r.channels, 2);
        assert_eq!(r.sample_rate, 48_000);
        assert!(r.true_peak_dbtp <= 0.5);
        let _ = std::fs::remove_file(&path);
        Ok(())
    }
}
