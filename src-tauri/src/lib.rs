mod db;
mod errors;
mod models;

use std::{fs, path::PathBuf};

use db::repository::Database;
use models::{
    BlockInput, CreatePageResponse, PageRecord, WorkspaceContextInput, WorkspaceSnapshot,
};
use tauri::{Manager, State};

#[derive(Clone)]
struct AppState {
    database: Database,
}

#[tauri::command]
fn bootstrap_workspace(state: State<'_, AppState>) -> Result<WorkspaceSnapshot, String> {
    state
        .database
        .load_workspace_snapshot()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_page(
    parent_id: Option<String>,
    title: Option<String>,
    state: State<'_, AppState>,
) -> Result<CreatePageResponse, String> {
    state
        .database
        .create_page(parent_id, title)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_page(
    page_id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<PageRecord, String> {
    state
        .database
        .rename_page(&page_id, &title)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_page(page_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .database
        .delete_page(&page_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_page_blocks(
    page_id: String,
    blocks: Vec<BlockInput>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .database
        .save_blocks(&page_id, &blocks)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_workspace_context(
    input: WorkspaceContextInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .database
        .update_workspace_context(input)
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let app_dir = resolve_app_dir(app)?;
            fs::create_dir_all(&app_dir)?;
            let database = Database::new(app_dir.join("workspace.sqlite3"))?;
            app.manage(AppState { database });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap_workspace,
            create_page,
            rename_page,
            delete_page,
            save_page_blocks,
            update_workspace_context,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run noir note");
}

fn resolve_app_dir(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    Ok(app.path().app_data_dir()?.join("data"))
}
