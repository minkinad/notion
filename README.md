# Noir Note

Desktop-first local workspace in the spirit of Notion.

## Stack

- Tauri 2
- React 19
- TypeScript
- SQLite via `rusqlite`

## Features

- Custom desktop shell and title bar
- Nested pages and recent documents
- Search-first sidebar
- Block editor with slash commands
- Drag and drop blocks
- Undo and redo
- Local SQLite persistence with migrations
- Last opened page persistence
- Native window state persistence

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

## Production build

```bash
npm run tauri:build
```

## Linux prerequisites

Tauri on Linux needs system packages for GTK/WebKit and `pkg-config`.
Typical Debian/Ubuntu setup:

```bash
sudo apt install pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev patchelf
```
