import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function saveProject(document) {
  const path = await save({
    title: 'Save ScriptSmith Document',
    defaultPath: `${safeName(document.title)}.scriptsmith.json`,
    filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json'] }]
  });
  if (!path) return false;
  await writeTextFile(path, JSON.stringify(document, null, 2));
  return true;
}

export async function openProject() {
  const path = await open({
    title: 'Open ScriptSmith Document',
    multiple: false,
    filters: [{ name: 'ScriptSmith Document', extensions: ['scriptsmith.json', 'json'] }]
  });
  if (!path || Array.isArray(path)) return null;
  return JSON.parse(await readTextFile(path));
}

function safeName(value) {
  return (value || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim();
}
