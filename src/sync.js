// sync.js — Supabase sync foundation for ScriptSmith (paid "sync" tier).
//
// Offline-first: manuscripts always live locally first (see filesystem.js).
// Sync pushes local docs up to Supabase and pulls remote docs down.
// Conflict resolution is last-write-wins on the document's updatedAt.
//
// SETUP (one time, see supabase/README.md):
//   1. npm install @supabase/supabase-js
//   2. Create a Supabase project and run supabase/schema.sql in its SQL editor.
//   3. Configure credentials ONE of these ways (in-app config wins):
//      a. In the app: call configureSync(url, anonKey) once (e.g. from a
//         Settings screen). Stored in localStorage — no rebuild needed.
//      b. Build-time: a `.env` file at the repo root with
//           VITE_SUPABASE_URL=https://xyzcompany.supabase.co
//           VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//         (never commit .env)
//
// SECURITY:
// - Only the *anon* (publishable) key ever ships in the app. It is safe to
//   embed: Row Level Security on the `manuscripts` table restricts every
//   query to rows where auth.uid() = user_id. The anon key alone grants
//   access to nothing.
// - NEVER put the `service_role` key in the app. It bypasses RLS entirely.
//
// V1 LIMITATIONS (documented, not bugs):
// - Deletions do not sync. Deleting a manuscript on one device will not
//   delete it on the other; the surviving copy will re-upload on next sync.
// - Conflicts are last-write-wins. There is no field-level merge and no
//   conflict UI yet. Edits made on two devices between syncs: the older
//   edit is overwritten by the newer one.
// - Settings sync is heuristic last-write-wins: if settings change on two
//   devices between syncs, the device that syncs second wins.

import { createClient } from '@supabase/supabase-js';
import { listLibraryDocuments, saveToLibrary } from './filesystem.js';

const LS_URL_KEY = 'scriptsmith-sync-url';
const LS_ANON_KEY = 'scriptsmith-sync-anon-key';

let client = null;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function readConfig() {
  const lsUrl =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_URL_KEY) : '';
  const lsKey =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_ANON_KEY) : '';
  const envUrl =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : '';
  const envKey =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_SUPABASE_ANON_KEY
      : '';
  // In-app config (localStorage) wins so keys can be pasted in without a rebuild.
  return {
    url: String(lsUrl || envUrl || '').trim(),
    anonKey: String(lsKey || envKey || '').trim(),
  };
}

/**
 * Store Supabase credentials in the app (localStorage). Call once from a
 * Settings screen; takes effect immediately, no rebuild required.
 * Pass empty strings to clear.
 */
export function configureSync(url, anonKey) {
  if (typeof localStorage === 'undefined') return;
  const u = String(url || '').trim();
  const k = String(anonKey || '').trim();
  if (u) localStorage.setItem(LS_URL_KEY, u);
  else localStorage.removeItem(LS_URL_KEY);
  if (k) localStorage.setItem(LS_ANON_KEY, k);
  else localStorage.removeItem(LS_ANON_KEY);
  client = null; // force re-init with new credentials
}

/** True when a URL and anon key are available from any source. */
export function isSyncConfigured() {
  const { url, anonKey } = readConfig();
  return Boolean(url && anonKey);
}

/** Return the stored sync credentials (for pre-filling a settings UI). */
export function getSyncConfig() {
  return readConfig();
}

function getClient() {
  if (client) return client;
  const { url, anonKey } = readConfig();
  if (!url || !anonKey) {
    throw new Error(
      'Sync is not configured. Add your Supabase Project URL and anon key ' +
        'via configureSync(url, anonKey) or a .env file ' +
        '(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). See supabase/README.md.'
    );
  }
  client = createClient(url, anonKey);
  return client;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signUp(email, password) {
  const sb = getClient();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(`Sign-up failed: ${error.message}`);
  return data.user;
}

export async function signIn(email, password) {
  const sb = getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return data.user;
}

export async function signOut() {
  const sb = getClient();
  const { error } = await sb.auth.signOut();
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}

/** Returns the signed-in user object, or null. */
export async function getUser() {
  const sb = getClient();
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

// ---------------------------------------------------------------------------
// Manuscript mapping (local doc <-> Supabase row)
// ---------------------------------------------------------------------------

function toRow(doc, userId) {
  return {
    id: doc.id,
    user_id: userId,
    title: doc.title || 'Untitled Document',
    content: doc, // full document stored as jsonb
    updated_at: doc.updatedAt || new Date().toISOString(),
  };
}

function toDoc(row) {
  const content =
    row.content && typeof row.content === 'object' ? { ...row.content } : {};
  return {
    ...content,
    id: row.id,
    title: row.title ?? content.title ?? 'Untitled Document',
    updatedAt:
      row.updated_at || content.updatedAt || new Date().toISOString(),
  };
}

function newerThan(a, b) {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta > tb;
}

async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error('Not signed in. Sign in before syncing.');
  return user;
}

// ---------------------------------------------------------------------------
// Settings sync (theme, theme font, accent color, and other preferences)
//
// One row per user in the `user_settings` table. Last-write-wins on
// updated_at, tracked against the last time THIS device synced, so a device
// that changed settings uploads while a device that didn't pulls.
// Limitation: if settings change on two devices between syncs, the device
// that syncs second wins; there is no field-level merge.
// ---------------------------------------------------------------------------

const SETTINGS_LS_KEY = 'scriptsmith-settings-v2';
const LS_SETTINGS_SYNCED_AT = 'scriptsmith-settings-synced-at';

/** Re-apply the theme after a settings download, when the UI module exists. */
async function applyThemeIfAvailable() {
  try {
    // Dynamic import: workspace-options.js statically imports this module,
    // so a static import back would be circular.
    const mod = await import('./workspace-options.js');
    if (mod && typeof mod.applyTheme === 'function') mod.applyTheme();
  } catch (_) {
    // Not in an app context (or theme module unavailable) — settings are
    // still saved locally; they apply on next app start.
  }
}

function readLocalSettings() {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(SETTINGS_LS_KEY)
        : null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeLocalSettings(obj) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(obj));
    return true;
  } catch (_) {
    return false;
  }
}

function stampSettingsSynced() {
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(LS_SETTINGS_SYNCED_AT, String(Date.now()));
  } catch (_) {}
}

/** Push this device's settings to Supabase (insert or update). */
export async function uploadSettings() {
  const sb = getClient();
  const user = await requireUser();
  const local = readLocalSettings();
  if (!local) return false;
  const now = new Date().toISOString();
  const { error } = await sb
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: local, updated_at: now },
      { onConflict: 'user_id' }
    );
  if (error) throw new Error(`Settings upload failed: ${error.message}`);
  stampSettingsSynced();
  return true;
}

/**
 * Pull the signed-in user's settings from Supabase, save them locally,
 * and re-apply the theme. Returns the settings object, or null when the
 * user has never synced settings.
 */
export async function downloadSettings() {
  const sb = getClient();
  const user = await requireUser();
  const { data, error } = await sb
    .from('user_settings')
    .select('settings, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Settings download failed: ${error.message}`);
  if (!data || !data.settings) return null;
  writeLocalSettings(data.settings);
  stampSettingsSynced();
  await applyThemeIfAvailable();
  return data.settings;
}

/**
 * Two-way settings sync. Heuristic last-write-wins:
 *  - no remote row          -> upload local settings (if any)
 *  - remote newer than our last sync -> download + apply
 *  - otherwise              -> upload local settings (covers local changes)
 * Returns { uploaded, downloaded }.
 */
export async function syncSettings() {
  const sb = getClient();
  const user = await requireUser();
  const out = { uploaded: false, downloaded: false };

  const local = readLocalSettings();
  const { data, error } = await sb
    .from('user_settings')
    .select('settings, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Settings sync failed: ${error.message}`);

  let lastSynced = 0;
  try {
    lastSynced = Number(localStorage.getItem(LS_SETTINGS_SYNCED_AT) || 0);
  } catch (_) {}
  const remoteAt =
    data && data.updated_at ? new Date(data.updated_at).getTime() : 0;

  if (!data || !data.settings) {
    if (local && (await uploadSettings())) out.uploaded = true;
  } else if (remoteAt > lastSynced) {
    writeLocalSettings(data.settings);
    stampSettingsSynced();
    await applyThemeIfAvailable();
    out.downloaded = true;
  } else if (local && (await uploadSettings())) {
    out.uploaded = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Manuscript sync operations
// ---------------------------------------------------------------------------

/** Push one local manuscript to Supabase (insert or update). */
export async function uploadManuscript(doc) {
  const sb = getClient();
  const user = await requireUser();
  if (!doc || !doc.id) throw new Error('uploadManuscript: document needs an id.');
  const row = toRow(doc, user.id);
  const { error } = await sb.from('manuscripts').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return row.updated_at;
}

/** Pull all of the signed-in user's manuscripts from Supabase. */
export async function downloadManuscripts() {
  const sb = getClient();
  const user = await requireUser();
  const { data, error } = await sb
    .from('manuscripts')
    .select('*')
    .eq('user_id', user.id) // RLS enforces this anyway; explicit is clearer
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Download failed: ${error.message}`);
  return (data || []).map(toDoc);
}

/**
 * Two-way sync. For every manuscript known locally or remotely:
 *  - only local            -> upload
 *  - only remote           -> download (saved to the local library)
 *  - on both, local newer  -> upload
 *  - on both, remote newer -> download (overwrites local copy)
 *  - same timestamp        -> nothing to do
 *
 * App settings (theme, font, preferences) sync too, last-write-wins.
 *
 * Returns { uploaded, downloaded, upToDate, settingsUploaded,
 *           settingsDownloaded, errors }.
 * Individual failures are collected in `errors`, not thrown, so one bad
 * document can't abort the whole sync.
 */
export async function syncNow() {
  getClient(); // throws early if unconfigured
  await requireUser(); // throws early if signed out

  const result = { uploaded: 0, downloaded: 0, upToDate: 0, errors: [], settingsUploaded: 0, settingsDownloaded: 0 };

  const localDocs = await listLibraryDocuments();
  const remoteDocs = await downloadManuscripts();

  const localById = new Map(localDocs.map((d) => [d.id, d]));
  const remoteById = new Map(remoteDocs.map((d) => [d.id, d]));

  // Push phase: local-only docs, plus locals that are newer than remote.
  for (const doc of localDocs) {
    const remote = remoteById.get(doc.id);
    try {
      if (!remote || newerThan(doc.updatedAt, remote.updatedAt)) {
        await uploadManuscript(doc);
        result.uploaded++;
      }
    } catch (e) {
      result.errors.push({ id: doc.id, phase: 'upload', message: e.message });
    }
  }

  // Pull phase: remote-only docs, plus remotes that are newer than local.
  // saveToLibrary migrates the document shape on the way in.
  for (const doc of remoteDocs) {
    const local = localById.get(doc.id);
    try {
      if (!local || newerThan(doc.updatedAt, local.updatedAt)) {
        await saveToLibrary(doc);
        result.downloaded++;
      } else {
        result.upToDate++;
      }
    } catch (e) {
      result.errors.push({ id: doc.id, phase: 'download', message: e.message });
    }
  }

  // Settings phase: theme, font, and preferences follow the account too.
  // Never fatal — a settings failure must not break manuscript sync.
  try {
    const s = await syncSettings();
    if (s.uploaded) result.settingsUploaded++;
    if (s.downloaded) result.settingsDownloaded++;
  } catch (e) {
    result.errors.push({ id: 'settings', phase: 'settings', message: e.message });
  }

  return result;
}
