# ScriptSmith

ScriptSmith is an offline-first writing studio designed specifically for writers.

## Principles

- Offline-first
- No AI
- No required account
- No required subscription
- Manuscripts remain on the writer's computer unless the writer chooses otherwise
- Real local files, not browser `localStorage`
- Writer-focused tools built on a stable document foundation

## Foundation

The first foundation is a Tauri desktop application with a vanilla HTML/CSS/JavaScript frontend and a Rust desktop layer. Tauri officially supports a JavaScript frontend with a Rust backend and native desktop packaging. The project follows Tauri's standard `src` + `src-tauri` structure.

## Current foundation

- Application shell
- Writing editor
- Basic formatting toolbar
- Document model
- Native Open/Save dialogs
- Local ScriptSmith JSON document format
- Word and character counts
- Tauri desktop configuration
- Windows MSI/NSIS packaging targets
- Capability configuration

## Development

Install Node.js and Rust/Tauri prerequisites first. Then:

```bash
npm install
npm run tauri dev
```

For a production build:

```bash
npm run tauri build
```

## Roadmap

1. Stabilize the document/editor engine.
2. Add robust project and manuscript storage.
3. Add chapters and scenes.
4. Add writer tools: characters, worldbuilding, timeline, research, plotting.
5. Add version history and backups.
6. Add import/export formats.
7. Add publishing and manuscript formatting tools.

AI is intentionally outside the ScriptSmith product scope.
