//! EBU R128 loudness measurement and streaming-target normalization.

use anyhow::{anyhow, Context, Result};
use ebur128::{EbuR128, Mode};
use std::collections::VecDeque;

use crate::Loudness;

pub const STREAMING_TARGET_LUFS: f64 = -14.0;
pub const PODCAST_TARGET_LUFS: f64 = -16.0;
pub const BROADCAST_TARGET_LUFS: f64 = -23.0;
pub const TRUE_PEAK_CEILING_DBTP: f64 = -1.0;
pub const EXPORT_SAMPLE_RATE: u32 = 48_000;

fn finite_or_none(v: f64) -> Option<f64> {
    if v.is_finite() {
        Some(v)
    } else {
        None
    }
}

pub fn measure_interleaved(samples: &[f32], channels: u32, sample_rate: u32) -> Result<Loudness> {
    if channels == 0 || sample_rate == 0 {
        return Err(anyhow!("invalid audio: channels={channels} sample_rate={sample_rate}"));
    }
    let frames = samples.len() / channels as usize;
    let duration_sec = frames as f64 / sample_rate as f64;

    // I|S|TRUE_PEAK: integrated + short-term (+ momentary via S) + true peak.
    let mut meter = EbuR128::new(channels, sample_rate, Mode::I | Mode::S | Mode::TRUE_PEAK)
        .context("initializing ebur128 meter")?;

    let ch = channels as usize;
    let block = (sample_rate as usize / 10).max(1) * ch; // ~100 ms interleaved
    let mut max_short = f64::NEG_INFINITY;
    let mut max_mom = f64::NEG_INFINITY;

    for chunk in samples.chunks(block) {
        if chunk.len() < ch {
            break;
        }
        let usable = chunk.len() - (chunk.len() % ch);
        if usable == 0 {
            continue;
        }
        meter
            .add_frames_f32(&chunk[..usable])
            .context("feeding samples to meter")?;
        if let Ok(s) = meter.loudness_shortterm() {
            if s.is_finite() && s > max_short {
                max_short = s;
            }
        }
        if let Ok(m) = meter.loudness_momentary() {
            if m.is_finite() && m > max_mom {
                max_mom = m;
            }
        }
    }

    let integrated_lufs = meter.loudness_global().context("integrated loudness")?;

    let mut true_peak_linear = 0.0f64;
    for ch_i in 0..channels {
        let tp = meter.true_peak(ch_i).context("true peak")?;
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
        short_term_lufs: finite_or_none(max_short),
        momentary_lufs: finite_or_none(max_mom),
        channels,
        sample_rate,
        duration_sec,
    })
}

/// 4× linear-upsample peak estimate (cheap true-peak proxy for limiting).
fn oversampled_peak_frame(samples: &[f32], frame: usize, channels: usize, frames: usize) -> f32 {
    let mut peak = 0.0f32;
    for c in 0..channels {
        let i0 = frame * channels + c;
        let x0 = samples[i0];
        peak = peak.max(x0.abs());
        if frame + 1 < frames {
            let x1 = samples[i0 + channels];
            for k in 1..4 {
                let t = k as f32 / 4.0;
                let y = x0 + (x1 - x0) * t;
                peak = peak.max(y.abs());
            }
        }
    }
    peak
}

/// Lookahead brickwall limiter aiming for a true-peak ceiling (dBTP).
pub fn limit_true_peak(
    samples: &mut [f32],
    channels: u32,
    sample_rate: u32,
    ceiling_dbtp: f64,
) {
    let ch = channels as usize;
    if ch == 0 || samples.len() < ch {
        return;
    }
    let frames = samples.len() / ch;
    if frames == 0 {
        return;
    }
    // Drive the cheap oversampled limiter slightly below the ceiling so ebur128
    // true-peak (inter-sample) still lands under the advertised limit.
    let drive_ceiling_db = ceiling_dbtp - 0.35;
    let ceiling = 10.0f32.powf((drive_ceiling_db as f32) / 20.0).max(1e-6);
    let lookahead = ((sample_rate as f32) * 0.005).round().max(1.0) as usize;
    let attack = 1.0 - (-1.0f32 / ((sample_rate as f32) * 0.0003)).exp();
    let release = 1.0 - (-1.0f32 / ((sample_rate as f32) * 0.08)).exp();

    let mut peaks = vec![0.0f32; frames];
    for frame in 0..frames {
        peaks[frame] = oversampled_peak_frame(samples, frame, ch, frames);
    }

    let mut target = vec![1.0f32; frames];
    let mut window = VecDeque::new();
    let initial_end = lookahead.min(frames - 1);
    for index in 0..=initial_end {
        while window
            .back()
            .is_some_and(|&back| peaks[back] <= peaks[index])
        {
            window.pop_back();
        }
        window.push_back(index);
    }
    for frame in 0..frames {
        while window.front().is_some_and(|&front| front < frame) {
            window.pop_front();
        }
        let max_p = peaks[*window
            .front()
            .expect("lookahead window always contains the current frame")];
        let next = frame + lookahead + 1;
        if next < frames {
            while window
                .back()
                .is_some_and(|&back| peaks[back] <= peaks[next])
            {
                window.pop_back();
            }
            window.push_back(next);
        }
        if max_p > ceiling {
            target[frame] = ceiling / max_p;
        }
    }

    let mut env = 1.0f32;
    for frame in 0..frames {
        let needed = target[frame];
        let coeff = if needed < env { attack } else { release };
        env += coeff * (needed - env);
        let g = env;
        let base = frame * ch;
        for c in 0..ch {
            samples[base + c] *= g;
        }
    }

    // Final ebur128 true-peak trim (authoritative).
    for _ in 0..3 {
        let Ok(m) = measure_interleaved(samples, channels, sample_rate) else {
            break;
        };
        if m.true_peak_dbtp <= ceiling_dbtp + 0.01 {
            break;
        }
        let trim = 10.0f32.powf(((ceiling_dbtp - m.true_peak_dbtp) as f32) / 20.0);
        for s in samples.iter_mut() {
            *s *= trim;
        }
    }
}

/// Iterative gain + true-peak limit to hit integrated LUFS.
pub fn apply_target_integrated_lufs(
    samples: &mut [f32],
    channels: u32,
    sample_rate: u32,
    target_lufs: f64,
) -> Result<f64> {
    for _ in 0..6 {
        let current = measure_interleaved(samples, channels, sample_rate)?;
        let gain_db = target_lufs - current.integrated_lufs;
        if gain_db.abs() < 0.05 && current.true_peak_dbtp <= TRUE_PEAK_CEILING_DBTP + 0.05 {
            break;
        }
        if gain_db.abs() >= 0.05 {
            let gain = 10.0f32.powf((gain_db as f32) / 20.0);
            for s in samples.iter_mut() {
                *s *= gain;
            }
        }
        limit_true_peak(samples, channels, sample_rate, TRUE_PEAK_CEILING_DBTP);
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    fn loud_stereo_tone(seconds: f32, amp: f32, sr: u32) -> Vec<f32> {
        let n = (seconds * sr as f32) as usize;
        let mut out = Vec::with_capacity(n * 2);
        for i in 0..n {
            let s = (2.0 * PI * 1000.0 * i as f32 / sr as f32).sin() * amp;
            out.push(s);
            out.push(s);
        }
        out
    }

    #[test]
    fn limiter_holds_ceiling() {
        let sr = 48_000u32;
        let mut samples = loud_stereo_tone(1.0, 0.95, sr);
        limit_true_peak(&mut samples, 2, sr, TRUE_PEAK_CEILING_DBTP);
        let m = measure_interleaved(&samples, 2, sr).unwrap();
        assert!(
            m.true_peak_dbtp <= TRUE_PEAK_CEILING_DBTP + 0.15,
            "tp={} dBTP",
            m.true_peak_dbtp
        );
    }

    #[test]
    fn streaming_target_hits_lufs_and_tp() {
        let sr = 48_000u32;
        let mut samples = loud_stereo_tone(3.0, 0.7, sr);
        let after = apply_target_integrated_lufs(&mut samples, 2, sr, STREAMING_TARGET_LUFS).unwrap();
        assert!(
            (after - STREAMING_TARGET_LUFS).abs() <= 0.3,
            "integrated={after}"
        );
        let m = measure_interleaved(&samples, 2, sr).unwrap();
        assert!(
            m.true_peak_dbtp <= TRUE_PEAK_CEILING_DBTP + 0.05,
            "tp={} dBTP",
            m.true_peak_dbtp
        );
        assert!(m.short_term_lufs.is_some());
        assert!(m.momentary_lufs.is_some());
    }

    #[test]
    fn limiter_handles_lookahead_window_at_buffer_end() {
        let sr = 48_000u32;
        let mut samples = loud_stereo_tone(0.02, 0.95, sr);
        limit_true_peak(&mut samples, 2, sr, TRUE_PEAK_CEILING_DBTP);
        let measured = measure_interleaved(&samples, 2, sr).unwrap();
        assert!(measured.true_peak_dbtp <= TRUE_PEAK_CEILING_DBTP + 0.15);
    }
}
