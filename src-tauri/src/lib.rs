//! Tauri application logic for AI Music Creator (Path B).

mod sidecar_manager;

use std::sync::Arc;
use std::time::Duration;

use dsp_core::{export_mastered_bytes, ExportMasteredResult, Loudness};
use sidecar_manager::{SidecarManager, SidecarStatus};
use tauri::{Manager, RunEvent};

#[tauri::command]
fn measure_loudness(path: String) -> Result<Loudness, String> {
    dsp_core::measure_loudness_wav(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn measure_loudness_bytes(bytes: Vec<u8>) -> Result<Loudness, String> {
    dsp_core::measure_loudness_bytes(bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_mastered(
    bytes: Vec<u8>,
    preset_id: String,
    format: String,
    start_sec: Option<f64>,
    end_sec: Option<f64>,
) -> Result<ExportMasteredResult, String> {
    export_mastered_bytes(bytes, &preset_id, &format, start_sec, end_sec).map_err(|e| e.to_string())
}

#[tauri::command]
fn sidecar_status(manager: tauri::State<'_, Arc<SidecarManager>>) -> SidecarStatus {
    manager.status()
}

#[tauri::command]
fn ensure_sidecar(
    manager: tauri::State<'_, Arc<SidecarManager>>,
    timeout_ms: Option<u64>,
) -> SidecarStatus {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(30_000).min(120_000));
    manager.wait_until_ready(timeout);
    manager.status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar = Arc::new(SidecarManager::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::clone(&sidecar))
        .setup({
            let sidecar_setup = Arc::clone(&sidecar);
            move |app| {
                sidecar_setup.set_app_handle(app.handle().clone());
                let bg = Arc::clone(&sidecar_setup);
                std::thread::spawn(move || {
                    bg.ensure_started();
                    // Packaged PyInstaller cold start can take longer than dev uvicorn.
                    bg.wait_until_ready(Duration::from_secs(90));
                });
                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            measure_loudness,
            measure_loudness_bytes,
            export_mastered,
            sidecar_status,
            ensure_sidecar,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::Exit) {
                if let Some(manager) = app_handle.try_state::<Arc<SidecarManager>>() {
                    manager.stop();
                }
            }
        });
}
