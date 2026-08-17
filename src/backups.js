export function backupName(title, timestamp = new Date()) {
  const safe = (title || 'Untitled Document').replace(/[\\/:*?"<>|]/g, '-').trim();
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-');
  return `${safe}.backup.${stamp}.scriptsmith.json`;
}

export function shouldBackup(lastBackupAt, intervalMs = 300000) {
  return !lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() >= intervalMs;
}
