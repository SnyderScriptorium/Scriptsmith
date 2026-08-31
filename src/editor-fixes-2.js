/* ScriptSmith — direct editor behavior fixes. These hooks target the actual DOM created by app.js. */

const SS_FONT_GROUPS = {
  'Traditional Serif': ['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Palatino','Palatino Linotype','Times New Roman'],
  'Literary Serif': ['Cormorant Garamond','Libre Baskerville','Merriweather','Noto Serif','Source Serif 4','Rockwell'],
  'Modern Sans': ['Aptos','Arial','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
  'Monospace': ['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
  'Display & Character': ['Arial Black','Copperplate','Franklin Gothic Medium','Impact','Nunito','Papyrus','Comic Sans MS','Segoe Print','Brush Script MT']
};

const ssPages = () => document.querySelector('#ss-pages');
const ssEditors = () => [...document.querySelectorAll('#ss-pages .ss-page-content')];
const ssActiveEditor = () => document.querySelector('#ss-pages .ss-page.active .ss-page-content') || ssEditors()[0] || null;
const ssHeaderValue = () => document.querySelector('.ss-header-input')?.value || '';
const ssFooterValue = () => document.querySelector('.ss-footer-input')?.value || '';

function ssInstallEditor(editor) {
  if (!editor || editor.dataset.ssDirectFix === '1') return;
  editor.dataset.ssDirectFix = '1';

  editor.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    let node = sel.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node?.closest?.('p,h1,h2,h3,h4,h5,h6,blockquote,li,div') || editor;
    const current = parseFloat(block.style.textIndent || '0') || 0;
    const delta = e.shiftKey ? -0.5 : 0.5;
    block.style.textIndent = `${Math.max(0, current + delta)}in`;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
}

function ssStyleFonts() {
  const select = document.querySelector('#ss-font');
  if (!select) return;
  const current = select.value || 'Georgia';
  select.innerHTML = '';
  for (const [group, fonts] of Object.entries(SS_FONT_GROUPS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const font of fonts) {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      option.style.fontFamily = font.includes(' ') ? `'${font}'` : font;
      option.title = `Preview: ${font}`;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.value = [...select.options].some(o => o.value === current) ? current : 'Georgia';
  select.onchange = () => {
    const editor = ssActiveEditor();
    if (!editor) return;
    editor.focus();
    document.execCommand('fontName', false, select.value);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };
}

function ssAddHeaderFooterFields() {
  const group = [...document.querySelectorAll('#ss-ribbon .ss-ribbon-group')].find(g => /Header\s*\/\s*Footer|Header.*Footer/i.test(g.textContent || ''));
  if (!group || group.querySelector('.ss-header-footer-controls')) return;
  const controls = document.createElement('div');
  controls.className = 'ss-header-footer-controls';
  controls.innerHTML = '<label>Header <input class="ss-header-input" type="text" placeholder="Type your header"></label><label>Footer <input class="ss-footer-input" type="text" placeholder="Type your footer"></label>';
  group.appendChild(controls);

  const savedHeader = document.querySelector('#ss-pages .ss-paper-header')?.textContent || '';
  const savedFooter = document.querySelector('#ss-pages .ss-paper-footer')?.textContent || '';
  controls.querySelector('.ss-header-input').value = savedHeader;
  controls.querySelector('.ss-footer-input').value = savedFooter.replace(/^Page\s+\d+$/,'');

  controls.addEventListener('input', e => {
    if (e.target.classList.contains('ss-header-input')) {
      document.querySelectorAll('#ss-pages .ss-paper-header').forEach(h => h.textContent = e.target.value);
    }
    if (e.target.classList.contains('ss-footer-input')) {
      document.querySelectorAll('#ss-pages .ss-paper-footer').forEach(f => f.textContent = e.target.value);
    }
  });
}

function ssFormattingState() {
  for (const cmd of ['bold','italic','underline','strikeThrough']) {
    document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(button => {
      let active = false;
      try { active = document.queryCommandState(cmd); } catch {}
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
}

function ssBindFormatting() {
  if (document.body.dataset.ssFormattingFix === '1') return;
  document.body.dataset.ssFormattingFix = '1';
  document.addEventListener('mousedown', e => {
    const button = e.target.closest?.('#ss-ribbon .ss-tool[data-cmd="bold"],#ss-ribbon .ss-tool[data-cmd="italic"],#ss-ribbon .ss-tool[data-cmd="underline"],#ss-ribbon .ss-tool[data-cmd="strikeThrough"]');
    if (button) e.preventDefault();
  }, true);
  document.addEventListener('selectionchange', ssFormattingState);
  document.addEventListener('keyup', ssFormattingState);
  document.addEventListener('mouseup', ssFormattingState);
  ssFormattingState();
}

function ssMakePage(index) {
  const pages = ssPages();
  const page = document.createElement('article');
  page.className = 'ss-page';
  page.dataset.page = String(index);
  page.innerHTML = '<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true" spellcheck="true"></div><div class="ss-paper-footer"></div>';
  pages.appendChild(page);
  page.querySelector('.ss-paper-header').textContent = ssHeaderValue();
  page.querySelector('.ss-paper-footer').textContent = ssFooterValue();
  ssInstallEditor(page.querySelector('.ss-page-content'));
  return page;
}

function ssSplitPage(page) {
  const content = page.querySelector('.ss-page-content');
  if (!content || content.scrollHeight <= content.clientHeight + 3) return false;
  const pages = ssPages();
  const index = [...pages.querySelectorAll('.ss-page')].indexOf(page);
  const next = pages.querySelectorAll('.ss-page')[index + 1] || ssMakePage(index + 1);
  const nextContent = next.querySelector('.ss-page-content');

  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  const total = nodes.reduce((n, x) => n + x.nodeValue.length, 0);
  if (!total) return false;

  const locate = position => {
    let offset = 0;
    for (const text of nodes) {
      if (position <= offset + text.nodeValue.length) return [text, position - offset];
      offset += text.nodeValue.length;
    }
    return [nodes[nodes.length - 1], nodes[nodes.length - 1].nodeValue.length];
  };

  // Binary-search the character position that fits on the current physical page.
  let low = 0, high = total, best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const clone = content.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = '-100000px';
    clone.style.top = '0';
    clone.style.visibility = 'hidden';
    clone.style.height = `${content.clientHeight}px`;
    clone.style.width = `${content.clientWidth}px`;
    document.body.appendChild(clone);
    const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let seen = 0, cutNode = null, cutOffset = 0, x;
    while ((x = w.nextNode())) {
      if (mid <= seen + x.nodeValue.length) { cutNode = x; cutOffset = mid - seen; break; }
      seen += x.nodeValue.length;
    }
    if (cutNode) {
      const range = document.createRange();
      range.setStart(cutNode, cutOffset);
      range.setEnd(clone, clone.childNodes.length);
      range.deleteContents();
    }
    const fits = clone.scrollHeight <= clone.clientHeight + 3;
    clone.remove();
    if (fits) { best = mid; low = mid + 1; } else high = mid - 1;
  }

  // Never split inside the first few characters of a page; leave a normal page break instead.
  if (best <= 0 || best >= total) return false;
  const [start, offset] = locate(best);
  const range = document.createRange();
  range.setStart(start, Math.max(0, offset));
  range.setEnd(content, content.childNodes.length);
  const fragment = range.extractContents();
  if (!fragment.textContent?.trim()) return false;
  nextContent.insertBefore(fragment, nextContent.firstChild);
  next.querySelector('.ss-paper-header').textContent = ssHeaderValue();
  next.querySelector('.ss-paper-footer').textContent = ssFooterValue();
  return true;
}

function ssPaginate() {
  const pages = ssPages();
  if (!pages) return;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 30) {
    changed = false;
    for (const page of [...pages.querySelectorAll('.ss-page')]) {
      if (ssSplitPage(page)) changed = true;
    }
  }
  pages.querySelectorAll('.ss-page').forEach((page, i) => page.dataset.page = String(i));
  const count = pages.querySelectorAll('.ss-page').length || 1;
  const counter = document.querySelector('#ss-page-count');
  if (counter) counter.textContent = `${count} ${count === 1 ? 'page' : 'pages'}`;
}

function ssInstallPagination() {
  const pages = ssPages();
  if (!pages || pages.dataset.ssPaginationFix === '1') return;
  pages.dataset.ssPaginationFix = '1';
  ssEditors().forEach(ssInstallEditor);
  pages.addEventListener('input', () => requestAnimationFrame(ssPaginate));
  requestAnimationFrame(ssPaginate);
}

function ssCloseCharacterAfterSave() {
  document.addEventListener('click', e => {
    const save = e.target.closest?.('#ss-record-save');
    if (!save || save.dataset.ssCloseHook === '1') return;
    save.dataset.ssCloseHook = '1';
    // app.js performs the actual save synchronously in its onclick. Run after it.
    setTimeout(() => document.querySelector('#ss-record-back')?.click(), 0);
  }, true);
}

function ssEnhance() {
  ssStyleFonts();
  ssEditors().forEach(ssInstallEditor);
  ssAddHeaderFooterFields();
  ssBindFormatting();
  ssInstallPagination();
}

ssCloseCharacterAfterSave();
new MutationObserver(ssEnhance).observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', ssEnhance);
setTimeout(ssEnhance, 50);
