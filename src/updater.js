// In-app updater for ScriptSmith (Android).
// Checks snyderscriptorium.com for a newer build, downloads the APK to the
// app cache dir, and opens it so Android shows the install screen.
// The check never blocks startup and fails silently offline.

import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { appCacheDir, join } from '@tauri-apps/api/path';

// Bump this integer with every release build.
export const APP_BUILD = 12;

const VERSION_URL = 'https://snyderscriptorium.com/scriptsmith-version.json';
const APK_FILE = 'scriptsmith-update.apk';

/**
 * Returns {build, apk_url} when a newer build exists, otherwise null.
 * Never throws — returns null on any network or parse error.
 */
export async function checkForUpdate() {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = await res.json();
    if (
      info &&
      typeof info.build === 'number' &&
      info.build > APP_BUILD &&
      typeof info.apk_url === 'string' &&
      info.apk_url.length > 0
    ) {
      return { build: info.build, apk_url: info.apk_url };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Downloads the APK (with progress callbacks) and opens it so Android
 * shows the install screen. Throws on failure.
 */
export async function downloadAndInstall(apkUrl, onProgress) {
  const say = (msg) => {
    if (typeof onProgress === 'function') {
      try { onProgress(msg); } catch (_) {}
    }
  };
  say('Downloading update…');
  const res = await fetch(apkUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('Download failed (HTTP ' + res.status + ')');
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      say('Downloading update… ' + Math.round((received / total) * 100) + '%');
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  say('Preparing install…');
  await writeFile(APK_FILE, bytes, { baseDir: BaseDirectory.AppCache });
  const filePath = await join(await appCacheDir(), APK_FILE);
  say('Opening installer…');
  await openPath(filePath);
}
