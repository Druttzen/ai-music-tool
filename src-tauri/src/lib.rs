//! Tauri application logic for AI Music Creator (Path B).
//!
//! Commands here are the UI ↔ native bridge. The first command exposes the Rust
//! DSP core's loudness measurement, replacing the in-browser JS EBU R128 meter.

use dsp_core::Loudness;

/// Measure EBU R128 integrated loudness + true peak of a WAV file on disk.
///
/// Invoked from the web UI as `invoke("measure_loudness", { path })`.
#[tauri::command]
fn measure_loudness(path: String) -> Result<Loudness, String> {
    dsp_core::measure_loudness_wav(&path).map_err(|e| e.to_string())
}

/// Measure loudness directly from encoded audio bytes (MP3/M4A/OGG/FLAC/WAV).
///
/// Invoked from the web UI as `invoke("measure_loudness_bytes", { bytes })`,
/// passing the original file blob — no browser-side decode required.
#[tauri::command]
fn measure_loudness_bytes(bytes: Vec<u8>) -> Result<Loudness, String> {
    dsp_core::measure_loudness_bytes(bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![measure_loudness, measure_loudness_bytes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
