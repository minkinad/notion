use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppResult;

const MIGRATIONS: [&str; 1] = [include_str!("../../migrations/001_init.sql")];

pub fn run(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY
        );",
    )?;

    let current_version = conn
        .query_row("SELECT MAX(version) FROM _migrations;", [], |row| {
            row.get::<_, Option<i64>>(0)
        })
        .optional()?
        .flatten()
        .unwrap_or(0);

    for (index, migration) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= current_version {
            continue;
        }

        conn.execute_batch("BEGIN IMMEDIATE;")?;
        match conn.execute_batch(migration) {
            Ok(_) => {
                conn.execute("INSERT INTO _migrations (version) VALUES (?1);", [version])?;
                conn.execute_batch("COMMIT;")?;
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(error.into());
            }
        }
    }

    Ok(())
}
