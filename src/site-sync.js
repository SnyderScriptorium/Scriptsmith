// site-sync.js — ScriptSmith <-> snyderscriptorium.com Manuscript Studio sync.
//
// This is SEPARATE from the Supabase sync in sync.js: it talks to the
// website's own manuscript database, authenticated by a sync token minted
// in the website admin (never by email, never by the admin password).
// Buttons only, no auto-sync: every overwrite is confirmed first, and
// only chapter title + content cross over — characters, worlds, timeline,
// notes, prologue, and epilogue have no home on the website and stay local.

const LS_URL_KEY = 'scriptsmith-site-url';
const LS_TOKEN_KEY = 'scriptsmith-site-token';
const DEFAULT_SITE_URL = 'https://www.snyderscriptorium.com';

export function getSiteUrl() {
  try {
    const url = String(localStorage.getItem(LS_URL_KEY) || '').trim().replace(/\/+$/, '');
    return url || DEFAULT_SITE_URL;
  } catch (_) {
    return DEFAULT_SITE_URL;
  }
}

export function setSiteUrl(url) {
  try {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem(LS_URL_KEY, clean);
    else localStorage.removeItem(LS_URL_KEY);
  } catch (_) {}
}

export function getSiteToken() {
  try {
    return String(localStorage.getItem(LS_TOKEN_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

export function setSiteToken(token) {
  try {
    const clean = String(token || '').trim();
    if (clean) localStorage.setItem(LS_TOKEN_KEY, clean);
    else localStorage.removeItem(LS_TOKEN_KEY);
  } catch (_) {}
}

export function isSiteSyncConfigured() {
  return Boolean(getSiteToken());
}

async function siteApi(path, { method = 'GET', body = null } = {}) {
  const token = getSiteToken();
  if (!token) throw new Error('No website sync token. Add it in Settings → Website sync.');
  const response = await fetch(`${getSiteUrl()}/api/site-sync${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === null ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    if (response.status === 401) throw new Error('Website sync token rejected. Check the token in Settings → Website sync.');
    throw new Error(data.error || `Website sync failed (${response.status}).`);
  }
  return data;
}

/** List the website's manuscript books: [{id, title, chapter_count}]. */
export async function listSiteBooks() {
  const data = await siteApi('/manuscripts');
  return data.books || [];
}

/** Fetch one website book with its chapters, ordered by chapter_number. */
export async function getSiteBook(bookId) {
  return siteApi(`/manuscripts/${bookId}`);
}

/** Create a website book by title. Returns {id}. */
export async function createSiteBook(title) {
  return siteApi('/manuscripts', { method: 'POST', body: { title } });
}

/** Replace a website book's chapters (position order). */
export async function pushSiteChapters(bookId, chapters) {
  return siteApi(`/manuscripts/${bookId}/chapters`, {
    method: 'PUT',
    body: { chapters: (chapters || []).map((c) => ({ title: c.title || 'Untitled Chapter', content: c.content || '' })) },
  });
}

/** Map website chapters to ScriptSmith chapter objects (fresh local ids). */
export function siteChaptersToLocal(chapters) {
  return (chapters || []).map((c) => ({
    id: crypto.randomUUID(),
    title: c.title || 'Untitled Chapter',
    content: c.content || '',
  }));
}
