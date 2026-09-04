# Operations Runbook

Noir Note has no server fleet to operate. Operations concern user data, local startup, packaging,
and release artifacts.

## Locate the workspace

The Rust core resolves Tauri's platform-specific application data directory for the identifier
`com.minkin.noirnote`, then stores data under:

```text
<app-data-directory>/data/workspace.sqlite3
```

Exact parent paths vary by operating system and packaging. Do not hard-code a platform path in
application logic. A live WAL database may also have `workspace.sqlite3-wal` and
`workspace.sqlite3-shm` companions.

## Backup

Safest manual procedure:

1. Confirm the title bar reports `Saved`.
2. Close Noir Note completely and verify the process has exited.
3. Copy the entire `data` directory to a separate protected location.
4. Record the Noir Note version or commit that created the backup.
5. Verify the copy is non-empty; for important data, perform a restore drill on a separate OS
   account or disposable environment.

Do not copy only the main database while the application is running. A live backup must use the
SQLite backup API or include a consistent WAL state; the application does not expose that workflow
yet.

## Restore

1. Close Noir Note and preserve the current `data` directory as a rollback copy.
2. Replace the complete `data` directory with the known-good backup.
3. Start the same or a newer compatible Noir Note version; migrations run forward automatically.
4. Verify several pages, nested pages, checkboxes, recent navigation, and a new test edit.
5. Keep the rollback copy until verification is complete.

Never open an important workspace with an older release after a newer release has migrated it unless
the release notes explicitly declare backward compatibility.

## Common incidents

### Workspace fails to open

1. Stop restarting the application repeatedly and copy the complete `data` directory.
2. Confirm free disk space and OS permissions for the app-data directory.
3. Capture sanitized application errors without note content or full personal paths.
4. Test the binary with a fresh OS profile or moved **copy** of the data, not by deleting the only
   workspace.
5. Open a support issue with version, OS, and reproduction details. Keep the database private.

### Save state remains in error

1. Stop editing until the cause is understood; visible state may be newer than durable state.
2. Check available disk space, filesystem permissions, and endpoint-security quarantine events.
3. Close the app only after copying any recoverable text that is still visible.
4. Restart and verify the last durable content. Preserve the data directory before repair attempts.

### Window opens off-screen

The window-state plugin owns placement independently of note data. Reset only its platform-specific
state after preserving the app-data directory. Do not remove `workspace.sqlite3` to repair window
geometry.

### Suspected database corruption

1. Preserve byte-for-byte copies of the database and WAL/SHM files.
2. Restore the newest verified backup for normal work.
3. Perform SQLite recovery only on a copy and record the SQLite/tool version used.
4. Compare recovered page/block counts and manually verify important documents before replacement.

## Release checklist

1. Confirm version alignment in `package.json`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json`.
2. Run `npm ci`, `npm run check`, `cargo fmt --check`, and `cargo check` from clean lockfiles.
3. Test a fresh workspace and an upgrade copy from the previous release.
4. Exercise create, rename, nested delete, search, slash commands, drag/drop, undo/redo, autosave,
   close/reopen, backup, and restore.
5. Build target installers on native runners and scan the artifacts.
6. Sign/notarize artifacts when infrastructure is available; document unsigned artifacts clearly.
7. Push a `v*` tag, inspect the draft release, verify filenames/checksums, and smoke-test downloads.
8. Publish release notes with schema, compatibility, security, and known-issue sections.

## Rollback

Prefer rolling back the application while retaining a backup of the migrated data. Schema rollback
is not automatic. If a release changes the schema incompatibly, use a pre-upgrade workspace backup
or a purpose-built forward repair migration rather than ad-hoc destructive SQL.
