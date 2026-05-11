use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use crate::{
    db::migrations,
    errors::{AppError, AppResult},
    models::{
        BlockInput, BlockRecord, CreatePageResponse, PageRecord, WorkspaceContextInput,
        WorkspaceSnapshot,
    },
};

const RECENT_PAGE_LIMIT: usize = 8;
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone)]
pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(path: impl AsRef<Path>) -> AppResult<Self> {
        let database = Self {
            path: path.as_ref().to_path_buf(),
        };

        database.initialize()?;
        Ok(database)
    }

    pub fn load_workspace_snapshot(&self) -> AppResult<WorkspaceSnapshot> {
        let conn = self.connection()?;
        let mut page_stmt = conn.prepare(
            "SELECT id, parent_id, title, position, created_at, updated_at
             FROM pages
             ORDER BY COALESCE(parent_id, ''), position, created_at;",
        )?;
        let pages = page_stmt
            .query_map([], map_page)?
            .collect::<Result<Vec<_>, _>>()?;

        let mut block_stmt = conn.prepare(
            "SELECT id, page_id, type, content, checked, position, created_at, updated_at
             FROM blocks
             ORDER BY page_id, position, created_at;",
        )?;
        let blocks = block_stmt
            .query_map([], map_block)?
            .collect::<Result<Vec<_>, _>>()?;

        let active_page_id = self.setting_string(&conn, "last_open_page_id")?;
        let recent_page_ids = self
            .setting_json::<Vec<String>>(&conn, "recent_page_ids")?
            .unwrap_or_default()
            .into_iter()
            .take(RECENT_PAGE_LIMIT)
            .collect();

        Ok(WorkspaceSnapshot {
            pages,
            blocks,
            active_page_id,
            recent_page_ids,
        })
    }

    pub fn create_page(
        &self,
        parent_id: Option<String>,
        title: Option<String>,
    ) -> AppResult<CreatePageResponse> {
        let conn = self.connection()?;
        let now = timestamp();
        let page_id = new_id();
        let block_id = new_id();
        let page_title = title.unwrap_or_else(|| "Untitled".to_string());
        let position = next_page_position(&conn, parent_id.as_deref())?;

        conn.execute(
            "INSERT INTO pages (id, parent_id, title, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
            params![&page_id, &parent_id, &page_title, position, &now, &now],
        )?;
        conn.execute(
            "INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
             VALUES (?1, ?2, 'text', '', 0, 0, ?3, ?4);",
            params![&block_id, &page_id, &now, &now],
        )?;

        Ok(CreatePageResponse {
            page: PageRecord {
                id: page_id.clone(),
                parent_id,
                title: page_title,
                position,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            initial_block: BlockRecord {
                id: block_id,
                page_id,
                block_type: "text".to_string(),
                content: String::new(),
                checked: false,
                position: 0,
                created_at: now.clone(),
                updated_at: now,
            },
        })
    }

    pub fn rename_page(&self, page_id: &str, title: &str) -> AppResult<PageRecord> {
        let conn = self.connection()?;
        let updated_at = timestamp();
        conn.execute(
            "UPDATE pages
             SET title = ?2, updated_at = ?3
             WHERE id = ?1;",
            params![page_id, title.trim(), &updated_at],
        )?;

        self.load_page(&conn, page_id)?
            .ok_or_else(|| AppError::InvalidState(format!("page {} not found", page_id)))
    }

    pub fn delete_page(&self, page_id: &str) -> AppResult<()> {
        let conn = self.connection()?;
        conn.execute("DELETE FROM pages WHERE id = ?1;", [page_id])?;
        Ok(())
    }

    pub fn save_blocks(&self, page_id: &str, blocks: &[BlockInput]) -> AppResult<Vec<BlockRecord>> {
        let mut conn = self.connection()?;
        let tx = conn.transaction()?;
        let now = timestamp();

        tx.execute("DELETE FROM blocks WHERE page_id = ?1;", [page_id])?;

        let mut saved = Vec::with_capacity(blocks.len());
        {
            let mut stmt = tx.prepare(
                "INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
            )?;

            for (position, block) in blocks.iter().enumerate() {
                let block_id = if block.id.trim().is_empty() {
                    new_id()
                } else {
                    block.id.clone()
                };

                stmt.execute(params![
                    &block_id,
                    page_id,
                    &block.block_type,
                    &block.content,
                    if block.checked { 1 } else { 0 },
                    position as i64,
                    &now,
                    &now
                ])?;

                saved.push(BlockRecord {
                    id: block_id,
                    page_id: page_id.to_string(),
                    block_type: block.block_type.clone(),
                    content: block.content.clone(),
                    checked: block.checked,
                    position: position as i64,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                });
            }
        }

        tx.execute(
            "UPDATE pages
             SET updated_at = ?2
             WHERE id = ?1;",
            params![page_id, now],
        )?;
        tx.commit()?;

        Ok(saved)
    }

    pub fn update_workspace_context(&self, input: WorkspaceContextInput) -> AppResult<()> {
        let conn = self.connection()?;
        self.set_setting_json(&conn, "recent_page_ids", &input.recent_page_ids)?;

        if let Some(page_id) = input.active_page_id {
            self.set_setting_string(&conn, "last_open_page_id", &page_id)?;
        }

        Ok(())
    }

    pub fn load_page(&self, conn: &Connection, page_id: &str) -> AppResult<Option<PageRecord>> {
        conn.query_row(
            "SELECT id, parent_id, title, position, created_at, updated_at
             FROM pages
             WHERE id = ?1;",
            [page_id],
            map_page,
        )
        .optional()
        .map_err(Into::into)
    }

    fn initialize(&self) -> AppResult<()> {
        let conn = self.connection()?;
        migrations::run(&conn)?;
        self.seed_if_empty(&conn)?;
        Ok(())
    }

    fn connection(&self) -> AppResult<Connection> {
        let conn = Connection::open(&self.path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        Ok(conn)
    }

    fn seed_if_empty(&self, conn: &Connection) -> AppResult<()> {
        let count = conn.query_row("SELECT COUNT(*) FROM pages;", [], |row| {
            row.get::<_, i64>(0)
        })?;
        if count > 0 {
            return Ok(());
        }

        let now = timestamp();
        let page_id = new_id();

        conn.execute(
            "INSERT INTO pages (id, parent_id, title, position, created_at, updated_at)
             VALUES (?1, NULL, 'Workspace', 0, ?2, ?3);",
            params![&page_id, &now, &now],
        )?;

        let blocks = [
            ("heading", "Quiet workspace", false, 0_i64),
            (
                "text",
                "Build documents, notes and structured knowledge locally.",
                false,
                1_i64,
            ),
            ("todo", "Capture the next action", true, 2_i64),
            ("quote", "Write only what matters.", false, 3_i64),
        ];

        let mut stmt = conn.prepare(
            "INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
        )?;
        for (block_type, content, checked, position) in blocks {
            stmt.execute(params![
                new_id(),
                &page_id,
                block_type,
                content,
                if checked { 1 } else { 0 },
                position,
                &now,
                &now
            ])?;
        }

        self.set_setting_string(conn, "last_open_page_id", &page_id)?;
        self.set_setting_json(conn, "recent_page_ids", &vec![page_id])?;
        Ok(())
    }

    fn setting_string(&self, conn: &Connection, key: &str) -> AppResult<Option<String>> {
        conn.query_row("SELECT value FROM settings WHERE key = ?1;", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(Into::into)
    }

    fn setting_json<T: serde::de::DeserializeOwned>(
        &self,
        conn: &Connection,
        key: &str,
    ) -> AppResult<Option<T>> {
        self.setting_string(conn, key)?
            .map(|value| serde_json::from_str(&value).map_err(Into::into))
            .transpose()
    }

    fn set_setting_string(&self, conn: &Connection, key: &str, value: &str) -> AppResult<()> {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE
             SET value = excluded.value, updated_at = excluded.updated_at;",
            params![key, value, timestamp()],
        )?;
        Ok(())
    }

    fn set_setting_json<T: serde::Serialize>(
        &self,
        conn: &Connection,
        key: &str,
        value: &T,
    ) -> AppResult<()> {
        let payload = serde_json::to_string(value)?;
        self.set_setting_string(conn, key, &payload)
    }
}

fn timestamp() -> String {
    Utc::now().to_rfc3339()
}

fn new_id() -> String {
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!(
        "n_{}_{}",
        Utc::now().timestamp_nanos_opt().unwrap_or_default(),
        counter
    )
}

fn next_page_position(conn: &Connection, parent_id: Option<&str>) -> AppResult<i64> {
    let result = if let Some(parent_id) = parent_id {
        conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1
             FROM pages
             WHERE parent_id = ?1;",
            [parent_id],
            |row| row.get(0),
        )?
    } else {
        conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1
             FROM pages
             WHERE parent_id IS NULL;",
            [],
            |row| row.get(0),
        )?
    };

    Ok(result)
}

fn map_page(row: &rusqlite::Row<'_>) -> rusqlite::Result<PageRecord> {
    Ok(PageRecord {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        title: row.get(2)?,
        position: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn map_block(row: &rusqlite::Row<'_>) -> rusqlite::Result<BlockRecord> {
    Ok(BlockRecord {
        id: row.get(0)?,
        page_id: row.get(1)?,
        block_type: row.get(2)?,
        content: row.get(3)?,
        checked: row.get::<_, i64>(4)? == 1,
        position: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}
