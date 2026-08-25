import { getCurrentDocument } from './document.js';

const FONT_LIBRARY = [
  'Georgia','Garamond','Baskerville','Palatino Linotype','Book Antiqua','Cambria','Times New Roman','Constantia','Century Schoolbook','Bookman Old Style',
  'Bodoni 72','Didot','Rockwell','Copperplate','Charter','Hoefler Text','Iowan Old Style','New York','Cochin','Perpetua',
  'Arial','Helvetica','Verdana','Tahoma','Trebuchet MS','Calibri','Cambria','Candara','Segoe UI','Gill Sans',
  'Franklin Gothic Medium','Century Gothic','Lucida Sans','Lucida Grande','Avenir','Futura','Optima','Corbel','Impact','Arial Black',
  'Courier New','Courier Prime','Consolas','Lucida Console','American Typewriter','Monaco','Menlo','Andale Mono','Rockwell Extra Bold','URW Bookman'
];
const SPACING = [['1','Single'],['1.15','1.15'],['1.5','1.5'],['2','Double'],['2.5','2.5'],['3','Triple']];

const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentPrefs = () => {
  const d = getCurrentDocument();
  if (!d) return null;
  d.metadata = d.metadata || {};
  d.metadata.manuscriptPreferences = { fontFamily:'Georgia', fontSize:12, lineSpacing:1, header:'', footer:'', pageNumbers:false, ...(d.metadata.manuscriptPreferences || {}) };
  return d.metadata.manuscriptPreferences;
};

function makeSelect(id, values, label) {
  const select = document.createElement('select');
  select.id = id;
  select.title = label;
  values.forEach(([value,text]) => { const o=document.createElement('option'); o.value=value; o.textContent=text; select.appendChild(o); });
  return select;
}

function ensureToolbar() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || toolbar.dataset.sprint21 === 'true') return;
  toolbar.dataset.sprint21 = 'true';

  const oldFont = toolbar.querySelector('#font');
  const oldSize = toolbar.querySelector('#size');
  if (oldFont) {
    oldFont.innerHTML = '';
    FONT_LIBRARY.forEach(font => { const o=document.createElement('option'); o.value=font; o.textContent=font; o.style.fontFamily=font; oldFont.appendChild(o); });
  }

  const sep = () => { const s=document.createElement('span'); s.className='toolbar-separator'; return s; };
  const spacing = makeSelect('line-spacing', SPACING, 'Line spacing');
  toolbar.appendChild(sep());
  toolbar.appendChild(spacing);

  const addButton = (id,text,title,handler) => { const b=document.createElement('button'); b.id=id; b.type='button'; b.textContent=text; b.title=title; b.onclick=handler; toolbar.appendChild(b); return b; };
  addButton('format-bullet','•','Bulleted list',()=>document.execCommand('insertUnorderedList'));
  addButton('format-number','1.','Numbered list',()=>document.execCommand('insertOrderedList'));
  addButton('format-indent','→','Increase indent',()=>document.execCommand('indent'));
  addButton('format-outdent','←','Decrease indent',()=>document.execCommand('outdent'));
  addButton('format-heading','H','Heading',()=>document.execCommand('formatBlock',false,'h2'));
  addButton('insert-page-break','¶','Page break',insertPageBreak);
  addButton('header-footer','H/F','Header & footer',showHeaderFooterDialog);
  addButton('page-number','№','Page numbers',togglePageNumbers);

  const p=currentPrefs();
  if (p) {
    if (oldFont) oldFont.value=p.fontFamily || 'Georgia';
    if (oldSize) oldSize.value=String(p.fontSize || 12);
    spacing.value=String(p.lineSpacing || 1);
  }

  oldFont?.addEventListener('change',()=>setManuscriptPref('fontFamily',oldFont.value));
  oldSize?.addEventListener('change',()=>setManuscriptPref('fontSize',Number(oldSize.value)));
  spacing.addEventListener('change',()=>setManuscriptPref('lineSpacing',Number(spacing.value)));
}

function setManuscriptPref(key,value) {
  const p=currentPrefs(); if (!p) return;
  p[key]=value;
  applyManuscriptFormatting();
  document.querySelector('#save-status')?.replaceChildren(document.createTextNode('Unsaved changes'));
}

function applyManuscriptFormatting() {
  const editor=document.querySelector('#editor'); const p=currentPrefs();
  if (!editor || !p) return;
  editor.style.fontFamily=p.fontFamily || 'Georgia';
  editor.style.fontSize=`${p.fontSize || 12}px`;
  editor.style.lineHeight=String(p.lineSpacing || 1);
  editor.style.setProperty('--sprint21-header', `"${esc(p.header || '')}"`);
  editor.style.setProperty('--sprint21-footer', `"${esc(p.footer || '')}"`);
  editor.classList.toggle('has-page-numbers', !!p.pageNumbers);
}

function insertPageBreak() {
  const editor=document.querySelector('#editor'); if(!editor) return;
  editor.focus(); document.execCommand('insertHTML',false,'<div class="sprint21-page-break" contenteditable="false"></div><p><br></p>');
}

function showHeaderFooterDialog() {
  const p=currentPrefs(); if(!p) return;
  let modal=document.querySelector('#sprint21-format-dialog');
  if(!modal){ modal=document.createElement('div'); modal.id='sprint21-format-dialog'; document.body.appendChild(modal); }
  modal.innerHTML=`<div class="sprint19-modal-backdrop"><section class="sprint19-modal sprint21-format-modal"><header><div><h2>Header & Footer</h2><p>These settings belong to this manuscript.</p></div><button id="s21-format-close" class="theme-button">Close</button></header><div class="sprint19-setting-grid sprint21-format-fields"><label>Header<textarea id="s21-header" placeholder="Optional manuscript header">${esc(p.header||'')}</textarea></label><label>Footer<textarea id="s21-footer" placeholder="Optional manuscript footer">${esc(p.footer||'')}</textarea></label><label class="sprint21-check"><span>Page numbering</span><input id="s21-pages" type="checkbox" ${p.pageNumbers?'checked':''}></label></div><button id="s21-format-save" class="primary-action">Apply to Manuscript</button></section></div>`;
  modal.hidden=false;
  modal.querySelector('#s21-format-close').onclick=()=>modal.hidden=true;
  modal.querySelector('#s21-format-save').onclick=()=>{p.header=modal.querySelector('#s21-header').value;p.footer=modal.querySelector('#s21-footer').value;p.pageNumbers=modal.querySelector('#s21-pages').checked;applyManuscriptFormatting();modal.hidden=true;document.querySelector('#save-status')?.replaceChildren(document.createTextNode('Unsaved changes'));};
}

function togglePageNumbers() { const p=currentPrefs(); if(!p)return; p.pageNumbers=!p.pageNumbers; applyManuscriptFormatting(); }

function enhance() {
  const homeSelectors='.template-card,.project-card,.universal-card';
  document.addEventListener('click',e=>{
    const palette=e.target.closest('.color-palette');
    if(!palette&&!e.target.closest('#text-color')&&!e.target.closest('#highlight-color')) document.querySelectorAll('.color-palette').forEach(x=>x.remove());
  });
  const observer=new MutationObserver(()=>{
    document.querySelectorAll(homeSelectors).forEach(x=>x.classList.add('polished-card'));
    ensureToolbar();
    applyManuscriptFormatting();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  ensureToolbar();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhance); else enhance();
