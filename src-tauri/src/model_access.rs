//! Validate and store a Hugging Face token in its standard app-owned cache.
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::Duration;
use tauri::AppHandle;

fn store_token(cache: &Path, token: &str) -> Result<(), String> {
    fs::create_dir_all(cache).map_err(|_| "Cannot open Studio model cache".to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(cache).map_err(|_| "Cannot save model access".to_string())?;
    temp.write_all(token.as_bytes()).map_err(|_| "Cannot save model access".to_string())?;
    temp.persist(cache.join("token")).map_err(|_| "Cannot save model access".to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn connect_huggingface(app: AppHandle, token: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = token.trim();
        if !token.starts_with("hf_") || token.len() > 512 || token.chars().any(char::is_whitespace) {
            return Err("Enter a Hugging Face read token from your own account".into());
        }
        let response = reqwest::blocking::Client::builder().timeout(Duration::from_secs(30)).build()
            .map_err(|_| "Could not connect to Hugging Face")?
            .get("https://huggingface.co/api/whoami-v2").bearer_auth(token).send()
            .map_err(|_| "Could not connect to Hugging Face; check your network")?;
        if !response.status().is_success() {
            return Err("Hugging Face did not accept this token. Check its read permission and account.".into());
        }
        let root = crate::sidecar_userdata::user_sidecar_root(&app)?;
        store_token(&root.join("cache/huggingface"), token)?;
        Ok("Hugging Face connected. Accept the model's access conditions, then retry its installation.".into())
    }).await.map_err(|_| "Model connection did not finish".to_string())?
}

#[cfg(test)]
mod tests {
    #[test]
    fn token_is_stored_only_in_the_app_cache_and_can_be_replaced() {
        let root = tempfile::tempdir().unwrap();
        super::store_token(root.path(), "first").unwrap();
        super::store_token(root.path(), "second").unwrap();
        assert_eq!(std::fs::read_to_string(root.path().join("token")).unwrap(), "second");
    }
}
