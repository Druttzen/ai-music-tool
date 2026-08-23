//! Stream install subprocess output and parse pip-style download sizes.

use std::io::{BufRead, BufReader};
use std::process::{Command, Output, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const SIDECAR_INSTALL_PROGRESS_EVENT: &str = "sidecar-extra-install-progress";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarInstallProgressPayload {
    pub extra_id: String,
    pub phase: String,
    pub line: Option<String>,
    pub parsed_bytes: Option<u64>,
}

pub fn emit_install_progress(
    app: &AppHandle,
    extra_id: &str,
    phase: &str,
    line: Option<&str>,
    parsed_bytes: Option<u64>,
) {
    let clipped = line.map(|s| s.chars().take(240).collect::<String>());
    let _ = app.emit(
        SIDECAR_INSTALL_PROGRESS_EVENT,
        SidecarInstallProgressPayload {
            extra_id: extra_id.to_string(),
            phase: phase.to_string(),
            line: clipped,
            parsed_bytes,
        },
    );
}

fn unit_multiplier(unit: &str) -> Option<f64> {
    let u = unit.trim().trim_end_matches('s').to_ascii_lowercase();
    match u.as_str() {
        "b" | "byte" => Some(1.0),
        "kb" | "kib" => Some(1_000.0),
        "mb" | "mib" => Some(1_000_000.0),
        "gb" | "gib" => Some(1_000_000_000.0),
        _ => None,
    }
}

fn parse_size_token(raw: &str) -> Option<u64> {
    let s = raw.trim();
    let bytes = s.as_bytes();
    if bytes.is_empty() || !(bytes[0].is_ascii_digit() || bytes[0] == b'.') {
        return None;
    }
    let mut num_end = 1;
    while num_end < bytes.len() && (bytes[num_end].is_ascii_digit() || bytes[num_end] == b'.') {
        num_end += 1;
    }
    let value: f64 = s[..num_end].parse().ok()?;
    let rest = s[num_end..].trim();
    let mul = unit_multiplier(rest)?;
    Some((value * mul) as u64)
}

fn parse_paren_size(line: &str) -> Option<u64> {
    let start = line.find('(')?;
    let end = line[start + 1..].find(')')?;
    parse_size_token(line[start + 1..start + 1 + end].trim())
}

fn parse_slash_current(line: &str) -> Option<u64> {
    let slash = line.find('/')?;
    let left = line[..slash].trim();
    let right = line[slash + 1..].trim();
    let left_num = left
        .rsplit(|c: char| !c.is_ascii_digit() && c != '.')
        .find(|part| part.chars().any(|c| c.is_ascii_digit()))?;
    let unit = right
        .split_whitespace()
        .find(|token| unit_multiplier(token).is_some())
        .or_else(|| {
            let i = right.find(|c: char| c.is_ascii_alphabetic())?;
            Some(right[i..].trim())
        })?;
    parse_size_token(&format!("{left_num}{unit}"))
}

pub fn parse_pip_progress_bytes(line: &str) -> Option<u64> {
    parse_paren_size(line).or_else(|| parse_slash_current(line))
}

pub fn kill_process(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill")
            .args(["-9", &format!("-{pid}")])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

fn pump_reader<R: std::io::Read + Send + 'static>(
    reader: R,
    collected: Arc<Mutex<Vec<u8>>>,
    tx: mpsc::Sender<String>,
) {
    let buf = BufReader::new(reader);
    for line in buf.lines() {
        match line {
            Ok(text) => {
                if let Ok(mut out) = collected.lock() {
                    out.extend_from_slice(text.as_bytes());
                    out.push(b'\n');
                }
                if tx.send(text).is_err() {
                    break;
                }
            }
            Err(_) => break,
        }
    }
}

/// Run a command, streaming stdout/stderr lines to `on_line` until exit or timeout.
pub fn run_command_streaming(
    mut cmd: Command,
    timeout: Duration,
    mut on_line: impl FnMut(&str),
) -> Result<Output, String> {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to run install command: {e}"))?;
    let pid = child.id();
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let out_buf = Arc::new(Mutex::new(Vec::new()));
    let err_buf = Arc::new(Mutex::new(Vec::new()));
    let (tx, rx) = mpsc::channel::<String>();
    let out_tx = tx.clone();
    let err_tx = tx;
    let out_clone = Arc::clone(&out_buf);
    let err_clone = Arc::clone(&err_buf);
    thread::spawn(move || pump_reader(stdout, out_clone, out_tx));
    thread::spawn(move || pump_reader(stderr, err_clone, err_tx));

    let started = Instant::now();
    loop {
        let slice = Duration::from_millis(120);
        let drain_until = Instant::now() + slice;
        while Instant::now() < drain_until {
            match rx.recv_timeout(drain_until.saturating_duration_since(Instant::now())) {
                Ok(line) => on_line(&line),
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                while let Ok(line) = rx.try_recv() {
                    on_line(&line);
                }
                let stdout = out_buf.lock().map(|g| g.clone()).unwrap_or_default();
                let stderr = err_buf.lock().map(|g| g.clone()).unwrap_or_default();
                return Ok(Output {
                    status,
                    stdout,
                    stderr,
                });
            }
            Ok(None) => {
                if started.elapsed() > timeout {
                    kill_process(pid);
                    let _ = child.wait();
                    return Err(format!(
                        "Install timed out after {} minutes",
                        timeout.as_secs() / 60
                    ));
                }
            }
            Err(e) => return Err(format!("Failed to run install command: {e}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_wheel_paren_megabytes() {
        let line = "Downloading demucs-4.0.0-py3-none-any.whl (25.1 MB)";
        assert_eq!(parse_pip_progress_bytes(line), Some(25_100_000));
    }

    #[test]
    fn parse_progress_bar_fraction() {
        let line = "━━━━━━━━━━━━━━━━━━━━ 12.3/45.6 MB 2.1 MB/s";
        assert_eq!(parse_pip_progress_bytes(line), Some(12_300_000));
    }

    #[test]
    fn parse_gigabyte_paren() {
        let line = "Downloading torch-2.4.0 (2.5 GB)";
        assert_eq!(parse_pip_progress_bytes(line), Some(2_500_000_000));
    }
}
