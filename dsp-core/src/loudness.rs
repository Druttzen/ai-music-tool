//! EBU R128 loudness measurement and streaming-target normalization.

use anyhow::{anyhow, Context, Result};
use ebur128::{EbuR128, Mode};

use crate::Loudness;

pub const STREAMING_TARGET_LUFS: f64 = -14.0;

pub fn measure_interleaved(samples: &[f32], channels: u32, sample_rate: u32) -> Result<Loudness> {
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

/// Iterative gain + true-peak limit to hit integrated LUFS (mirrors JS `applyTargetIntegratedLufs`).
pub fn apply_target_integrated_lufs(
    samples: &mut [f32],
    channels: u32,
    sample_rate: u32,
    target_lufs: f64,
) -> Result<f64> {
    for _ in 0..5 {
        let current = measure_interleaved(samples, channels, sample_rate)?;
        let gain_db = target_lufs - current.integrated_lufs;
        if gain_db.abs() < 0.05 {
            break;
        }
        let gain = 10.0f32.powf((gain_db as f32) / 20.0);
        for s in samples.iter_mut() {
            *s *= gain;
        }

        let tp = measure_interleaved(samples, channels, sample_rate)?.true_peak_dbtp;
        if tp > -1.0 {
            let tp_gain = 10.0f32.powf(((-1.0 - tp) as f32) / 20.0);
            for s in samples.iter_mut() {
                *s *= tp_gain;
            }
        }
    }
    Ok(measure_interleaved(samples, channels, sample_rate)?.integrated_lufs)
}

pub fn normalize_peak(samples: &mut [f32], target_peak: f32) {
    let peak = samples.iter().fold(0.0f32, |m, &v| m.max(v.abs()));
    if peak < 1e-8 {
        return;
    }
    let gain = target_peak / peak;
    for s in samples.iter_mut() {
        *s *= gain;
    }
}
