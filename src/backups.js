import { BaseDirectory, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';

const BACKUP_DIR = 'ScriptSmith/backups';

export function backupName(title, timestamp = new Date()) {
  const safe = (title || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim();
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-');
  return `${safe}.backup.${stamp}.scriptsmith.json`;
}

export function shouldBackup(lastBackupAt, intervalMs = 300000) {
  return !lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() >= intervalMs;
}

export async function createBackup(document) {
  if (!document) return null;
  await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  const name = backupName(document.title);
  await writeTextFile(`${BACKUP_DIR}/${name}`, JSON.stringify({ version: 2, backedUpAt: new Date().toISOString(), document }, null, 2), { baseDir: BaseDirectory.AppData });
  return name;
}
