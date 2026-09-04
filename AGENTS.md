# Noir Note Agent Guide

## Scope

These instructions apply to the entire repository. Preserve unrelated working-tree changes and keep
changes narrowly aligned with the requested task.

## Architecture invariants

- Keep Noir Note offline-first and desktop-first. Do not introduce a hosted dependency, telemetry,
  account requirement, or network call without an explicit product decision.
- Treat Rust as the owner of durable data. React accesses persistence only through the typed wrappers
  in `src/services/tauriApi.ts`; it must not access the filesystem or SQLite directly.
- Keep Tauri commands narrow. Validate untrusted command input in Rust before it reaches SQL.
- Keep SQLite foreign keys enabled and mutations transactional. Every schema change requires a new,
  append-only migration in `src-tauri/migrations/` plus registration in `db/migrations.rs`.
- Never edit an already released migration. Add a new migration instead.
- Preserve page-tree cascade semantics: deleting a page deletes its descendants and blocks.
- Preserve autosave ordering. Writes for one key are serialized and a newer pending value must win
  over an older in-flight value.
- Keep Tauri capabilities least-privileged and document any new permission in the change.
- Do not log note content, full workspace paths, database contents, or release secrets.

## Code conventions

- TypeScript remains strict; prefer pure functions in `src/services` and `src/utils` for logic that
  can be unit tested without a WebView.
- UI components render and emit intent. Workspace orchestration belongs in hooks, persistence
  contracts in services, and durable invariants in Rust.
- Rust repository functions return `AppResult`; translate errors to the Tauri boundary only in
  command handlers.
- Avoid broad reformatting and generated-file churn. `package-lock.json` and `Cargo.lock` stay
  committed.
- Use small Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` or
  `perf:`.
- Update `docs/ARCHITECTURE.md` or add/supersede an ADR when a boundary, data owner, trust decision,
  migration policy, or delivery model changes.

## Required checks

Run the complete local gate before handoff:

```bash
npm ci
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
```

For installer or Tauri configuration changes, also run `npm run tauri:build` on the affected target
when the platform is available. If a platform-specific check cannot run, state that explicitly.

## Documentation map

- `README.md` — product overview, quick start, capabilities, and limitations.
- `docs/ARCHITECTURE.md` — runtime boundaries, data flow, persistence, and known risks.
- `docs/DEVELOPMENT.md` — toolchain, commands, tests, and change recipes.
- `docs/adr/` — decisions that are costly or risky to reverse.
- `docs/operations/runbook.md` — workspace backup, restore, incidents, and release checklist.
- `SECURITY.md` — vulnerability reporting and the supported security boundary.
- `SUPPORT.md` — public support and diagnostics route.
