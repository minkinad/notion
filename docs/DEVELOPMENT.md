# Development Guide

## Toolchain

- Node.js 22 with npm (the version used by CI)
- Rust stable with Cargo and rustfmt
- Tauri 2 platform prerequisites

Install JavaScript dependencies from the lockfile:

```bash
npm ci
```

On Debian/Ubuntu, install the desktop libraries listed in the
[README](../README.md#linux-debianubuntu). Other platforms should follow the official Tauri 2
prerequisites.

## Development loops

Run the complete desktop application:

```bash
npm run tauri:dev
```

Run the Vite UI only:

```bash
npm run dev
```

The browser-only server is useful for static layout work. Workspace bootstrap and mutations call
Tauri IPC, so a normal browser cannot exercise the complete application.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run check

cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
```

Tests are compiled with `tsconfig.test.json` and executed with Node's built-in test runner. Keep
state, tree, history, block, and queue logic outside components where possible so it can remain fast
and deterministic.

## Common change recipes

### Add a block type

1. Extend `BlockType` in `src/types/domain.ts`.
2. Add catalog metadata and UI behavior.
3. Validate the value in the Rust command/repository boundary.
4. Add tests for conversion, persistence, and keyboard behavior.
5. Update the feature table if the type is user-visible.

### Change the schema

1. Add the next numbered SQL file under `src-tauri/migrations/`.
2. Append it to `MIGRATIONS` in `src-tauri/src/db/migrations.rs`.
3. Keep the migration transactional and forward-compatible where practical.
4. Test both a new database and an upgrade from the previous release.
5. Update architecture and backup/rollback notes.

Never rewrite a migration that may already exist in a user workspace.

### Add a Tauri command

1. Define and serialize explicit input/output models.
2. Validate input in Rust and keep SQL in the repository.
3. Register the command in `src-tauri/src/lib.rs`.
4. Add a typed wrapper in `src/services/tauriApi.ts`.
5. Review whether the command or capability changes the security model.

## Packaging

```bash
npm run tauri:build
npm run tauri:build:windows
npm run tauri:build:windows:nsis
```

Tauri builds for the host platform. Windows-specific commands therefore require a Windows runner.
Use the [release checklist](operations/runbook.md#release-checklist) before publishing artifacts.
