const defaults = {
  theme: 'paper',
  fontFamily: 'Georgia',
  fontSize: 12,
  lineHeight: 1.6,
  autosave: true,
  autosaveIntervalMs: 30000,
  spellcheck: true
};

let settings = { ...defaults };

export function getSettings() { return { ...settings }; }
export function updateSettings(changes = {}) { settings = { ...settings, ...changes }; return getSettings(); }
export function resetSettings() { settings = { ...defaults }; return getSettings(); }
