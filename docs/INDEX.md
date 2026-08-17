# ScriptSmith Foundation Index

## Product definition

ScriptSmith is a free, offline-first writing application for writers. It is not an AI product.

## Foundation systems

- `src/app.js` — application shell and UI wiring
- `src/document.js` — document model and current-document state
- `src/filesystem.js` — native local open/save layer
- `src/statistics.js` — word and character statistics
- `src/styles/` — application, layout, and editor presentation
- `src-tauri/` — native desktop shell and permissions

## Planned core systems

- Document engine
- Project engine
- Manuscript engine
- Chapter/scene engine
- Character database
- Worldbuilding database
- Timeline
- Plot/outlining tools
- Research cabinet
- Version history
- Backup manager
- Import/export engine
- Publishing formatter
- Preferences/theme system
- Keyboard shortcut manager

## Non-negotiables

1. No AI.
2. Writing must work without internet access.
3. Core writing must not require an account.
4. Core writing must not require a subscription.
5. User files must be stored locally.
6. Do not use browser `localStorage` as the manuscript's source of truth.
7. Features should be modular so one broken tool does not take down the whole editor.
