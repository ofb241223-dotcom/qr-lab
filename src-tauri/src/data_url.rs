use base64::Engine;

use crate::{
    errors::{AppError, AppResult},
    models::{BinaryEncoding, ImageScanRequest, SaveEncoding, SaveFileRequest, SaveFileResult},
};

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_SAVE_BYTES: usize = 50 * 1024 * 1024;

pub fn bytes_from_image_request(request: &ImageScanRequest) -> AppResult<Vec<u8>> {
    let bytes = match request.encoding {
        BinaryEncoding::Base64 => decode_base64_body(&request.content)?,
        BinaryEncoding::DataUrl => decode_data_url(&request.content)?.1,
    };
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::Message(
            "Image input is larger than 25MB".to_string(),
        ));
    }
    Ok(bytes)
}

pub fn bytes_from_save_request(request: &SaveFileRequest) -> AppResult<Vec<u8>> {
    let bytes = match request.encoding {
        SaveEncoding::Text => request.content.as_bytes().to_vec(),
        SaveEncoding::Base64 => decode_base64_body(&request.content)?,
        SaveEncoding::DataUrl => decode_data_url(&request.content)?.1,
    };
    if bytes.len() > MAX_SAVE_BYTES {
        return Err(AppError::Message(
            "Save content is larger than 50MB".to_string(),
        ));
    }
    Ok(bytes)
}

pub fn decode_data_url(input: &str) -> AppResult<(String, Vec<u8>)> {
    let (meta, body) = input
        .split_once(',')
        .ok_or_else(|| AppError::Message("Invalid data URL".to_string()))?;
    if !meta.starts_with("data:") {
        return Err(AppError::Message("Invalid data URL prefix".to_string()));
    }
    if !meta.ends_with(";base64") {
        return Err(AppError::Message(
            "Only base64 data URLs are supported".to_string(),
        ));
    }
    let mime = meta
        .trim_start_matches("data:")
        .trim_end_matches(";base64")
        .to_string();
    Ok((mime, decode_base64_body(body)?))
}

pub fn success_save(path: impl Into<String>) -> SaveFileResult {
    SaveFileResult {
        success: true,
        path: Some(path.into()),
        error: None,
    }
}

fn decode_base64_body(input: &str) -> AppResult<Vec<u8>> {
    let sanitized = input.trim();
    Ok(base64::engine::general_purpose::STANDARD.decode(sanitized)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{FileType, SaveEncoding};

    #[test]
    fn decodes_base64_data_url() {
        let (_, bytes) = decode_data_url("data:text/plain;base64,aGVsbG8=").unwrap();

        assert_eq!(bytes, b"hello");
    }

    #[test]
    fn converts_text_save_request_to_bytes() {
        let bytes = bytes_from_save_request(&SaveFileRequest {
            content: "hello".to_string(),
            encoding: SaveEncoding::Text,
            filename: "hello.txt".to_string(),
            file_type: FileType::Txt,
        })
        .unwrap();

        assert_eq!(bytes, b"hello");
    }
}
