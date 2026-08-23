//! Tauri application logic for AI Music Creator (Path B).

mod canvas_handoff;
mod sidecar_extra_install;
mod sidecar_manager;
mod sidecar_userdata;
mod studio_updater;

use std::sync::Arc;
use std::time::Duration;

use canvas_handoff::{
    export_canvas_handoff, install_canvas_addon, launch_canvas_addon, suite_canvas_addon_status,
};
use dsp_core::{export_mastered_bytes, ExportMasteredResult, Loudness};
use sidecar_extra_install::{install_sidecar_extra, probe_sidecar_extra_install_env};
use sidecar_manager::{SidecarManager, SidecarStatus};
use studio_updater::{check_studio_update, install_studio_update};
use tauri::{Manager, RunEvent};

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
fn sidecar_auth_token(manager: tauri::State<'_, Arc<SidecarManager>>) -> Option<String> {
    manager.auth_token()
}

#[tauri::command]
async fn ensure_sidecar(
    manager: tauri::State<'_, Arc<SidecarManager>>,
    timeout_ms: Option<u64>,
) -> Result<SidecarStatus, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(30_000).min(120_000));
    let mgr = Arc::clone(manager.inner());
    let _ready = tauri::async_runtime::spawn_blocking(move || mgr.wait_until_ready(timeout))
        .await
        .map_err(|e| e.to_string())?;
    Ok(manager.status())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar = Arc::new(SidecarManager::default());
    sidecar.start_health_poller();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Arc::clone(&sidecar))
        .setup({
            let sidecar_setup = Arc::clone(&sidecar);
            move |app| {
                sidecar_setup.set_app_handle(app.handle().clone());
                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            measure_loudness_bytes,
            export_mastered,
            sidecar_status,
            sidecar_auth_token,
            ensure_sidecar,
            export_canvas_handoff,
            suite_canvas_addon_status,
            launch_canvas_addon,
            install_canvas_addon,
            install_sidecar_extra,
            probe_sidecar_extra_install_env,
            check_studio_update,
            install_studio_update,
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

#[cfg(test)]
mod loudness_command_tests {
    use super::measure_loudness_bytes;
    use std::f32::consts::PI;

    fn stereo_sine_wav() -> Vec<u8> {
        const SR: u32 = 48_000;
        const N: u32 = 48_000;
        let data_bytes = N * 4;
        let mut buf = Vec::with_capacity(44 + data_bytes as usize);
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&(36 + data_bytes as u32).to_le_bytes());
        buf.extend_from_slice(b"WAVE");
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&SR.to_le_bytes());
        buf.extend_from_slice(&(SR * 4).to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&16u16.to_le_bytes());
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&(data_bytes as u32).to_le_bytes());
        for n in 0..N {
            let s = (2.0 * PI * 1000.0 * n as f32 / SR as f32).sin() * 0.5;
            let v = (s * i16::MAX as f32) as i16;
            buf.extend_from_slice(&v.to_le_bytes());
            buf.extend_from_slice(&v.to_le_bytes());
        }
        buf
    }

    #[test]
    fn studio_native_lufs_bytes_command_works() {
        let result = measure_loudness_bytes(stereo_sine_wav()).expect("native LUFS");
        assert_eq!(result.channels, 2);
        assert_eq!(result.sample_rate, 48_000);
        assert!(result.integrated_lufs.is_finite(), "integrated LUFS must be finite");
        assert!(result.true_peak_dbtp <= 0.5);
    }
}
