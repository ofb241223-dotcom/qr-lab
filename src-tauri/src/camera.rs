use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use base64::Engine;
use chrono::Utc;
use image::ImageFormat;
use nokhwa::{
    pixel_format::RgbFormat,
    query,
    utils::{ApiBackend, CameraIndex, RequestedFormat, RequestedFormatType},
    Camera,
};
use tauri::{AppHandle, Emitter};

use crate::{
    errors::{AppError, AppResult},
    models::{CameraDevice, CameraFrame, CameraScanOptions, CameraScanResult, HistorySource},
    qr,
};

#[derive(Default)]
pub struct CameraManager {
    worker: Mutex<Option<CameraWorker>>,
}

struct CameraWorker {
    stop: Arc<AtomicBool>,
    handle: JoinHandle<()>,
}

impl CameraManager {
    pub fn list_cameras(&self) -> AppResult<Vec<CameraDevice>> {
        let cameras = query(ApiBackend::Auto).map_err(|err| AppError::Message(err.to_string()))?;
        Ok(cameras
            .into_iter()
            .enumerate()
            .map(|(index, info)| CameraDevice {
                id: index.to_string(),
                name: info.human_name().to_string(),
            })
            .collect())
    }

    pub fn start(&self, app: AppHandle, options: CameraScanOptions) -> AppResult<()> {
        self.stop();

        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let camera_id = options.camera_id.clone();
        let handle = thread::spawn(move || {
            if let Err(err) = camera_loop(app.clone(), camera_id.clone(), worker_stop) {
                let _ = app.emit("camera-scan-error", err.to_string());
            }
        });
        let mut guard = self.worker.lock().expect("camera lock poisoned");
        *guard = Some(CameraWorker { stop, handle });
        Ok(())
    }

    pub fn stop(&self) {
        let worker = self.worker.lock().expect("camera lock poisoned").take();
        if let Some(worker) = worker {
            worker.stop.store(true, Ordering::SeqCst);
            let _ = worker.handle.join();
        }
    }
}

impl Drop for CameraManager {
    fn drop(&mut self) {
        self.stop();
    }
}

fn camera_loop(app: AppHandle, camera_id: Option<String>, stop: Arc<AtomicBool>) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        nokhwa::nokhwa_initialize(|_| {});
    }

    let camera_index = camera_id
        .as_deref()
        .and_then(|id| id.parse::<u32>().ok())
        .map(CameraIndex::Index)
        .unwrap_or_else(|| CameraIndex::Index(0));
    let requested =
        RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
    let mut camera =
        Camera::new(camera_index, requested).map_err(|err| AppError::Message(err.to_string()))?;
    camera
        .open_stream()
        .map_err(|err| AppError::Message(err.to_string()))?;

    let mut last_content = String::new();
    let mut last_scan = Instant::now() - Duration::from_secs(3);
    let mut last_frame_emit = Instant::now() - Duration::from_secs(1);
    let mut last_decode_attempt = Instant::now() - Duration::from_secs(1);

    while !stop.load(Ordering::SeqCst) {
        let frame = match camera.frame() {
            Ok(frame) => frame,
            Err(err) => {
                let _ = app.emit("camera-scan-error", err.to_string());
                thread::sleep(Duration::from_millis(150));
                continue;
            }
        };
        let decoded = match frame.decode_image::<RgbFormat>() {
            Ok(decoded) => decoded,
            Err(err) => {
                let _ = app.emit("camera-scan-error", err.to_string());
                thread::sleep(Duration::from_millis(150));
                continue;
            }
        };
        let dynamic = image::DynamicImage::ImageRgb8(decoded);

        if last_frame_emit.elapsed() >= Duration::from_millis(180) {
            if let Ok(data_url) = jpeg_data_url(&dynamic) {
                let _ = app.emit(
                    "camera-frame",
                    CameraFrame {
                        camera_id: camera_id.clone(),
                        data_url,
                        timestamp: Utc::now().timestamp_millis(),
                    },
                );
            }
            last_frame_emit = Instant::now();
        }

        if last_decode_attempt.elapsed() >= Duration::from_millis(120) {
            last_decode_attempt = Instant::now();
            if let Ok(content) = qr::decode_qr_from_dynamic_image(&dynamic) {
                if content != last_content || last_scan.elapsed() >= Duration::from_millis(1500) {
                    last_content = content.clone();
                    last_scan = Instant::now();
                    let _ = app.emit(
                        "camera-scan-result",
                        CameraScanResult {
                            success: true,
                            content: Some(content),
                            error: None,
                            source: HistorySource::Camera,
                            camera_id: camera_id.clone(),
                            timestamp: Utc::now().timestamp_millis(),
                        },
                    );
                }
            }
        }

        thread::sleep(Duration::from_millis(35));
    }

    let _ = camera.stop_stream();
    Ok(())
}

fn jpeg_data_url(img: &image::DynamicImage) -> AppResult<String> {
    let resized = img.thumbnail(960, 540);
    let mut cursor = std::io::Cursor::new(Vec::new());
    resized.write_to(&mut cursor, ImageFormat::Jpeg)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(cursor.into_inner());
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}
