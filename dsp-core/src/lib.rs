//! Cross-platform audio DSP core.
//!
//! Phase B2 goal: this crate replaces the hand-ported EBU R128 meter in
//! `app/lib/lufs-meter.js` and the mastering chain in `app/lib/audio-enhancer.js`
//! with native, maintained implementations exposed to the UI via Tauri commands.
//!
//! Loudness measurement (integrated LUFS + true peak) uses the `ebur128` crate —
//! the same libebur128 the JS code was ported from. Decoding of the real upload
//! formats (MP3/M4A/OGG/FLAC/WAV) uses `symphonia`, so the native meter can run
//! straight from the original file bytes instead of a browser-decoded buffer.

use std::io::Cursor;

use anyhow::{anyhow, Context, Result};
use ebur128::{EbuR128, Mode};
use serde::Serialize;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Loudness measurement result, mirroring the shape returned by the current
/// JS `measureIntegratedLoudnessSync` so the UI contract stays stable.
#[derive(Debug, Clone, Serialize)]
pub struct Loudness {
    pub integrated_lufs: f64,
    pub true_peak_dbtp: f64,
    pub sample_peak_dbfs: f64,
    pub channels: u32,
    pub sample_rate: u32,
    pub duration_sec: f64,
}

/// Core EBU R128 measurement over interleaved f32 samples. Shared by every
/// front-end (WAV path, byte/format decode).
fn measure_from_interleaved(samples: &[f32], channels: u32, sample_rate: u32) -> Result<Loudness> {
    if channels == 0 || sample_rate == 0 {
        return Err(anyhow!("invalid audio: channels={channels} sample_rate={sample_rate}"));
    }
    let frames = samples.len() / channels as usize;
    let duration_sec = frames as f64 / sample_rate as f64;

    let mut meter = EbuR128::new(channels, sample_rate, Mode::I | Mode::TRUE_PEAK)
        .context("initializing ebur128 meter")?;
    meter.add_frames_f32(samples).context("feeding samples to meter")?;

    let integrated_lufs = meter.loudness_global().context("integrated loudness")?;

    let mut true_peak_linear = 0.0f64;
    for ch in 0..channels {
        let tp = meter.true_peak(ch).context("true peak")?;
        if tp > true_peak_linear {
            true_peak_linear = tp;
        }
    }
    let true_peak_dbtp = 20.0 * true_peak_linear.max(1e-12).log10();

    let sample_peak = samples.iter().fold(0.0f32, |m, &v| m.max(v.abs()));
    let sample_peak_dbfs = 20.0 * (sample_peak.max(1e-12) as f64).log10();

    Ok(Loudness {
        integrated_lufs,
        true_peak_dbtp,
        sample_peak_dbfs,
        channels,
        sample_rate,
        duration_sec,
    })
}

/// Measure loudness of a WAV file (fast path via `hound`, used by the CLI).
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

    measure_from_interleaved(&samples, channels, sample_rate)
}

/// Decode arbitrary audio bytes (MP3/M4A/OGG/FLAC/WAV) into interleaved f32.
fn decode_interleaved(bytes: Vec<u8>) -> Result<(Vec<f32>, u32, u32)> {
    let mss = MediaSourceStream::new(Box::new(Cursor::new(bytes)), Default::default());
    let probed = symphonia::default::get_probe()
        .format(
            &Hint::new(),
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .context("probing audio format")?;

    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| anyhow!("no decodable audio track"))?;
    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .context("creating decoder")?;

    let mut samples: Vec<f32> = Vec::new();
    let mut channels = 0u32;
    let mut sample_rate = 0u32;
    let mut sbuf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(SymphoniaError::ResetRequired) => break,
            Err(e) => return Err(e).context("reading packet"),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                if sample_rate == 0 {
                    sample_rate = spec.rate;
                    channels = spec.channels.count() as u32;
                }
                if sbuf.is_none() {
                    sbuf = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, spec));
                }
                if let Some(buf) = sbuf.as_mut() {
                    buf.copy_interleaved_ref(decoded);
                    samples.extend_from_slice(buf.samples());
                }
            }
            Err(SymphoniaError::DecodeError(_)) => continue, // skip a bad frame
            Err(e) => return Err(e).context("decoding packet"),
        }
    }

    if sample_rate == 0 || channels == 0 {
        return Err(anyhow!("decoded no audio frames"));
    }
    Ok((samples, channels, sample_rate))
}

/// Measure loudness directly from encoded audio bytes (any supported format).
/// This is the path the Tauri UI uses, passing the original file blob.
pub fn measure_loudness_bytes(bytes: Vec<u8>) -> Result<Loudness> {
    let (samples, channels, sample_rate) = decode_interleaved(bytes)?;
    measure_from_interleaved(&samples, channels, sample_rate)
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
