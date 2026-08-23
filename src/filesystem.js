import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

let currentPath = null;

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

export function clearCurrentPath() {
  currentPath = null;
}

function safeName(value) {
  return (value || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim();
}
