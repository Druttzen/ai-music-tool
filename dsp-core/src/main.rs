//! CLI front-end for the DSP core, used to test the library standalone before
//! it is wired into Tauri.
//!
//!   cargo run -- path/to/track.wav
//!
//! Prints the loudness measurement as JSON (same shape the Tauri command will
//! return to the UI).

use anyhow::{anyhow, Result};

fn main() -> Result<()> {
    let path = std::env::args()
        .nth(1)
        .ok_or_else(|| anyhow!("usage: dsp-core <path-to-wav>"))?;

    let loudness = dsp_core::measure_loudness_wav(&path)?;
    println!("{}", serde_json::to_string_pretty(&loudness)?);
    Ok(())
}
