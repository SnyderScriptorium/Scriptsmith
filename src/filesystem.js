import { open, save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

let currentPath = null;
const AUTOSAVE_DIR = 'ScriptSmith/autosave';
const AUTOSAVE_FILE = `${AUTOSAVE_DIR}/recovery.json`;

export function getCurrentPath() {
  return currentPath;
}

export async function saveProject(document, saveAs = false) {
  let path = currentPath;
  if (!path || saveAs) {
    path = await save({
      title: saveAs ? 'Save ScriptSmith Document As' : 'Save ScriptSmith Document',
      defaultPath: `${safeName(document.title)}.scriptsmith.json`,
      filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json'] }]
    });
    if (!path) return false;
  }

  await writeTextFile(path, JSON.stringify(document, null, 2));
  currentPath = path;
  return true;
}

export async function openProject() {
  const path = await open({
    title: 'Open ScriptSmith Document',
    multiple: false,
    filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json', 'json'] }]
  });
  if (!path || Array.isArray(path)) return null;

  const document = JSON.parse(await readTextFile(path));
  currentPath = path;
  return document;
}

export async function saveAutosave(document) {
  await mkdir(AUTOSAVE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(AUTOSAVE_FILE, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    document
  }, null, 2), { baseDir: BaseDirectory.AppData });
}

export async function hasAutosave() {
  return exists(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData });
}

export async function loadAutosave() {
  if (!(await hasAutosave())) return null;
  const data = JSON.parse(await readTextFile(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData }));
  return data.document || null;
}

export async function clearAutosave() {
  try {
    const { remove } = await import('@tauri-apps/plugin-fs');
    if (await hasAutosave()) await remove(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData });
  } catch (_) {}
}

export function clearCurrentPath() {
  currentPath = null;
}

function safeName(value) {
  return (value || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim();
}
