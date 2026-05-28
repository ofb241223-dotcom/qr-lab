use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeInfo {
    pub is_mock: bool,
    pub platform: Platform,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Windows,
    Linux,
    Macos,
    Browser,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CameraDevice {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CameraScanOptions {
    pub camera_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScanResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl ScanResult {
    pub fn ok(content: impl Into<String>) -> Self {
        Self {
            success: true,
            content: Some(content.into()),
            error: None,
            path: None,
        }
    }

    pub fn ok_with_path(content: impl Into<String>, path: impl Into<String>) -> Self {
        Self {
            success: true,
            content: Some(content.into()),
            error: None,
            path: Some(path.into()),
        }
    }

    pub fn fail(error: impl Into<String>) -> Self {
        Self {
            success: false,
            content: None,
            error: Some(error.into()),
            path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanScreenOptions {
    pub interactive: Option<bool>,
    pub hide_window: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CameraScanResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub source: HistorySource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_id: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CameraFrame {
    pub camera_id: Option<String>,
    pub data_url: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageScanRequest {
    pub content: String,
    pub encoding: BinaryEncoding,
    pub mime_type: Option<String>,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BinaryEncoding {
    Base64,
    DataUrl,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QrPayload {
    pub r#type: DataType,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QrGenerateOptions {
    pub width: Option<u32>,
    pub margin: Option<u32>,
    pub error_correction_level: Option<ErrorCorrectionLevel>,
    pub foreground: Option<String>,
    pub background: Option<String>,
    pub dot_style: Option<String>,
    pub eye_style: Option<String>,
    pub logo_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QrOutput {
    #[serde(rename = "pngDataUrl")]
    pub png_data_url: String,
    #[serde(rename = "svgText")]
    pub svg_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SaveFileRequest {
    pub content: String,
    pub encoding: SaveEncoding,
    pub filename: String,
    #[serde(rename = "fileType")]
    pub file_type: FileType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SaveEncoding {
    Text,
    Base64,
    DataUrl,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Png,
    Svg,
    Txt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SaveFileResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DataType {
    Text,
    Url,
    Wifi,
    Vcard,
    Email,
    Sms,
    Phone,
    Geo,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryKind {
    Scan,
    Generate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistorySource {
    Camera,
    Screen,
    File,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub r#type: HistoryKind,
    pub data_type: DataType,
    pub content: String,
    pub source: Option<HistorySource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItemInput {
    pub r#type: HistoryKind,
    pub data_type: DataType,
    pub content: String,
    pub source: Option<HistorySource>,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: Theme,
    pub auto_copy: bool,
    pub sound_enabled: bool,
    pub shortcut_capture: String,
    pub confirm_before_open_url: bool,
    pub save_history: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            auto_copy: false,
            sound_enabled: false,
            shortcut_capture: "Ctrl+Shift+S".to_string(),
            confirm_before_open_url: true,
            save_history: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorCorrectionLevel {
    L,
    M,
    Q,
    H,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_settings_defaults_match_frontend_defaults() {
        let settings = AppSettings::default();

        assert_eq!(settings.theme, Theme::Dark);
        assert!(!settings.auto_copy);
        assert!(!settings.sound_enabled);
        assert_eq!(settings.shortcut_capture, "Ctrl+Shift+S");
        assert!(settings.confirm_before_open_url);
        assert!(settings.save_history);
    }

    #[test]
    fn camel_case_history_serialization_matches_bridge_contract() {
        let item = HistoryItem {
            id: "1".to_string(),
            r#type: HistoryKind::Scan,
            data_type: DataType::Url,
            content: "https://example.com".to_string(),
            source: Some(HistorySource::Camera),
            file_path: Some("/tmp/example.png".to_string()),
            timestamp: 42,
        };

        let value = serde_json::to_value(item).unwrap();

        assert_eq!(value["type"], "scan");
        assert_eq!(value["dataType"], "url");
        assert_eq!(value["source"], "camera");
        assert_eq!(value["filePath"], "/tmp/example.png");
    }
}
