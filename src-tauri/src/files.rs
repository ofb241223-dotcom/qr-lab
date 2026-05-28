use std::{fs, path::PathBuf};

use rfd::FileDialog;

use crate::{
    data_url::{bytes_from_save_request, success_save},
    models::{FileType, SaveFileRequest, SaveFileResult, ScanResult},
    qr,
};

pub fn scan_image_file() -> ScanResult {
    let Some(path) = FileDialog::new()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "svg"])
        .pick_file()
    else {
        return ScanResult::fail("User cancelled file selection");
    };

    match fs::read(&path)
        .map_err(Into::into)
        .and_then(|bytes| qr::decode_qr_from_bytes(&bytes))
    {
        Ok(content) => ScanResult::ok_with_path(content, path.to_string_lossy()),
        Err(err) => ScanResult::fail(err.to_string()),
    }
}

pub fn scan_image_path(path: PathBuf) -> ScanResult {
    if !path.exists() {
        return ScanResult::fail("Dropped file does not exist");
    }
    match fs::read(&path)
        .map_err(Into::into)
        .and_then(|bytes| qr::decode_qr_from_bytes(&bytes))
    {
        Ok(content) => ScanResult::ok_with_path(content, path.to_string_lossy()),
        Err(err) => ScanResult::fail(err.to_string()),
    }
}

pub fn save_file(request: SaveFileRequest) -> SaveFileResult {
    let Some(path) = save_path(&request) else {
        return SaveFileResult {
            success: false,
            path: None,
            error: Some("用户取消了保存操作".to_string()),
        };
    };

    match bytes_from_save_request(&request).and_then(|bytes| {
        fs::write(&path, bytes)?;
        Ok(())
    }) {
        Ok(()) => success_save(path.to_string_lossy()),
        Err(err) => err.into(),
    }
}

fn save_path(request: &SaveFileRequest) -> Option<PathBuf> {
    let extension = match request.file_type {
        FileType::Png => "png",
        FileType::Svg => "svg",
        FileType::Txt => "txt",
    };
    FileDialog::new()
        .add_filter(extension.to_uppercase(), &[extension])
        .set_file_name(&request.filename)
        .save_file()
}
