const STORAGE_KEY = 'scriptsmith-settings';

const defaults = {
  theme: 'paper',
  fontFamily: 'Georgia',
  fontSize: 12,
  lineSpacing: '1.5',
  spellcheck: true,
  pageNumbers: true,
  headers: false,
  footers: false,
  autosave: true,
  autosaveIntervalMs: 30000,
  sessionTracking: true,
  sessionWordCount: true,
  pageWordCount: false,
  readingMode: 'page',
  confirmBeforeDelete: true,
  restoreAutosave: true
};

function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch (_) { return { ...defaults }; }
}

let settings = load();

export function getSettings() { return { ...settings }; }
export function updateSettings(changes = {}) {
  settings = { ...settings, ...changes };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return getSettings();
}
export function resetSettings() {
  settings = { ...defaults };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return getSettings();
}
export function getDefaults() { return { ...defaults }; }
