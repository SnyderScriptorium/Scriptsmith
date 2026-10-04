/* ScriptSmith font picker.
 *
 * True-typeface previews: every font is rendered in its own family.
 * Native <select> dropdowns render per-option fonts inconsistently across
 * platforms, and the closed control never previews — so the ribbon (and the
 * theme-font setting) use this custom picker instead: a button whose label is
 * rendered in the current font, opening a popup where every item is rendered
 * in its own typeface, grouped like the old optgroups.
 *
 * The popup is position:fixed in document.body so it escapes the ribbon's
 * overflow clipping.
 */

export const FONT_GROUPS = {
  'Traditional Serif': ['Baskerville', 'Bodoni 72', 'Book Antiqua', 'Bookman', 'Cambria', 'Century Schoolbook', 'Constantia', 'Didot', 'EB Garamond', 'Garamond', 'Georgia', 'Hoefler Text', 'Palatino', 'Palatino Linotype', 'Times New Roman'],
  'Literary Serif': ['Cormorant Garamond', 'Libre Baskerville', 'Merriweather', 'Noto Serif', 'Source Serif 4', 'Rockwell'],
  'Modern Sans': ['Aptos', 'Arial', 'Calibri', 'Century Gothic', 'Futura', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Inter', 'Lato', 'Montserrat', 'Open Sans', 'Optima', 'Poppins', 'Raleway', 'Roboto', 'Segoe UI', 'Source Sans 3', 'Tahoma', 'Trebuchet MS', 'Verdana'],
  'Monospace': ['Consolas', 'Courier New', 'Lucida Console', 'Menlo', 'Monaco'],
  'Display & Character': ['Arial Black', 'Copperplate', 'Franklin Gothic Medium', 'Impact', 'Nunito', 'Papyrus', 'Comic Sans MS', 'Segoe Print', 'Brush Script MT']
};

const GROUP_FALLBACK = {
  'Traditional Serif': 'serif',
  'Literary Serif': 'serif',
  'Modern Sans': 'sans-serif',
  'Monospace': 'monospace',
  'Display & Character': 'cursive'
};

export const ALL_FONTS = Object.values(FONT_GROUPS).flat();
const KNOWN = new Set(ALL_FONTS);
export const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog.';

const quoteFont = f => `'${String(f).replace(/'/g, "\\'")}'`;
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const familyFor = (font, group) => `${quoteFont(font)}, ${GROUP_FALLBACK[group] || 'serif'}`;

// One open picker at a time; global dismiss handlers installed once.
let openPicker = null;
let globalHandlersInstalled = false;
function closeOpenPicker(except = null) {
  if (openPicker && openPicker !== except) openPicker.close();
}
function installGlobalHandlers() {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;
  document.addEventListener('pointerdown', e => {
    if (openPicker && !e.target.closest('.ss-font-picker') && !e.target.closest('.ss-font-picker-popup')) closeOpenPicker();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openPicker) { openPicker.close(); openPicker = null; }
  }, true);
  // Fixed-position popup can't track a scrolling page; just close it.
  window.addEventListener('scroll', e => {
    if (openPicker && !e.target.closest?.('.ss-font-picker-popup')) closeOpenPicker();
  }, true);
  window.addEventListener('resize', () => closeOpenPicker());
}

/** Keep every picker's button label in step with the caret's font. */
let syncInstalled = false;
export function startFontPickerSync() {
  if (syncInstalled) return;
  syncInstalled = true;
  const sync = () => {
    try {
      const active = document.activeElement;
      if (!active || !active.closest?.('#ss-pages [contenteditable]')) return;
      const raw = String(document.queryCommandValue('fontName') || '').replace(/^['"]+|['"]+$/g, '').trim();
      if (!KNOWN.has(raw)) return;
      document.querySelectorAll('.ss-font-picker').forEach(p => { if (p._ssSetFont && p._ssCurrent !== raw) p._ssSetFont(raw); });
    } catch { /* queryCommandValue can throw outside an editable context */ }
  };
  document.addEventListener('selectionchange', sync);
  document.addEventListener('keyup', sync);
  document.addEventListener('mouseup', sync);
}

/**
 * Build a font picker.
 * @param {string} current - initially selected font name.
 * @param {(font: string) => void} onPick - called when the user picks a font.
 * @returns {HTMLElement} the picker wrapper (contains the button).
 */
export function createFontPicker({ current = 'Georgia', onPick = null } = {}) {
  installGlobalHandlers();
  startFontPickerSync();

  const root = document.createElement('span');
  root.className = 'ss-font-picker';

  root.innerHTML = `<button type="button" class="ss-font-picker-button" aria-haspopup="listbox" aria-expanded="false" title="Font">
      <span class="ss-font-picker-label"></span><span class="ss-font-picker-caret" aria-hidden="true">▾</span>
    </button>`;
  const button = root.querySelector('.ss-font-picker-button');
  const label = root.querySelector('.ss-font-picker-label');

  const popup = document.createElement('div');
  popup.className = 'ss-font-picker-popup';
  popup.setAttribute('role', 'listbox');
  popup.hidden = true;
  popup.innerHTML = `<div class="ss-font-picker-preview" aria-hidden="true"></div>
    <div class="ss-font-picker-list">${Object.entries(FONT_GROUPS).map(([group, fonts]) => `
      <div class="ss-font-picker-group">
        <div class="ss-font-picker-group-title">${escHtml(group)}</div>
        ${fonts.map(f => `<button type="button" class="ss-font-picker-item" role="option" data-font="${escHtml(f)}" aria-selected="false"><span class="ss-font-picker-item-name" style="font-family:${escHtml(familyFor(f, group))}">${escHtml(f)}</span></button>`).join('')}
      </div>`).join('')}
    </div>`;
  const preview = popup.querySelector('.ss-font-picker-preview');
  const list = popup.querySelector('.ss-font-picker-list');
  const items = [...popup.querySelectorAll('.ss-font-picker-item')];
  const itemFont = item => item.dataset.font;
  const itemFamily = item => item.querySelector('.ss-font-picker-item-name').style.fontFamily;

  let value = KNOWN.has(current) ? current : 'Georgia';
  root._ssCurrent = value;

  function paintButton() {
    label.textContent = value;
    label.style.fontFamily = familyFor(value, groupOf(value));
    items.forEach(i => {
      const sel = itemFont(i) === value;
      i.classList.toggle('selected', sel);
      i.setAttribute('aria-selected', sel ? 'true' : 'false');
    });
    preview.textContent = PREVIEW_TEXT;
    preview.style.fontFamily = familyFor(value, groupOf(value));
  }
  function groupOf(font) {
    for (const [g, fonts] of Object.entries(FONT_GROUPS)) if (fonts.includes(font)) return g;
    return 'Traditional Serif';
  }
  function setFont(font) {
    if (!KNOWN.has(font)) return;
    value = font;
    root._ssCurrent = font;
    paintButton();
  }
  root._ssSetFont = setFont;

  function positionPopup() {
    const r = button.getBoundingClientRect();
    const w = Math.max(260, r.width);
    popup.style.minWidth = `${w}px`;
    let left = Math.min(r.left, window.innerWidth - w - 12);
    popup.style.left = `${Math.max(8, left)}px`;
    const h = Math.min(340, window.innerHeight - r.bottom - 16);
    popup.style.maxHeight = h > 140 ? `${h}px` : '340px';
    popup.style.top = `${r.bottom + 4}px`;
  }
  function open() {
    closeOpenPicker(api);
    if (!popup.isConnected) document.body.appendChild(popup);
    positionPopup();
    popup.hidden = false;
    root.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    openPicker = api;
    preview.style.fontFamily = familyFor(value, groupOf(value));
    const sel = popup.querySelector('.ss-font-picker-item.selected');
    if (sel) list.scrollTop = Math.max(0, sel.offsetTop - list.clientHeight / 2);
  }
  function close() {
    popup.hidden = true;
    root.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    if (openPicker === api) openPicker = null;
  }
  const api = { open, close, setFont, get value() { return value; }, root };

  button.addEventListener('click', () => { popup.hidden ? open() : close(); });
  popup.addEventListener('click', e => {
    const item = e.target.closest('.ss-font-picker-item');
    if (!item) return;
    setFont(itemFont(item));
    try { onPick && onPick(itemFont(item)); } finally { close(); }
  });
  // Live preview line follows the hovered / focused font.
  popup.addEventListener('mouseover', e => {
    const item = e.target.closest('.ss-font-picker-item');
    if (item) preview.style.fontFamily = itemFamily(item);
  });
  popup.addEventListener('focusin', e => {
    const item = e.target.closest('.ss-font-picker-item');
    if (item) preview.style.fontFamily = itemFamily(item);
  });
  list.addEventListener('mouseleave', () => { preview.style.fontFamily = familyFor(value, groupOf(value)); });
  popup.addEventListener('focusout', () => { preview.style.fontFamily = familyFor(value, groupOf(value)); });

  paintButton();
  return root;
}
