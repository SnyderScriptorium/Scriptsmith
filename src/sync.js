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
// Sync operations
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
 * Returns { uploaded, downloaded, upToDate, errors }.
 * Individual failures are collected in `errors`, not thrown, so one bad
 * document can't abort the whole sync.
 */
export async function syncNow() {
  getClient(); // throws early if unconfigured
  await requireUser(); // throws early if signed out

  const result = { uploaded: 0, downloaded: 0, upToDate: 0, errors: [] };

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

  return result;
}
