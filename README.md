# Notion

[![CI](https://github.com/minkinad/notion/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/minkinad/notion/actions/workflows/ci.yml)
![Tauri](https://img.shields.io/badge/Tauri-2-black)
![React](https://img.shields.io/badge/React-19-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-black)
![SQLite](https://img.shields.io/badge/SQLite-local-black)

Desktop-first local workspace in the spirit of Notion: strict, minimal, offline-first, and built for serious writing and knowledge work.

## Overview

Noir Note is a native desktop knowledge workspace with a custom Tauri shell, a block editor, nested pages, local SQLite persistence, and a structure that can grow toward sync, accounts, collaboration, exports, and plugins.

The current implementation is optimized for:

- fast local startup;
- keyboard-first editing;
- low visual noise;
- predictable persistence;
- clear separation between shell, UI, editor logic, and data layer.

## Stack

- Tauri 2
- React 19
- TypeScript
- SQLite via `rusqlite`

## Product scope

- Native desktop window for macOS, Windows, and Linux via Tauri
- Custom title bar and local-first workflow
- Sidebar with nested pages, search, and recent documents
- Block editor with slash commands, drag and drop, undo/redo, and autosave
- SQLite storage with migrations and repository-style data access
- Window state persistence and last-opened document restore

## Features

- Custom desktop shell and title bar
- Nested pages and recent documents
- Search-first sidebar with title, path, and content matches
- Block editor with slash commands
- Drag and drop blocks
- Undo and redo
- Local SQLite persistence with migrations
- Last opened page persistence
- Native window state persistence

## Architecture

Frontend:

- `src/components`: desktop UI, editor, sidebar, and empty states
- `src/hooks`: workspace orchestration, hotkeys, and window state persistence
- `src/services`: pure logic for page tree, editor history, slash catalog, and Tauri bridge
- `src/types`: strict domain models
- `src/utils`: editor and block helpers

Desktop and persistence:

- `src-tauri/src/lib.rs`: Tauri bootstrap and command registration
- `src-tauri/src/db`: SQLite migrations and repository layer
- `src-tauri/migrations`: schema migrations for `pages`, `blocks`, and `settings`

This split is intentional: UI remains replaceable, editor logic stays mostly pure, and the data layer is already shaped for future sync and account-backed storage.

## Project structure

```text
.
├── src
│   ├── components
│   ├── hooks
│   ├── services
│   ├── types
│   └── utils
├── src-tauri
│   ├── migrations
│   └── src
│       └── db
├── tests
└── .github/workflows
```

## Development

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri:dev
```

## Quality checks

Typecheck, tests, and production frontend build:

```bash
npm run check
```

Run local quality checks:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

## Production build

```bash
npm run tauri:build
```

Windows installers from a Windows machine:

```bash
npm run tauri:build:windows
```

Windows NSIS installer only:

```bash
npm run tauri:build:windows:nsis
```

CI runs:

- `npm run check`
- `cargo fmt --check`
- `cargo check`

Release automation:

- `.github/workflows/windows-build.yml`: validates that the app bundles on Windows
- `.github/workflows/windows-release.yml`: creates draft Windows releases from `v*` tags

## Keyboard UX

- `Ctrl/Cmd + K`: focus page search
- `Ctrl/Cmd + N`: create page
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z`: redo
- `Type /`: open block command flow
- `Alt + ArrowUp/ArrowDown`: move block

## Data model

SQLite tables:

- `pages`: tree structure, order, timestamps
- `blocks`: page-scoped ordered content blocks
- `settings`: recent pages, last opened page, and app-level state

This keeps the local model simple while leaving room for:

- authentication and remote identities;
- cloud sync;
- real-time collaboration;
- permissions;
- exports to Markdown/PDF;
- plugin hooks;
- database-style views.

## Linux prerequisites

Tauri on Linux needs system packages for GTK/WebKit and `pkg-config`.
Typical Debian/Ubuntu setup:

```bash
sudo apt install pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev patchelf
```

## Roadmap

- page tree reordering and structural drag and drop
- markdown and PDF export
- sync engine and account layer
- collaboration-ready document operations
- plugin and command extension points

## Windows distribution notes

- The repository is configured to ship Windows installers via both `NSIS` (`-setup.exe`) and `WiX` (`.msi`).
- NSIS is configured for `currentUser` installs to reduce elevation friction.
- WiX uses a fixed `upgradeCode`, so future releases upgrade in place instead of installing as a separate app.
- WebView2 is bundled via the embedded bootstrapper mode, which avoids a hard dependency on a live internet connection during install while keeping installer size reasonable.
