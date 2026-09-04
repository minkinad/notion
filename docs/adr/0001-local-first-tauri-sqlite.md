# ADR-0001: Local-first Tauri application with SQLite

- Status: Accepted
- Date: 2026-09-04

## Context

Noir Note needs responsive offline editing, user-owned storage, a native desktop window, and a small
distribution footprint. The current product has no collaboration or cross-device consistency
requirements that justify operating a remote service.

## Decision

Ship a Tauri 2 desktop application with a React WebView and a Rust-owned SQLite database. React owns
ephemeral editing state and communicates through explicitly registered Tauri commands. Rust owns
durable invariants, migrations, and transactions. Workspace data stays in the platform app-data
directory and no account is required.

## Consequences

- The application starts and edits without a network connection.
- Users retain direct custody of their workspace and backups.
- SQLite provides transactions, foreign keys, WAL, and simple packaging.
- The OS account is the security boundary; application-level encryption is not provided.
- Multi-device sync and collaboration require a future protocol, conflict model, and security ADR.
- Browser-only development cannot exercise persistence commands.

## Alternatives considered

- Browser storage: rejected because migrations, backups, native integration, and large durable
  workspaces are harder to control reliably.
- Embedded local HTTP server: rejected because it adds ports, lifecycle, and network attack surface
  without a current product need.
- Cloud database as source of truth: rejected because it would make accounts, connectivity, service
  operations, and remote trust mandatory.

## Migration notes

A future sync or encryption design must preserve existing local workspaces, define recovery and
conflict behavior, and supersede this ADR if ownership of the source of truth changes.
