//! Studio mastering chain — Rust port of `app/lib/audio-enhancer.js`.

use anyhow::{anyhow, Result};
use serde::Serialize;

use crate::decode::{decode_interleaved, slice_interleaved, to_stereo_interleaved};
use crate::loudness::{apply_target_integrated_lufs, normalize_peak, measure_interleaved, STREAMING_TARGET_LUFS};

pub const MAX_EXPORT_DURATION_SEC: f64 = 600.0;

#[derive(Debug, Clone, Serialize)]
pub struct ExportMasteredResult {
    pub wav_bytes: Vec<u8>,
    pub integrated_lufs: Option<f64>,
    pub true_peak_dbtp: f64,
    pub target_lufs: Option<f64>,
    pub preset: String,
    pub bits_per_sample: u16,
}

/// Biquad direct-form II transposed (RBJ cookbook coefficients).
struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Biquad {
    fn new(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> Self {
        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    fn highpass(sample_rate: f32, freq: f32, q: f32) -> Self {
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let cos = w0.cos();
        let sin = w0.sin();
        let alpha = sin / (2.0 * q);
        let b0 = (1.0 + cos) / 2.0;
        let b1 = -(1.0 + cos);
        let b2 = (1.0 + cos) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos;
        let a2 = 1.0 - alpha;
        Self::new(b0, b1, b2, a0, a1, a2)
    }

    fn lowshelf(sample_rate: f32, freq: f32, gain_db: f32) -> Self {
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let cos = w0.cos();
        let sin = w0.sin();
        let alpha = sin / 2.0 * ((a + 1.0 / a) * (1.0 / 0.71 - 1.0) + 2.0).sqrt();
        let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
        let b0 = a * ((a + 1.0) - (a - 1.0) * cos + two_sqrt_a_alpha);
        let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos);
        let b2 = a * ((a + 1.0) - (a - 1.0) * cos - two_sqrt_a_alpha);
        let a0 = (a + 1.0) + (a - 1.0) * cos + two_sqrt_a_alpha;
        let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos);
        let a2 = (a + 1.0) + (a - 1.0) * cos - two_sqrt_a_alpha;
        Self::new(b0, b1, b2, a0, a1, a2)
    }

    fn highshelf(sample_rate: f32, freq: f32, gain_db: f32) -> Self {
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let cos = w0.cos();
        let sin = w0.sin();
        let alpha = sin / 2.0 * ((a + 1.0 / a) * (1.0 / 0.71 - 1.0) + 2.0).sqrt();
        let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
        let b0 = a * ((a + 1.0) + (a - 1.0) * cos + two_sqrt_a_alpha);
        let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos);
        let b2 = a * ((a + 1.0) + (a - 1.0) * cos - two_sqrt_a_alpha);
        let a0 = (a + 1.0) - (a - 1.0) * cos + two_sqrt_a_alpha;
        let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos);
        let a2 = (a + 1.0) - (a - 1.0) * cos - two_sqrt_a_alpha;
        Self::new(b0, b1, b2, a0, a1, a2)
    }

    fn process(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

struct Compressor {
    threshold_db: f32,
    ratio: f32,
    attack: f32,
    release: f32,
    envelope: f32,
}

impl Compressor {
    fn process(&mut self, x: f32) -> f32 {
        let abs = x.abs();
        let coeff = if abs > self.envelope { self.attack } else { self.release };
        self.envelope += coeff * (abs - self.envelope);

        let level_db = 20.0 * self.envelope.max(1e-12).log10();
        let gain_db = if level_db > self.threshold_db {
            (self.threshold_db - level_db) * (1.0 - 1.0 / self.ratio)
        } else {
            0.0
        };
        x * 10.0f32.powf(gain_db / 20.0)
    }
}

struct DelayLine {
    buf: Vec<f32>,
    pos: usize,
}

impl DelayLine {
    fn new(len: usize) -> Self {
        Self {
            buf: vec![0.0; len.max(1)],
            pos: 0,
        }
    }

    fn write(&mut self, v: f32) {
        self.buf[self.pos] = v;
        self.pos = (self.pos + 1) % self.buf.len();
    }

    fn read(&self, delay: usize) -> f32 {
        let len = self.buf.len();
        let idx = (self.pos + len - delay.min(len - 1).max(1)) % len;
        self.buf[idx]
    }
}

fn apply_haas_wide(samples: &mut [f32], sample_rate: u32, amount: f32) {
    let sr = sample_rate as f32;
    let dry = 1.0 - amount * 0.2;
    let cross = amount * 0.38;
    let delay_l = ((0.006 + amount * 0.01) * sr) as usize;
    let delay_r = ((0.01 + amount * 0.012) * sr) as usize;
    let max_delay = delay_l.max(delay_r) + 4;
    let mut dl = DelayLine::new(max_delay);
    let mut dr = DelayLine::new(max_delay);

    let frames = samples.len() / 2;
    for f in 0..frames {
        let l = samples[f * 2];
        let r = samples[f * 2 + 1];
        dl.write(l);
        dr.write(r);
        let out_l = l * dry + dr.read(delay_r) * cross;
        let out_r = r * dry + dl.read(delay_l) * cross;
        samples[f * 2] = out_l;
        samples[f * 2 + 1] = out_r;
    }
}

fn render_enhancement_chain(samples: &mut [f32], channels: u32, sample_rate: u32, preset: &str) -> Result<()> {
    if channels != 2 {
        return Err(anyhow!("mastering chain requires stereo"));
    }
    let sr = sample_rate as f32;

    let mut hpf_l = Biquad::highpass(sr, 32.0, 0.71);
    let mut hpf_r = Biquad::highpass(sr, 32.0, 0.71);

    let (mut shelf_l, mut shelf_r) = match preset {
        "punch" => (
            Some(Biquad::lowshelf(sr, 110.0, 3.0)),
            Some(Biquad::lowshelf(sr, 110.0, 3.0)),
        ),
        "wide" => (
            Some(Biquad::highshelf(sr, 6500.0, 2.2)),
            Some(Biquad::highshelf(sr, 6500.0, 2.2)),
        ),
        _ => (
            Some(Biquad::highshelf(sr, 9000.0, 1.4)),
            Some(Biquad::highshelf(sr, 9000.0, 1.4)),
        ),
    };

    let (thresh, ratio, attack, release, makeup) = match preset {
        "punch" => (-24.0, 4.5, 0.003, 0.14, 1.22),
        "wide" => (-20.0, 2.8, 0.006, 0.22, 1.12),
        _ => (-20.0, 2.8, 0.006, 0.14, 1.08),
    };

    let mut comp_l = Compressor {
        threshold_db: thresh,
        ratio,
        attack: 1.0 - (-1.0 / (attack * sr)).exp(),
        release: 1.0 - (-1.0 / (release * sr)).exp(),
        envelope: 0.0,
    };
    let mut comp_r = Compressor {
        threshold_db: thresh,
        ratio,
        attack: comp_l.attack,
        release: comp_l.release,
        envelope: 0.0,
    };

    let mut limit_l = Compressor {
        threshold_db: -2.5,
        ratio: 20.0,
        attack: 1.0 - (-1.0 / (0.001 * sr)).exp(),
        release: 1.0 - (-1.0 / (0.04 * sr)).exp(),
        envelope: 0.0,
    };
    let mut limit_r = Compressor {
        threshold_db: -2.5,
        ratio: 20.0,
        attack: limit_l.attack,
        release: limit_l.release,
        envelope: 0.0,
    };

    let frames = samples.len() / 2;
    for f in 0..frames {
        let mut l = samples[f * 2];
        let mut r = samples[f * 2 + 1];
        l = hpf_l.process(l);
        r = hpf_r.process(r);
        if let (Some(sl), Some(sr_f)) = (shelf_l.as_mut(), shelf_r.as_mut()) {
            l = sl.process(l);
            r = sr_f.process(r);
        }
        l = comp_l.process(l) * makeup;
        r = comp_r.process(r) * makeup;
        l = limit_l.process(l);
        r = limit_r.process(r);
        samples[f * 2] = l;
        samples[f * 2 + 1] = r;
    }

    if preset == "wide" {
        apply_haas_wide(samples, sample_rate, 0.7);
    }

    Ok(())
}

fn encode_mp3(samples: &[f32], channels: u32, sample_rate: u32) -> Result<Vec<u8>> {
    use mp3lame_encoder::{Bitrate, Builder, DualPcm, FlushNoGap, Quality};

    if channels != 2 {
        return Err(anyhow!("mp3 export requires stereo"));
    }

    let mut builder = Builder::new().ok_or_else(|| anyhow!("lame init failed"))?;
    builder
        .set_num_channels(2)
        .map_err(|e| anyhow!("lame channels: {e}"))?;
    builder
        .set_sample_rate(sample_rate)
        .map_err(|e| anyhow!("lame sample rate: {e}"))?;
    builder
        .set_brate(Bitrate::Kbps320)
        .map_err(|e| anyhow!("lame bitrate: {e}"))?;
    builder
        .set_quality(Quality::Best)
        .map_err(|e| anyhow!("lame quality: {e}"))?;
    let mut encoder = builder
        .build()
        .map_err(|e| anyhow!("lame build: {e}"))?;

    let frames = samples.len() / 2;
    let mut left = Vec::with_capacity(frames);
    let mut right = Vec::with_capacity(frames);
    for f in 0..frames {
        left.push((samples[f * 2].clamp(-1.0, 1.0) * i16::MAX as f32) as i16);
        right.push((samples[f * 2 + 1].clamp(-1.0, 1.0) * i16::MAX as f32) as i16);
    }

    let mut out = Vec::new();
    let chunk_size = 1152;
    let mut offset = 0;
    while offset < frames {
        let chunk = (frames - offset).min(chunk_size);
        out.reserve(mp3lame_encoder::max_required_buffer_size(chunk));
        let input = DualPcm {
            left: &left[offset..offset + chunk],
            right: &right[offset..offset + chunk],
        };
        let encoded = encoder
            .encode(input, out.spare_capacity_mut())
            .map_err(|e| anyhow!("lame encode: {e}"))?;
        unsafe {
            out.set_len(out.len() + encoded);
        }
        offset += chunk;
    }

    out.reserve(mp3lame_encoder::max_required_buffer_size(0));
    let flushed = encoder
        .flush::<FlushNoGap>(out.spare_capacity_mut())
        .map_err(|e| anyhow!("lame flush: {e}"))?;
    unsafe {
        out.set_len(out.len() + flushed);
    }
    Ok(out)
}

fn encode_wav(samples: &[f32], channels: u32, sample_rate: u32, bits: u16) -> Result<Vec<u8>> {
    use std::io::Cursor;
    let spec = hound::WavSpec {
        channels: channels as u16,
        sample_rate,
        bits_per_sample: bits,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = Cursor::new(Vec::new());
    let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
    let ch = channels as usize;
    let frames = samples.len() / ch;
    for f in 0..frames {
        for c in 0..ch {
            let s = samples[f * ch + c].clamp(-1.0, 1.0);
            if bits == 16 {
                let v = if s < 0.0 {
                    (s * 32768.0) as i16
                } else {
                    (s * 32767.0) as i16
                };
                writer.write_sample(v)?;
            } else {
                let v = if s < 0.0 {
                    (s * 8_388_608.0) as i32
                } else {
                    (s * 8_388_607.0) as i32
                };
                writer.write_sample(v)?;
            }
        }
    }
    writer.finalize()?;
    Ok(cursor.into_inner())
}

/// Decode, master, and encode to WAV (16- or 24-bit).
pub fn export_mastered_bytes(
    bytes: Vec<u8>,
    preset_id: &str,
    format: &str,
    start_sec: Option<f64>,
    end_sec: Option<f64>,
) -> Result<ExportMasteredResult> {
    if !matches!(preset_id, "streaming" | "wide" | "punch") {
        return Err(anyhow!("unknown preset: {preset_id}"));
    }
    let is_mp3 = format == "mp3";
    let bits: u16 = if format == "wav24" { 24 } else { 16 };

    let (samples, channels, sample_rate) = decode_interleaved(bytes)?;
    let (mut samples, channels) = to_stereo_interleaved(samples, channels);

    if let (Some(s), Some(e)) = (start_sec, end_sec) {
        samples = slice_interleaved(&samples, channels, sample_rate, s, e);
    }

    let duration = samples.len() as f64 / (channels as f64 * sample_rate as f64);
    if duration > MAX_EXPORT_DURATION_SEC {
        return Err(anyhow!(
            "track is longer than {} minutes — shorten before export",
            MAX_EXPORT_DURATION_SEC / 60.0
        ));
    }

    render_enhancement_chain(&mut samples, channels, sample_rate, preset_id)?;

    let mut integrated_lufs = None;
    let mut target_lufs = None;

    if preset_id == "streaming" {
        target_lufs = Some(STREAMING_TARGET_LUFS);
        integrated_lufs = Some(apply_target_integrated_lufs(
            &mut samples,
            channels,
            sample_rate,
            STREAMING_TARGET_LUFS,
        )?);
    } else {
        normalize_peak(&mut samples, 0.944);
    }

    let loudness = measure_interleaved(&samples, channels, sample_rate)?;
    let wav_bytes = if is_mp3 {
        encode_mp3(&samples, channels, sample_rate)?
    } else {
        encode_wav(&samples, channels, sample_rate, bits)?
    };

    Ok(ExportMasteredResult {
        wav_bytes,
        integrated_lufs,
        true_peak_dbtp: loudness.true_peak_dbtp,
        target_lufs,
        preset: preset_id.to_string(),
        bits_per_sample: if is_mp3 { 0 } else { bits },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    fn sine_wav_bytes() -> Vec<u8> {
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 48_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut cursor = std::io::Cursor::new(Vec::new());
        let mut w = hound::WavWriter::new(&mut cursor, spec).unwrap();
        for n in 0..48_000 {
            let s = (2.0 * PI * 440.0 * n as f32 / 48_000.0).sin() * 0.4;
            let v = (s * i16::MAX as f32) as i16;
            w.write_sample(v).unwrap();
            w.write_sample(v).unwrap();
        }
        w.finalize().unwrap();
        cursor.into_inner()
    }

    #[test]
    fn exports_streaming_wav() {
        let r = export_mastered_bytes(sine_wav_bytes(), "streaming", "wav", None, None).unwrap();
        assert!(r.wav_bytes.starts_with(b"RIFF"));
        assert_eq!(r.bits_per_sample, 16);
        assert!(r.integrated_lufs.is_some());
    }

    #[test]
    fn exports_punch_wav24() {
        let r = export_mastered_bytes(sine_wav_bytes(), "punch", "wav24", None, None).unwrap();
        assert!(r.wav_bytes.len() > 44);
        assert_eq!(r.bits_per_sample, 24);
    }

    #[test]
    fn exports_mp3() {
        let r = export_mastered_bytes(sine_wav_bytes(), "streaming", "mp3", None, None).unwrap();
        assert!(r.wav_bytes.len() > 128);
        assert_eq!(r.bits_per_sample, 0);
        assert!(r.wav_bytes.starts_with(b"ID3") || r.wav_bytes[0] == 0xff);
    }
}
