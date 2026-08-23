import { open, save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';

let currentPath = null;
const AUTOSAVE_DIR = 'ScriptSmith/autosave';
const AUTOSAVE_FILE = `${AUTOSAVE_DIR}/recovery.json`;
const LIBRARY_DIR = 'ScriptSmith/library';

export function getCurrentPath() { return currentPath; }

export async function saveProject(document, saveAs = false) {
  let path = currentPath;
  if (!path || saveAs) {
    path = await save({ title: saveAs ? 'Save ScriptSmith Document As' : 'Save ScriptSmith Document', defaultPath: `${safeName(document.title)}.scriptsmith.json`, filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json'] }] });
    if (!path) return false;
  }
  await writeTextFile(path, JSON.stringify(document, null, 2));
  currentPath = path;
  await saveToLibrary(document);
  return true;
}

export async function openProject() {
  const path = await open({ title: 'Open ScriptSmith Document', multiple: false, filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json', 'json'] }] });
  if (!path || Array.isArray(path)) return null;
  const document = JSON.parse(await readTextFile(path));
  currentPath = path;
  await saveToLibrary(document);
  return document;
}

export async function saveToLibrary(document) {
  await mkdir(LIBRARY_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  const id = safeName(document.id || document.title || 'Untitled Document').replace(/\s+/g, '-').toLowerCase();
  const record = { ...document, libraryId: id, libraryUpdatedAt: new Date().toISOString() };
  await writeTextFile(`${LIBRARY_DIR}/${id}.json`, JSON.stringify(record, null, 2), { baseDir: BaseDirectory.AppData });
}

export async function listLibraryDocuments() {
  try {
    await mkdir(LIBRARY_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    const entries = await readDir(LIBRARY_DIR, { baseDir: BaseDirectory.AppData });
    const docs = [];
    for (const entry of entries) {
      if (!entry.name?.endsWith('.json')) continue;
      try { docs.push(JSON.parse(await readTextFile(`${LIBRARY_DIR}/${entry.name}`, { baseDir: BaseDirectory.AppData }))); } catch (_) {}
    }
    return docs.sort((a, b) => new Date(b.libraryUpdatedAt || 0) - new Date(a.libraryUpdatedAt || 0));
  } catch (_) { return []; }
}

export async function loadLibraryDocument(document) {
  const id = document.libraryId || document.id;
  if (!id) return document;
  try { return JSON.parse(await readTextFile(`${LIBRARY_DIR}/${id}.json`, { baseDir: BaseDirectory.AppData })); }
  catch (_) { return document; }
}

export async function saveAutosave(document) {
  await mkdir(AUTOSAVE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(AUTOSAVE_FILE, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), document }, null, 2), { baseDir: BaseDirectory.AppData });
}
export async function hasAutosave() { return exists(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData }); }
export async function loadAutosave() { if (!(await hasAutosave())) return null; const data = JSON.parse(await readTextFile(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData })); return data.document || null; }
export async function clearAutosave() { try { const { remove } = await import('@tauri-apps/plugin-fs'); if (await hasAutosave()) await remove(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData }); } catch (_) {} }
export function clearCurrentPath() { currentPath = null; }
function safeName(value) { return (value || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim(); }
