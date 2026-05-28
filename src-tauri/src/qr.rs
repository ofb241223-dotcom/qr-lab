use std::collections::HashSet;

use base64::Engine;
use image::{DynamicImage, ImageFormat, Rgba};
use qrcode::{render::svg, EcLevel, QrCode};
use rxing::{
    common::HybridBinarizer, BarcodeFormat, BinaryBitmap, BufferedImageLuminanceSource,
    DecodeHints, MultiFormatReader, Reader, SVGLuminanceSource,
};

use crate::{
    data_url::bytes_from_image_request,
    errors::{AppError, AppResult},
    models::{
        ErrorCorrectionLevel, ImageScanRequest, QrGenerateOptions, QrOutput, QrPayload, ScanResult,
    },
};

pub fn scan_image_request(request: &ImageScanRequest) -> ScanResult {
    match bytes_from_image_request(request).and_then(|bytes| decode_qr_from_bytes(&bytes)) {
        Ok(content) => ScanResult::ok(content),
        Err(err) => ScanResult::fail(err.to_string()),
    }
}

pub fn decode_qr_from_bytes(bytes: &[u8]) -> AppResult<String> {
    if looks_like_svg(bytes) {
        return decode_qr_from_svg(bytes);
    }
    let img = image::load_from_memory(bytes)?;
    decode_qr_from_dynamic_image(&img)
}

pub fn decode_qr_from_dynamic_image(img: &DynamicImage) -> AppResult<String> {
    if let Ok(content) = decode_qr_with_rxing(img.clone()) {
        return Ok(content);
    }

    let contrast = img.adjust_contrast(40.0);
    if let Ok(content) = decode_qr_with_rxing(contrast) {
        return Ok(content);
    }

    let mut inverted = img.clone();
    inverted.invert();
    decode_qr_with_rxing(inverted)
}

fn decode_qr_from_svg(bytes: &[u8]) -> AppResult<String> {
    let mut reader = MultiFormatReader::default();
    let hints = qr_hints();
    let svg_source =
        SVGLuminanceSource::new(bytes).map_err(|err| AppError::Message(err.to_string()))?;
    let result = reader
        .decode_with_hints(
            &mut BinaryBitmap::new(HybridBinarizer::new(svg_source)),
            &hints,
        )
        .map_err(|err| AppError::Message(err.to_string()))?;
    Ok(result.getText().to_string())
}

fn decode_qr_with_rxing(img: DynamicImage) -> AppResult<String> {
    let mut reader = MultiFormatReader::default();
    let hints = qr_hints();
    let result = reader
        .decode_with_hints(
            &mut BinaryBitmap::new(HybridBinarizer::new(BufferedImageLuminanceSource::new(img))),
            &hints,
        )
        .map_err(|err| AppError::Message(err.to_string()))?;
    Ok(result.getText().to_string())
}

fn qr_hints() -> DecodeHints {
    DecodeHints {
        PossibleFormats: Some(HashSet::from([BarcodeFormat::QR_CODE])),
        TryHarder: Some(true),
        ..Default::default()
    }
}

fn looks_like_svg(bytes: &[u8]) -> bool {
    let prefix_len = bytes.len().min(512);
    let Ok(prefix) = std::str::from_utf8(&bytes[..prefix_len]) else {
        return false;
    };
    let trimmed = prefix.trim_start();
    trimmed.starts_with("<svg") || trimmed.starts_with("<?xml") && trimmed.contains("<svg")
}

pub fn generate_qr(payload: &QrPayload, options: &QrGenerateOptions) -> AppResult<QrOutput> {
    let level = match options
        .error_correction_level
        .as_ref()
        .unwrap_or(&ErrorCorrectionLevel::M)
    {
        ErrorCorrectionLevel::L => EcLevel::L,
        ErrorCorrectionLevel::M => EcLevel::M,
        ErrorCorrectionLevel::Q => EcLevel::Q,
        ErrorCorrectionLevel::H => EcLevel::H,
    };
    let code = QrCode::with_error_correction_level(payload.content.as_bytes(), level)
        .map_err(|err| AppError::Message(err.to_string()))?;
    let width = options.width.unwrap_or(400);
    let margin = options.margin.unwrap_or(4);
    let dark = parse_hex_rgba(
        options.foreground.as_deref().unwrap_or("#000000"),
        [0, 0, 0, 255],
    );
    let light = parse_hex_rgba(
        options.background.as_deref().unwrap_or("#ffffff"),
        [255, 255, 255, 255],
    );

    let image = code
        .render::<Rgba<u8>>()
        .quiet_zone(true)
        .module_dimensions(1, 1)
        .dark_color(Rgba(dark))
        .light_color(Rgba(light))
        .build();
    let image = DynamicImage::ImageRgba8(image).resize_exact(
        width + margin.saturating_mul(2),
        width + margin.saturating_mul(2),
        image::imageops::FilterType::Nearest,
    );

    let mut cursor = std::io::Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Png)?;
    let png_data = base64::engine::general_purpose::STANDARD.encode(cursor.into_inner());
    let png_data_url = format!("data:image/png;base64,{png_data}");

    let svg_text = code
        .render::<svg::Color>()
        .min_dimensions(width, width)
        .quiet_zone(true)
        .dark_color(svg::Color(
            options.foreground.as_deref().unwrap_or("#000000"),
        ))
        .light_color(svg::Color(
            options.background.as_deref().unwrap_or("#ffffff"),
        ))
        .build();

    Ok(QrOutput {
        png_data_url,
        svg_text,
    })
}

fn parse_hex_rgba(input: &str, fallback: [u8; 4]) -> [u8; 4] {
    let trimmed = input.trim();
    if trimmed.starts_with("gradient:") {
        return fallback;
    }
    let hex = trimmed.trim_start_matches('#');
    if hex.len() != 6 {
        return fallback;
    }
    let Ok(r) = u8::from_str_radix(&hex[0..2], 16) else {
        return fallback;
    };
    let Ok(g) = u8::from_str_radix(&hex[2..4], 16) else {
        return fallback;
    };
    let Ok(b) = u8::from_str_radix(&hex[4..6], 16) else {
        return fallback;
    };
    [r, g, b, 255]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DataType, QrPayload};

    #[test]
    fn generated_qr_can_be_decoded_by_backend() {
        let output = generate_qr(
            &QrPayload {
                r#type: DataType::Text,
                content: "hello backend".to_string(),
            },
            &QrGenerateOptions {
                width: Some(256),
                margin: Some(4),
                error_correction_level: Some(ErrorCorrectionLevel::M),
                foreground: Some("#000000".to_string()),
                background: Some("#ffffff".to_string()),
                dot_style: None,
                eye_style: None,
                logo_data_url: None,
            },
        )
        .unwrap();
        let request = ImageScanRequest {
            content: output.png_data_url,
            encoding: crate::models::BinaryEncoding::DataUrl,
            mime_type: None,
            filename: None,
        };

        assert_eq!(
            scan_image_request(&request).content.as_deref(),
            Some("hello backend")
        );
    }

    #[test]
    fn generated_svg_qr_can_be_decoded_by_backend() {
        let output = generate_qr(
            &QrPayload {
                r#type: DataType::Text,
                content: "hello svg backend".to_string(),
            },
            &QrGenerateOptions {
                width: Some(256),
                margin: Some(4),
                error_correction_level: Some(ErrorCorrectionLevel::M),
                foreground: Some("#000000".to_string()),
                background: Some("#ffffff".to_string()),
                dot_style: None,
                eye_style: None,
                logo_data_url: None,
            },
        )
        .unwrap();

        assert_eq!(
            decode_qr_from_bytes(output.svg_text.as_bytes()).unwrap(),
            "hello svg backend"
        );
    }
}
