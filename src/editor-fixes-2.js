/* ScriptSmith editor fixes: pagination, active formatting state, font previews, Tab indentation, and visible header/footer controls. */

const FONT_GROUPS = {
  'Classic Serif': ['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Cormorant Garamond','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Libre Baskerville','Palatino','Palatino Linotype','Times New Roman'],
  'Modern Serif': ['Noto Serif','Source Serif 4','Merriweather','Rockwell'],
  'Sans Serif': ['Arial','Aptos','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
  'Monospace': ['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
  'Display / Decorative': ['Arial Black','Copperplate','Franklin Gothic Medium','Nunito']
};

const cssFamily = f => f.includes(' ') ? `'${f}'` : f;
const editorPages = () => document.querySelector('#ss-pages');
const activeEditor = () => document.querySelector('#ss-pages .ss-page.active [contenteditable]') || document.querySelector('#ss-pages [contenteditable]');

function preserveSelection(fn) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return fn();
  const range = sel.getRangeAt(0).cloneRange();
  const result = fn();
  try { sel.removeAllRanges(); sel.addRange(range); } catch {}
  return result;
}

function installTabIndent(editor) {
  if (!editor || editor.dataset.tabFix === '1') return;
  editor.dataset.tabFix = '1';
  editor.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    e.stopPropagation();
    editor.focus();
    document.execCommand('indent', false, null);
    if (window.getSelection()?.isCollapsed) document.execCommand('insertText', false, '\u00a0\u00a0\u00a0\u00a0');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
}

function styleFontOptions(select) {
  if (!select || select.dataset.fontFix === '1') return;
  select.dataset.fontFix = '1';
  const current = select.value;
  const source = [...select.options].map(o => o.value).filter(Boolean);
  select.innerHTML = '';
  Object.entries(FONT_GROUPS).forEach(([group, fonts]) => {
    const og = document.createElement('optgroup'); og.label = group;
    fonts.filter(f => source.includes(f) || ['Baskerville','Bodoni 72','Bookman','Copperplate','Didot','Futura','Hoefler Text','Noto Serif','Source Serif 4'].includes(f)).forEach(f => {
      const o = document.createElement('option'); o.value = f; o.textContent = f; o.style.fontFamily = cssFamily(f); og.appendChild(o);
    });
    if (og.children.length) select.appendChild(og);
  });
  if (![...select.options].some(o => o.value === current)) {
    const o = document.createElement('option'); o.value = current; o.textContent = current; o.style.fontFamily = cssFamily(current); select.appendChild(o);
  }
  select.value = current;
  select.title = 'Choose a font — each name is previewed in its own typeface';
}

function updateFormattingState() {
  const commands = ['bold','italic','underline','strikeThrough'];
  document.querySelectorAll('#ss-ribbon .ss-tool[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (!commands.includes(cmd)) return;
    let active = false;
    try { active = document.queryCommandState(cmd); } catch {}
    btn.classList.toggle('active', !!active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function bindFormattingState() {
  if (document.body.dataset.formatStateFix !== '1') {
    document.body.dataset.formatStateFix = '1';
    document.addEventListener('selectionchange', updateFormattingState);
    document.addEventListener('keyup', updateFormattingState);
    document.addEventListener('mouseup', updateFormattingState);
  }
  updateFormattingState();
}

function addHeaderFooterControls() {
  const group = [...document.querySelectorAll('#ss-ribbon .ss-ribbon-group')].find(g => /Header & Footer/i.test(g.textContent || ''));
  if (!group || group.querySelector('.ss-header-footer-controls')) return;
  const controls = document.createElement('div');
  controls.className = 'ss-header-footer-controls';
  controls.innerHTML = '<label>Header <input class="ss-header-input" type="text" placeholder="Header text"></label><label>Footer <input class="ss-footer-input" type="text" placeholder="Footer text"></label>';
  group.appendChild(controls);
  const pages = editorPages();
  const header = pages?.querySelector('.ss-paper-header');
  const footer = pages?.querySelector('.ss-paper-footer');
  controls.querySelector('.ss-header-input').value = header?.textContent || '';
  controls.querySelector('.ss-footer-input').value = footer?.textContent?.replace(/^Page \d+$/, '') || '';
  controls.addEventListener('input', e => {
    if (!pages) return;
    if (e.target.classList.contains('ss-header-input')) pages.querySelectorAll('.ss-paper-header').forEach(x => x.textContent = e.target.value);
    if (e.target.classList.contains('ss-footer-input')) pages.querySelectorAll('.ss-paper-footer').forEach(x => x.textContent = e.target.value);
  });
}

function textLength(root) {
  return (root.textContent || '').length;
}

function splitOverflow(page) {
  const content = page.querySelector('.ss-page-content');
  if (!content || content.scrollHeight <= content.clientHeight + 6) return false;
  const pages = editorPages();
  const index = [...pages.children].indexOf(page);
  const next = pages.children[index + 1] || (() => {
    const p = document.createElement('article');
    p.className = 'ss-page';
    p.dataset.page = String(index + 1);
    p.innerHTML = '<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true"></div><div class="ss-paper-footer"></div>';
    pages.appendChild(p);
    return p;
  })();
  const nextContent = next.querySelector('.ss-page-content');
  nextContent.spellcheck = content.spellcheck;

  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  if (!nodes.length) return false;

  // Move trailing text until the current page fits. Range extraction preserves
  // inline formatting and moves the text rather than flattening the manuscript.
  let lo = 0, hi = nodes.reduce((sum, x) => sum + x.nodeValue.length, 0);
  const total = hi;
  const locate = pos => {
    let count = 0;
    for (const node of nodes) {
      const end = count + node.nodeValue.length;
      if (pos <= end) return [node, Math.max(0, pos - count)];
      count = end;
    }
    return [nodes[nodes.length - 1], nodes[nodes.length - 1].nodeValue.length];
  };
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const [node, offset] = locate(mid);
    const range = document.createRange();
    range.setStart(node, offset); range.setEnd(content, content.childNodes.length);
    const frag = range.cloneContents();
    const test = document.createElement('div');
    test.className = 'ss-page-content ss-measure-copy';
    test.innerHTML = content.innerHTML;
    test.querySelectorAll('.ss-measure-copy').forEach(x => x.remove());
    try { range.deleteContents(); test.appendChild(frag.cloneNode(true)); } catch {}
    // Put the deleted content back immediately; measurement is done with a clone below.
    try { range.insertNode(frag.cloneNode(true)); } catch {}
    const clone = content.cloneNode(true);
    clone.classList.add('ss-measure-copy');
    clone.style.position = 'absolute'; clone.style.visibility = 'hidden'; clone.style.height = getComputedStyle(content).height; clone.style.width = getComputedStyle(content).width;
    document.body.appendChild(clone);
    try { const [sn, so] = (() => { const w=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT); let c=0,x; while(x=w.nextNode()){ if(c+x.nodeValue.length>=mid)return[x,Math.max(0,mid-c)]; c+=x.nodeValue.length;} return [null,0];})(); if(sn){const rr=document.createRange();rr.setStart(sn,so);rr.setEnd(clone,clone.childNodes.length);rr.deleteContents();} if(clone.scrollHeight<=clone.clientHeight+6) best=mid; } finally { clone.remove(); }
    if (best === mid) lo = mid + 1; else hi = mid - 1;
  }
  if (best >= total) return false;
  const [startNode, startOffset] = locate(best);
  const range = document.createRange(); range.setStart(startNode, startOffset); range.setEnd(content, content.childNodes.length);
  const fragment = range.extractContents();
  if (fragment.textContent.trim()) nextContent.insertBefore(fragment, nextContent.firstChild);
  next.querySelector('.ss-paper-header').textContent = page.querySelector('.ss-paper-header')?.textContent || '';
  next.querySelector('.ss-paper-footer').textContent = page.querySelector('.ss-paper-footer')?.textContent || '';
  installTabIndent(nextContent);
  return true;
}

function paginateAll() {
  const pages = editorPages(); if (!pages) return;
  let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    [...pages.querySelectorAll('.ss-page')].forEach(page => { if (splitOverflow(page)) changed = true; });
  }
  pages.querySelectorAll('.ss-page').forEach((p,i) => { p.dataset.page=String(i); });
  const count = pages.querySelectorAll('.ss-page').length || 1;
  const pc = document.querySelector('#ss-page-count'); if (pc) pc.textContent = `${count} ${count===1?'page':'pages'}`;
}

function installPagination() {
  const pages = editorPages(); if (!pages || pages.dataset.paginationFix === '1') return;
  pages.dataset.paginationFix = '1';
  pages.querySelectorAll('.ss-page-content').forEach(installTabIndent);
  pages.addEventListener('input', () => requestAnimationFrame(paginateAll));
  requestAnimationFrame(paginateAll);
}

function enhance() {
  styleFontOptions(document.querySelector('#ss-font'));
  document.querySelectorAll('#ss-pages .ss-page-content').forEach(installTabIndent);
  bindFormattingState();
  addHeaderFooterControls();
  installPagination();
}

const observer = new MutationObserver(() => enhance());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhance);
setTimeout(enhance, 0);
setInterval(() => { if (document.querySelector('#ss-pages')) paginateAll(); }, 900);
