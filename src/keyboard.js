import { getCurrentDocument } from './document.js';

export function installKeyboardShortcuts({ onNew, onSave }) {
  window.addEventListener('keydown', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); onSave(getCurrentDocument()); }
    if (key === 'n') { event.preventDefault(); onNew(); }
  });
}
