/* ScriptSmith editor reliability fixes.
 * ONE pagination engine. Pages are real fixed-height editors; overflow is moved
 * forward into the next page and the caret follows the document flow.
 */

const ssPages = () => document.querySelector('#ss-pages');
const ssEditors = () => [...document.querySelectorAll('#ss-pages .ss-page-content')];
const ssActiveEditor = () => document.querySelector('#ss-pages .ss-page.active .ss-page-content') || ssEditors()[0] || null;
const ssHeaderValue = () => document.querySelector('.ss-header-input')?.value || '';
const ssFooterValue = () => document.querySelector('.ss-footer-input')?.value || '';

function ssInstallEditor(editor) {
  if (!editor || editor.dataset.ssDirectFix === '1') return;
  editor.dataset.ssDirectFix = '1';
  editor.addEventListener('focus', () => {
    document.querySelectorAll('#ss-pages .ss-page').forEach(p => p.classList.remove('active'));
    editor.closest('.ss-page')?.classList.add('active');
  });
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
  editor.addEventListener('input', () => requestAnimationFrame(ssPaginate));
}

function ssStyleFonts() {
  const select = document.querySelector('#ss-font');
  if (!select || select.dataset.ssFontsApplied === '1') return;
  const current = select.value || 'Georgia';
  const groups = {
    'Traditional Serif': ['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Palatino','Palatino Linotype','Times New Roman'],
    'Literary Serif': ['Cormorant Garamond','Libre Baskerville','Merriweather','Noto Serif','Source Serif 4','Rockwell'],
    'Modern Sans': ['Aptos','Arial','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
    'Monospace': ['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
    'Display & Character': ['Arial Black','Copperplate','Franklin Gothic Medium','Impact','Nunito','Papyrus','Comic Sans MS','Segoe Print','Brush Script MT']
  };
  select.innerHTML = '';
  for (const [group, fonts] of Object.entries(groups)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    fonts.forEach(font => {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      option.style.fontFamily = `'${font.replace(/'/g, "\\'")}'`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }
  select.value = [...select.options].some(o => o.value === current) ? current : 'Georgia';
  select.dataset.ssFontsApplied = '1';
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
  controls.querySelector('.ss-header-input').value = document.querySelector('#ss-pages .ss-paper-header')?.textContent || '';
  controls.querySelector('.ss-footer-input').value = document.querySelector('#ss-pages .ss-paper-footer')?.textContent?.replace(/^Page\s+\d+$/,'') || '';
  controls.addEventListener('input', e => {
    if (e.target.classList.contains('ss-header-input')) document.querySelectorAll('#ss-pages .ss-paper-header').forEach(h => h.textContent = e.target.value);
    if (e.target.classList.contains('ss-footer-input')) document.querySelectorAll('#ss-pages .ss-paper-footer').forEach(f => f.textContent = e.target.value);
  });
}

function ssFormattingState() {
  ['bold','italic','underline','strikeThrough'].forEach(cmd => {
    document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(button => {
      let active = false;
      try { active = document.queryCommandState(cmd); } catch {}
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  });
}

function ssBindFormatting() {
  if (document.body.dataset.ssFormattingFix === '1') return;
  document.body.dataset.ssFormattingFix = '1';
  document.addEventListener('mousedown', e => {
    if (e.target.closest?.('#ss-ribbon .ss-tool[data-cmd="bold"],#ss-ribbon .ss-tool[data-cmd="italic"],#ss-ribbon .ss-tool[data-cmd="underline"],#ss-ribbon .ss-tool[data-cmd="strikeThrough"]')) e.preventDefault();
  }, true);
  document.addEventListener('selectionchange', ssFormattingState);
  document.addEventListener('keyup', ssFormattingState);
  document.addEventListener('mouseup', ssFormattingState);
}

function ssMakePage(index) {
  const pages = ssPages();
  if (!pages) return null;
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

function ssTextOffset(root, node, offset) {
  if (!root || !node) return 0;
  const range = document.createRange();
  try { range.setStart(root, 0); range.setEnd(node, offset); return range.toString().length; } catch { return 0; }
}

function ssSelectionBookmark() {
  const pages = ssPages();
  const sel = window.getSelection();
  if (!pages || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const startEditor = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement?.closest('.ss-page-content') : range.startContainer.closest?.('.ss-page-content');
  const endEditor = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement?.closest('.ss-page-content') : range.endContainer.closest?.('.ss-page-content');
  if (!startEditor || !endEditor) return null;
  let start = 0, end = 0;
  for (const editor of ssEditors()) {
    if (editor === startEditor) start += ssTextOffset(editor, range.startContainer, range.startOffset);
    else start += editor.textContent.length;
    if (editor === endEditor) { end += ssTextOffset(editor, range.endContainer, range.endOffset); break; }
    end += editor.textContent.length;
  }
  return { start, end };
}

function ssPointAtOffset(root, wanted) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, wanted), node;
  while ((node = walker.nextNode())) {
    if (remaining <= node.nodeValue.length) return { node, offset: remaining };
    remaining -= node.nodeValue.length;
  }
  return { node: root, offset: root.childNodes.length };
}

function ssRestoreSelection(bookmark) {
  if (!bookmark) return;
  const editors = ssEditors();
  let startRemaining = bookmark.start;
  let endRemaining = bookmark.end;
  let startEditor = editors[editors.length - 1] || null;
  let endEditor = startEditor;
  for (const editor of editors) {
    const len = editor.textContent.length;
    if (bookmark.start <= startRemaining && startRemaining <= len) { startEditor = editor; break; }
    startRemaining -= len;
  }
  for (const editor of editors) {
    const len = editor.textContent.length;
    if (bookmark.end <= endRemaining && endRemaining <= len) { endEditor = editor; break; }
    endRemaining -= len;
  }
  if (!startEditor || !endEditor) return;
  const a = ssPointAtOffset(startEditor, startRemaining);
  const b = ssPointAtOffset(endEditor, endRemaining);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  startEditor.closest('.ss-page')?.classList.add('active');
}

function ssCloneFits(content, keepLength) {
  const clone = content.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.width = `${content.getBoundingClientRect().width}px`;
  clone.style.height = `${content.clientHeight}px`;
  clone.style.overflow = 'hidden';
  document.body.appendChild(clone);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  let remaining = keepLength;
  let reached = false;
  for (const text of nodes) {
    if (remaining >= text.nodeValue.length) remaining -= text.nodeValue.length;
    else {
      text.nodeValue = text.nodeValue.slice(0, Math.max(0, remaining));
      remaining = 0;
      reached = true;
    }
    if (reached) {
      let sibling = text.nextSibling;
      while (sibling) { const next = sibling.nextSibling; sibling.remove(); sibling = next; }
      let parent = text.parentNode;
      while (parent && parent !== clone) {
        let next = parent.nextSibling;
        while (next) { const after = next.nextSibling; next.remove(); next = after; }
        parent = parent.parentNode;
      }
      break;
    }
  }
  const fits = clone.scrollHeight <= clone.clientHeight + 2;
  clone.remove();
  return fits;
}

function ssSplitLongText(content, nextContent) {
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) if (n.nodeValue.length) nodes.push(n);
  if (!nodes.length) return false;
  const total = nodes.reduce((sum, x) => sum + x.nodeValue.length, 0);
  if (total < 2) return false;
  let low = 1, high = total - 1, best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (ssCloneFits(content, mid)) { best = mid; low = mid + 1; }
    else high = mid - 1;
  }
  if (!best) return false;
  let cut = best, consumed = 0;
  for (const text of nodes) {
    if (consumed + text.nodeValue.length >= best) {
      const local = best - consumed;
      const before = text.nodeValue.slice(0, local);
      const boundary = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t'));
      if (boundary > 20) cut = consumed + boundary + 1;
      break;
    }
    consumed += text.nodeValue.length;
  }
  let pos = 0, cutNode = null, cutOffset = 0;
  for (const text of nodes) {
    if (pos + text.nodeValue.length >= cut) { cutNode = text; cutOffset = cut - pos; break; }
    pos += text.nodeValue.length;
  }
  if (!cutNode || cutOffset <= 0 || cutOffset >= cutNode.nodeValue.length) return false;
  const range = document.createRange();
  range.setStart(cutNode, cutOffset);
  range.setEnd(content, content.childNodes.length);
  const fragment = range.extractContents();
  if (!fragment.textContent?.length) return false;
  nextContent.appendChild(fragment);
  return true;
}

function ssSplitPage(page) {
  const content = page.querySelector('.ss-page-content');
  if (!content || content.scrollHeight <= content.clientHeight + 2) return false;
  const pages = ssPages();
  const list = [...pages.querySelectorAll('.ss-page')];
  const index = list.indexOf(page);
  const next = list[index + 1] || ssMakePage(index + 1);
  if (!next) return false;
  const nextContent = next.querySelector('.ss-page-content');

  // Move complete blocks first. This preserves formatting and avoids breaking
  // paragraphs until a paragraph itself is taller than the page.
  let moved = false;
  while (content.scrollHeight > content.clientHeight + 2 && content.children.length > 1) {
    nextContent.insertBefore(content.lastElementChild, nextContent.firstChild);
    moved = true;
  }
  if (content.scrollHeight > content.clientHeight + 2) {
    const split = ssSplitLongText(content, nextContent);
    moved = moved || split;
  }
  return moved;
}

let ssPaginationQueued = false;
function ssPaginate() {
  if (ssPaginationQueued) return;
  ssPaginationQueued = true;
  requestAnimationFrame(() => {
    ssPaginationQueued = false;
    const pages = ssPages();
    if (!pages) return;
    const bookmark = ssSelectionBookmark();
    ssEditors().forEach(ssInstallEditor);
    let guard = 0, changed = true;
    while (changed && guard++ < 200) {
      changed = false;
      for (const page of [...pages.querySelectorAll('.ss-page')]) {
        if (ssSplitPage(page)) changed = true;
      }
    }
    pages.querySelectorAll('.ss-page').forEach((page, i) => {
      page.dataset.page = String(i);
      const header = page.querySelector('.ss-paper-header');
      const footer = page.querySelector('.ss-paper-footer');
      if (header && !header.textContent) header.textContent = ssHeaderValue();
      if (footer && !ssFooterValue()) footer.textContent = `Page ${i + 1}`;
    });
    const count = pages.querySelectorAll('.ss-page').length || 1;
    const counter = document.querySelector('#ss-page-count');
    if (counter) counter.textContent = `${count} ${count === 1 ? 'page' : 'pages'}`;
    ssRestoreSelection(bookmark);
  });
}

function ssInstallPagination() {
  const pages = ssPages();
  if (!pages || pages.dataset.ssPaginationFix === '1') return;
  pages.dataset.ssPaginationFix = '1';
  pages.addEventListener('input', ssPaginate);
  pages.addEventListener('paste', () => requestAnimationFrame(ssPaginate));
  requestAnimationFrame(ssPaginate);
}

function ssCloseCharacterAfterSave() {
  if (document.body.dataset.ssCloseCharacterHook === '1') return;
  document.body.dataset.ssCloseCharacterHook = '1';
  document.addEventListener('click', e => {
    const save = e.target.closest?.('#ss-record-save');
    if (!save) return;
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
let ssEnhanceQueued = false;
const ssEnhanceQueuedRun = () => {
  if (ssEnhanceQueued) return;
  ssEnhanceQueued = true;
  requestAnimationFrame(() => {
    ssEnhanceQueued = false;
    ssEnhance();
  });
};
new MutationObserver(ssEnhanceQueuedRun).observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', ssEnhance);
setTimeout(ssEnhance, 50);
