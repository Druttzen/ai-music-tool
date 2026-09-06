//! Stereo correlation and mono-sum peak for phase / width monitoring.

use anyhow::{anyhow, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StereoPhase {
    /// Pearson correlation of L vs R (−1…+1).
    pub correlation: f64,
    pub left_peak: f64,
    pub right_peak: f64,
    pub mono_peak: f64,
    /// How many dB quieter the mono sum is vs the louder channel peak (negative = cancel).
    pub mono_cancel_db: f64,
    pub out_of_phase: bool,
}

pub fn measure_stereo_phase(samples: &[f32], channels: u32) -> Result<StereoPhase> {
    if channels == 0 {
        return Err(anyhow!("invalid channels"));
    }
    if channels == 1 {
        let mut peak = 0.0_f64;
        for &s in samples {
            peak = peak.max(s.abs() as f64);
        }
        return Ok(StereoPhase {
            correlation: 1.0,
            left_peak: peak,
            right_peak: peak,
            mono_peak: peak,
            mono_cancel_db: 0.0,
            out_of_phase: false,
        });
    }

    let frames = samples.len() / 2;
    if frames == 0 {
        return Err(anyhow!("empty audio"));
    }

    let mut sum_l = 0.0_f64;
    let mut sum_r = 0.0_f64;
    let mut sum_ll = 0.0_f64;
    let mut sum_rr = 0.0_f64;
    let mut sum_lr = 0.0_f64;
    let mut left_peak = 0.0_f64;
    let mut right_peak = 0.0_f64;
    let mut mono_peak = 0.0_f64;

    for f in 0..frames {
        let l = samples[f * 2] as f64;
        let r = samples[f * 2 + 1] as f64;
        sum_l += l;
        sum_r += r;
        sum_ll += l * l;
        sum_rr += r * r;
        sum_lr += l * r;
        left_peak = left_peak.max(l.abs());
        right_peak = right_peak.max(r.abs());
        mono_peak = mono_peak.max(((l + r) * 0.5).abs());
    }

    let n = frames as f64;
    let mean_l = sum_l / n;
    let mean_r = sum_r / n;
    let cov = sum_lr / n - mean_l * mean_r;
    let var_l = (sum_ll / n - mean_l * mean_l).max(0.0);
    let var_r = (sum_rr / n - mean_r * mean_r).max(0.0);
    let denom = (var_l * var_r).sqrt();
    let mut correlation = if denom > 1e-12 { cov / denom } else { 1.0 };
    if !correlation.is_finite() {
        correlation = 0.0;
    }
    correlation = correlation.clamp(-1.0, 1.0);

    let channel_peak = left_peak.max(right_peak).max(1e-12);
    let mono_cancel_db = 20.0 * (mono_peak.max(1e-12) / channel_peak).log10();
    let out_of_phase = correlation < -0.25 || mono_cancel_db < -6.0;

    Ok(StereoPhase {
        correlation,
        left_peak,
        right_peak,
        mono_peak,
        mono_cancel_db,
        out_of_phase,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    fn sine_stereo(out_of_phase: bool) -> Vec<f32> {
        let n = 4800;
        let mut v = Vec::with_capacity(n * 2);
        for i in 0..n {
            let s = (2.0 * PI * 440.0 * i as f32 / 48_000.0).sin() * 0.5;
            v.push(s);
            v.push(if out_of_phase { -s } else { s });
        }
        v
    }

    #[test]
    fn in_phase_near_plus_one() {
        let r = measure_stereo_phase(&sine_stereo(false), 2).unwrap();
        assert!(r.correlation > 0.99, "corr={}", r.correlation);
        assert!(!r.out_of_phase);
        assert!(r.mono_cancel_db > -1.0);
    }

    #[test]
    fn out_of_phase_near_minus_one() {
        let r = measure_stereo_phase(&sine_stereo(true), 2).unwrap();
        assert!(r.correlation < -0.99, "corr={}", r.correlation);
        assert!(r.out_of_phase);
        assert!(r.mono_cancel_db < -40.0, "cancel={}", r.mono_cancel_db);
    }
}
