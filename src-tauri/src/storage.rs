use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use chrono::Utc;
use serde::{de::DeserializeOwned, Serialize};
use uuid::Uuid;

use crate::{
    errors::AppResult,
    models::{AppSettings, HistoryItem, HistoryItemInput},
};

const HISTORY_LIMIT: usize = 500;

#[derive(Debug)]
pub struct Storage {
    root: PathBuf,
    lock: Mutex<()>,
}

pub type SharedStorage = Arc<Storage>;

impl Storage {
    pub fn new(root: PathBuf) -> AppResult<Self> {
        fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            lock: Mutex::new(()),
        })
    }

    pub fn get_history(&self) -> AppResult<Vec<HistoryItem>> {
        self.read_json("history.json", Vec::new())
    }

    pub fn add_history(&self, input: HistoryItemInput) -> AppResult<HistoryItem> {
        let settings = self.get_settings()?;
        let item = HistoryItem {
            id: Uuid::new_v4().to_string(),
            r#type: input.r#type,
            data_type: input.data_type,
            content: input.content,
            source: input.source,
            file_path: input.file_path,
            timestamp: Utc::now().timestamp_millis(),
        };
        if settings.save_history {
            let mut history = self.get_history()?;
            history.insert(0, item.clone());
            history.truncate(HISTORY_LIMIT);
            self.write_json("history.json", &history)?;
        }
        Ok(item)
    }

    pub fn delete_history(&self, id: &str) -> AppResult<()> {
        let mut history = self.get_history()?;
        history.retain(|item| item.id != id);
        self.write_json("history.json", &history)
    }

    pub fn clear_history(&self) -> AppResult<()> {
        self.write_json("history.json", &Vec::<HistoryItem>::new())
    }

    pub fn get_settings(&self) -> AppResult<AppSettings> {
        self.read_json("settings.json", AppSettings::default())
    }

    pub fn update_settings(&self, patch: serde_json::Value) -> AppResult<AppSettings> {
        let mut current = serde_json::to_value(self.get_settings()?)?;
        merge_json(&mut current, patch);
        let updated: AppSettings = serde_json::from_value(current)?;
        self.write_json("settings.json", &updated)?;
        Ok(updated)
    }

    fn read_json<T: DeserializeOwned>(&self, filename: &str, fallback: T) -> AppResult<T> {
        let _guard = self.lock.lock().expect("storage lock poisoned");
        let path = self.root.join(filename);
        if !path.exists() {
            return Ok(fallback);
        }
        let raw = fs::read_to_string(path)?;
        if raw.trim().is_empty() {
            return Ok(fallback);
        }
        Ok(serde_json::from_str(&raw)?)
    }

    fn write_json<T: Serialize>(&self, filename: &str, value: &T) -> AppResult<()> {
        let _guard = self.lock.lock().expect("storage lock poisoned");
        let path = self.root.join(filename);
        let raw = serde_json::to_string_pretty(value)?;
        fs::write(path, raw)?;
        Ok(())
    }
}

fn merge_json(current: &mut serde_json::Value, patch: serde_json::Value) {
    if let (Some(current), Some(patch)) = (current.as_object_mut(), patch.as_object()) {
        for (key, value) in patch {
            current.insert(key.clone(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DataType, HistoryKind, HistorySource, Theme};

    #[test]
    fn add_history_persists_newest_first() {
        let dir = std::env::temp_dir().join(format!("qr-lab-test-{}", Uuid::new_v4()));
        let storage = Storage::new(dir.clone()).unwrap();

        storage
            .add_history(HistoryItemInput {
                r#type: HistoryKind::Scan,
                data_type: DataType::Text,
                content: "one".to_string(),
                source: Some(HistorySource::File),
                file_path: None,
            })
            .unwrap();
        storage
            .add_history(HistoryItemInput {
                r#type: HistoryKind::Generate,
                data_type: DataType::Url,
                content: "two".to_string(),
                source: Some(HistorySource::Manual),
                file_path: Some("/tmp/two.png".to_string()),
            })
            .unwrap();

        let history = storage.get_history().unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].content, "two");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn update_settings_merges_partial_patch() {
        let dir = std::env::temp_dir().join(format!("qr-lab-test-{}", Uuid::new_v4()));
        let storage = Storage::new(dir.clone()).unwrap();

        let updated = storage
            .update_settings(serde_json::json!({ "theme": "light", "autoCopy": true }))
            .unwrap();

        assert_eq!(updated.theme, Theme::Light);
        assert!(updated.auto_copy);
        assert!(updated.confirm_before_open_url);
        let _ = fs::remove_dir_all(dir);
    }
}
