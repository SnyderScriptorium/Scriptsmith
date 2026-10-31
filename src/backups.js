import { BaseDirectory, mkdir, writeTextFile, readDir, remove } from '@tauri-apps/plugin-fs';

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
  // Prune: backups used to accumulate forever (one timestamped file per
  // save), so the backups folder filled with duplicates. Keep the newest 20.
  try {
    const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppData });
    const names = entries.map(e => e.name).filter(n => n && n.endsWith('.scriptsmith.json')).sort();
    const excess = names.slice(0, Math.max(0, names.length - 20));
    for (const old of excess) { try { await remove(`${BACKUP_DIR}/${old}`, { baseDir: BaseDirectory.AppData }); } catch (_) {} }
  } catch (_) {}
  return name;
}
