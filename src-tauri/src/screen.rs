use std::{path::PathBuf, process::Command};

use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::{ScanResult, ScanScreenOptions},
    qr,
};

pub fn scan_screen(options: ScanScreenOptions) -> ScanResult {
    if options.interactive.unwrap_or(false) {
        match scan_interactive_region() {
            Ok(result) => return result,
            Err(err) => {
                let fallback = scan_full_screen();
                if fallback.success {
                    return fallback;
                }
                return ScanResult::fail(format!(
                    "{err}; fallback: {}",
                    fallback.error.unwrap_or_default()
                ));
            }
        }
    }
    scan_full_screen()
}

fn scan_full_screen() -> ScanResult {
    let screens = match screenshots::Screen::all() {
        Ok(screens) => screens,
        Err(err) => return ScanResult::fail(format!("Failed to list screens: {err}")),
    };

    for screen in screens {
        let image = match screen.capture() {
            Ok(image) => image,
            Err(_) => continue,
        };
        let width = image.width();
        let height = image.height();
        let Some(buffer) = image::ImageBuffer::from_raw(width, height, image.into_raw()) else {
            continue;
        };
        let dynamic = image::DynamicImage::ImageRgba8(buffer);
        if let Ok(content) = qr::decode_qr_from_dynamic_image(&dynamic) {
            return ScanResult::ok(content);
        }
    }

    ScanResult::fail("No QR code detected on screen")
}

fn scan_interactive_region() -> AppResult<ScanResult> {
    let path = temp_capture_path();
    capture_region_to_path(&path)?;

    let bytes = std::fs::read(&path)?;
    let result = match qr::decode_qr_from_bytes(&bytes) {
        Ok(content) => ScanResult::ok_with_path(content, path.to_string_lossy()),
        Err(err) => ScanResult::fail(err.to_string()),
    };
    let _ = std::fs::remove_file(&path);
    Ok(result)
}

#[cfg(target_os = "macos")]
fn capture_region_to_path(path: &PathBuf) -> AppResult<()> {
    capture_macos_region(path)
}

#[cfg(target_os = "linux")]
fn capture_region_to_path(path: &PathBuf) -> AppResult<()> {
    capture_linux_region(path)
}

#[cfg(target_os = "windows")]
fn capture_region_to_path(_path: &PathBuf) -> AppResult<()> {
    Err(AppError::Message(
        "Interactive region screenshot is not implemented on Windows yet".to_string(),
    ))
}

fn temp_capture_path() -> PathBuf {
    std::env::temp_dir().join(format!("qr-lab-region-{}.png", Uuid::new_v4()))
}

#[cfg(target_os = "macos")]
fn capture_macos_region(path: &PathBuf) -> AppResult<()> {
    let status = Command::new("screencapture")
        .arg("-i")
        .arg(path)
        .status()
        .map_err(|err| AppError::Message(format!("Failed to start screencapture: {err}")))?;
    if status.success() && path.exists() {
        Ok(())
    } else {
        Err(AppError::Message(
            "macOS screenshot selection was cancelled or failed".to_string(),
        ))
    }
}

#[cfg(target_os = "linux")]
fn capture_linux_region(path: &PathBuf) -> AppResult<()> {
    let path_str = path.to_string_lossy().to_string();
    let commands = [
        vec!["gnome-screenshot", "-a", "-f", &path_str],
        vec!["spectacle", "-b", "-r", "-o", &path_str],
        vec!["mate-screenshot", "-a", "-f", &path_str],
        vec!["xfce4-screenshooter", "-r", "-s", &path_str],
    ];

    for command in commands {
        if run_capture_command(&command).is_ok() && path.exists() {
            return Ok(());
        }
    }

    if command_exists("flameshot") {
        let output = Command::new("flameshot")
            .args(["gui", "-r"])
            .output()
            .map_err(|err| AppError::Message(format!("Failed to start flameshot: {err}")))?;
        if output.status.success() && !output.stdout.is_empty() {
            std::fs::write(path, output.stdout)?;
            return Ok(());
        }
    }

    if command_exists("grim") && command_exists("slurp") {
        let script = format!("grim -g \"$(slurp)\" '{}'", path_str.replace('\'', "'\\''"));
        let status = Command::new("sh").arg("-c").arg(script).status()?;
        if status.success() && path.exists() {
            return Ok(());
        }
    }

    Err(AppError::Message(
        "No supported region screenshot tool found. Install gnome-screenshot, spectacle, mate-screenshot, xfce4-screenshooter, flameshot, or grim+slurp.".to_string(),
    ))
}

#[cfg(target_os = "linux")]
fn run_capture_command(command: &[&str]) -> AppResult<()> {
    if command.is_empty() || !command_exists(command[0]) {
        return Err(AppError::Message("command not found".to_string()));
    }
    let status = Command::new(command[0]).args(&command[1..]).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::Message(format!(
            "{} exited with {status}",
            command[0]
        )))
    }
}

#[cfg(target_os = "linux")]
fn command_exists(command: &str) -> bool {
    Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {command} >/dev/null 2>&1"))
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}
