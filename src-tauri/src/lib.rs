mod camera;
mod data_url;
mod errors;
mod files;
mod models;
mod qr;
mod screen;
mod storage;

use std::sync::Arc;

use camera::CameraManager;
use errors::AppError;
use models::{
    AppSettings, BridgeInfo, CameraDevice, CameraScanOptions, HistoryItem, HistoryItemInput,
    ImageScanRequest, Platform, QrGenerateOptions, QrOutput, QrPayload, SaveFileRequest,
    SaveFileResult, ScanResult, ScanScreenOptions,
};
use storage::{SharedStorage, Storage};
use tauri::{Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

struct AppState {
    storage: SharedStorage,
    camera: CameraManager,
}

#[tauri::command]
fn get_bridge_info() -> BridgeInfo {
    BridgeInfo {
        is_mock: false,
        platform: current_platform(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
fn list_cameras(state: State<'_, AppState>) -> Result<Vec<CameraDevice>, AppError> {
    state.camera.list_cameras()
}

#[tauri::command]
fn start_camera_scan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    options: CameraScanOptions,
) -> Result<(), AppError> {
    state.camera.start(app, options)
}

#[tauri::command]
fn stop_camera_scan(state: State<'_, AppState>) {
    state.camera.stop();
}

#[tauri::command]
fn scan_image_file() -> ScanResult {
    files::scan_image_file()
}

#[tauri::command]
fn scan_image_path(path: String) -> ScanResult {
    files::scan_image_path(std::path::PathBuf::from(path))
}

#[tauri::command]
fn scan_image_data(request: ImageScanRequest) -> ScanResult {
    qr::scan_image_request(&request)
}

#[tauri::command]
async fn scan_screen(app: tauri::AppHandle, options: Option<ScanScreenOptions>) -> ScanResult {
    let options = options.unwrap_or_default();
    let should_hide = options.hide_window.unwrap_or(false);
    let window = app.get_webview_window("main");
    if should_hide {
        if let Some(window) = window.as_ref() {
            let _ = window.hide();
            let _ = window.minimize();
            let _ = tauri::async_runtime::spawn_blocking(|| {
                std::thread::sleep(std::time::Duration::from_millis(750));
            })
            .await;
        }
    }
    let result =
        match tauri::async_runtime::spawn_blocking(move || screen::scan_screen(options)).await {
            Ok(result) => result,
            Err(err) => ScanResult::fail(format!("Screen scan task failed: {err}")),
        };
    if should_hide {
        if let Some(window) = window.as_ref() {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    result
}

#[tauri::command]
fn generate_qr(payload: QrPayload, options: QrGenerateOptions) -> Result<QrOutput, AppError> {
    qr::generate_qr(&payload, &options)
}

#[tauri::command]
fn save_file(file: SaveFileRequest) -> SaveFileResult {
    files::save_file(file)
}

#[tauri::command]
fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), AppError> {
    app.clipboard()
        .write_text(text)
        .map_err(|err| AppError::Message(err.to_string()))
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, AppError> {
    state.storage.get_history()
}

#[tauri::command]
fn add_history(
    state: State<'_, AppState>,
    item: HistoryItemInput,
) -> Result<HistoryItem, AppError> {
    state.storage.add_history(item)
}

#[tauri::command]
fn delete_history(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_history(&id)
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) -> Result<(), AppError> {
    state.storage.clear_history()
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    state.storage.get_settings()
}

#[tauri::command]
fn update_settings(
    state: State<'_, AppState>,
    patch: serde_json::Value,
) -> Result<AppSettings, AppError> {
    state.storage.update_settings(patch)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|err| Box::<dyn std::error::Error>::from(err.to_string()))?;
            let storage = Arc::new(Storage::new(data_dir)?);
            app.manage(AppState {
                storage,
                camera: CameraManager::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bridge_info,
            list_cameras,
            start_camera_scan,
            stop_camera_scan,
            scan_image_file,
            scan_image_path,
            scan_image_data,
            scan_screen,
            generate_qr,
            save_file,
            copy_to_clipboard,
            get_history,
            add_history,
            delete_history,
            clear_history,
            get_settings,
            update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn current_platform() -> Platform {
    #[cfg(target_os = "windows")]
    {
        Platform::Windows
    }
    #[cfg(target_os = "linux")]
    {
        Platform::Linux
    }
    #[cfg(target_os = "macos")]
    {
        Platform::Macos
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Platform::Unknown
    }
}
