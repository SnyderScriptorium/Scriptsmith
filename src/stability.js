import { getSettings, updateSettings, resetSettings } from '../settings.js';

const UNIVERSAL_KEY = 'scriptsmith-universal-library';

function readUniversal() {
  try {
    const value = JSON.parse(localStorage.getItem(UNIVERSAL_KEY) || '{}');
    return {
      characters: Array.isArray(value.characters) ? value.characters : [],
      locations: Array.isArray(value.locations) ? value.locations : [],
      timeline: Array.isArray(value.timeline) ? value.timeline : []
    };
  } catch {
    return { characters: [], locations: [], timeline: [] };
  }
}

function writeUniversal(value) {
  localStorage.setItem(UNIVERSAL_KEY, JSON.stringify(value));
}

function esc(value = '') {
  return String(value).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));
}

function showHomePage() {
  document.querySelector('#collection-shell')?.setAttribute('hidden', '');
  document.querySelector('#editor-shell')?.setAttribute('hidden', '');
  const home = document.querySelector('#home');
  if (home) home.hidden = false;
}

function showUniversalTimeline() {
  const data = readUniversal();
  const home = document.querySelector('#home');
  const editor = document.querySelector('#editor-shell');
  const shell = document.querySelector('#collection-shell');
  if (!shell) return;
  if (home) home.hidden = true;
  if (editor) editor.hidden = true;
  shell.hidden = false;
  const events = [...data.timeline].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return String(a.date).localeCompare(String(b.date));
  });
  shell.innerHTML = `<header class="topbar"><div class="brand"><button id="stability-timeline-home" class="home-button theme-button">‹ Library</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Universal Timeline</small></div></div><div></div><div class="top-actions"><button id="stability-add-timeline" class="primary-action">+ Add Event</button></div></header><main class="collection-page"><div class="collection-heading"><h1>Universal Timeline</h1><p>One chronological timeline shared across all of your stories.</p></div><div class="library-grid">${events.length ? events.map(e => `<button class="record-row theme-card" data-stability-event="${esc(e.id)}"><strong>${esc(e.title || 'Untitled Event')}</strong><span>${esc(e.date || 'Undated')} ${e.summary ? '· ' + esc(e.summary) : ''}</span></button>`).join('') : '<div class="library-empty">No universal timeline events yet. Add your first event above.</div>'}</div></main>`;
  shell.querySelector('#stability-timeline-home').onclick = showHomePage;
  shell.querySelector('#stability-add-timeline').onclick = () => {
    data.timeline.push({ id: crypto.randomUUID(), title: 'New Event', date: '', summary: '', notes: '' });
    writeUniversal(data);
    showUniversalTimeline();
  };
  shell.querySelectorAll('[data-stability-event]').forEach(button => {
    button.onclick = () => editUniversalTimeline(button.dataset.stabilityEvent);
  });
}

function editUniversalTimeline(id) {
  const data = readUniversal();
  const event = data.timeline.find(item => item.id === id);
  if (!event) return;
  const shell = document.querySelector('#collection-shell');
  if (!shell) return;
  shell.hidden = false;
  shell.innerHTML = `<header class="topbar"><div class="brand"><button id="stability-event-back" class="home-button theme-button">‹ Timeline</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Universal Timeline</small></div></div></header><main class="collection-page"><div class="collection-heading"><h1>Edit Timeline Event</h1></div><div class="record-form"><label>Event Name<input id="stability-event-title" value="${esc(event.title || '')}"></label><label>Date<input id="stability-event-date" type="date" value="${esc(event.date || '')}"></label><label>Summary<textarea id="stability-event-summary">${esc(event.summary || '')}</textarea></label><label>Details<textarea id="stability-event-notes">${esc(event.notes || '')}</textarea></label><div class="form-actions"><button id="stability-event-delete" class="theme-button">Delete Event</button><button id="stability-event-save" class="primary-action">Save Event</button></div></div></main>`;
  shell.querySelector('#stability-event-back').onclick = showUniversalTimeline;
  shell.querySelector('#stability-event-save').onclick = () => {
    event.title = shell.querySelector('#stability-event-title').value.trim() || 'Untitled Event';
    event.date = shell.querySelector('#stability-event-date').value;
    event.summary = shell.querySelector('#stability-event-summary').value;
    event.notes = shell.querySelector('#stability-event-notes').value;
    writeUniversal(data);
    showUniversalTimeline();
  };
  shell.querySelector('#stability-event-delete').onclick = () => {
    data.timeline = data.timeline.filter(item => item.id !== id);
    writeUniversal(data);
    showUniversalTimeline();
  };
}

function showSettingsPage() {
  const settings = getSettings();
  const home = document.querySelector('#home');
  const collection = document.querySelector('#collection-shell');
  const shell = document.querySelector('#editor-shell');
  if (!shell) return;
  if (home) home.hidden = true;
  if (collection) collection.hidden = true;
  shell.hidden = false;
  shell.innerHTML = `<header class="topbar"><div class="brand"><button id="stability-settings-home" class="home-button theme-button">‹ Library</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Settings</small></div></div></header><main class="collection-page"><div class="collection-heading"><h1>Settings</h1><p>These preferences are saved locally on this device.</p></div><div class="record-form"><label>Theme<select id="stability-theme"><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="dark">Dark</option></select></label><label>Default Font<input id="stability-font" value="${esc(settings.fontFamily)}"></label><label>Default Font Size<input id="stability-size" type="number" min="8" max="72" value="${settings.fontSize}"></label><label>Line Spacing<select id="stability-spacing"><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option><option value="2.5">2.5</option><option value="3">Triple</option></select></label><label>Autosave Interval (seconds)<input id="stability-autosave-interval" type="number" min="5" max="300" value="${Math.max(5, Math.round((settings.autosaveIntervalMs || 30000) / 1000))}"></label><label><span>Autosave</span><input id="stability-autosave" type="checkbox" ${settings.autosave ? 'checked' : ''}></label><label><span>Spellcheck</span><input id="stability-spellcheck" type="checkbox" ${settings.spellcheck ? 'checked' : ''}></label><div class="form-actions"><button id="stability-reset" class="theme-button">Reset Defaults</button><button id="stability-save" class="primary-action">Save Settings</button></div></div></main>`;
  shell.querySelector('#stability-theme').value = settings.theme || 'paper';
  shell.querySelector('#stability-spacing').value = String(settings.lineSpacing || '1.5');
  shell.querySelector('#stability-settings-home').onclick = showHomePage;
  shell.querySelector('#stability-reset').onclick = () => { resetSettings(); showSettingsPage(); };
  shell.querySelector('#stability-save').onclick = () => {
    updateSettings({
      theme: shell.querySelector('#stability-theme').value,
      fontFamily: shell.querySelector('#stability-font').value.trim() || 'Georgia',
      fontSize: Math.max(8, Math.min(72, Number(shell.querySelector('#stability-size').value) || 12)),
      lineSpacing: shell.querySelector('#stability-spacing').value,
      autosave: shell.querySelector('#stability-autosave').checked,
      spellcheck: shell.querySelector('#stability-spellcheck').checked,
      autosaveIntervalMs: Math.max(5000, Math.min(300000, (Number(shell.querySelector('#stability-autosave-interval').value) || 30) * 1000))
    });
    applySettingsToEditor();
    showSettingsPage();
  };
}

function applySettingsToEditor() {
  const settings = getSettings();
  document.documentElement.dataset.theme = settings.theme || 'paper';
  const editor = document.querySelector('#editor');
  if (!editor) return;
  editor.spellcheck = !!settings.spellcheck;
  editor.style.fontFamily = settings.fontFamily || 'Georgia';
  editor.style.fontSize = `${Number(settings.fontSize) || 12}pt`;
  editor.style.lineHeight = String(settings.lineSpacing || '1.5');
}

function ensureUniversalTimelineCard() {
  const library = document.querySelector('.universal-library');
  if (!library || library.querySelector('#universal-timeline')) return;
  const card = document.createElement('button');
  card.className = 'universal-card';
  card.id = 'universal-timeline';
  card.innerHTML = '<strong>Universal Timeline</strong><span>One timeline shared across all your stories</span>';
  library.appendChild(card);
}

function handleClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'home-settings' || button.dataset.view === 'settings') {
    event.preventDefault();
    event.stopImmediatePropagation();
    showSettingsPage();
    return;
  }
  if (button.id === 'universal-timeline') {
    event.preventDefault();
    event.stopImmediatePropagation();
    showUniversalTimeline();
  }
}

export function installStabilityLayer() {
  document.addEventListener('click', handleClick, true);
  const observer = new MutationObserver(() => {
    ensureUniversalTimelineCard();
    applySettingsToEditor();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureUniversalTimelineCard();
  applySettingsToEditor();
}
