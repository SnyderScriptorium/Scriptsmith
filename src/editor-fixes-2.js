/* ScriptSmith editor fixes: pagination, active formatting state, font previews, Tab indentation, visible header/footer controls, and character-save closing. */

const FONT_GROUPS = {
  'Classic Serif': ['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Cormorant Garamond','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Libre Baskerville','Palatino','Palatino Linotype','Times New Roman'],
  'Modern Serif': ['Noto Serif','Source Serif 4','Merriweather','Rockwell'],
  'Sans Serif': ['Arial','Aptos','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
  'Monospace': ['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
  'Display / Decorative': ['Arial Black','Copperplate','Franklin Gothic Medium','Nunito']
};
const cssFamily = f => f.includes(' ') ? `'${f}'` : f;
const editorPages = () => document.querySelector('#ss-pages');

function installTabIndent(editor) {
  if (!editor || editor.dataset.tabFix === '1') return;
  editor.dataset.tabFix = '1';
  editor.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault(); e.stopPropagation(); editor.focus();
    document.execCommand('indent', false, null);
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
  ['bold','italic','underline','strikeThrough'].forEach(cmd => {
    document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(btn => {
      let active = false; try { active = document.queryCommandState(cmd); } catch {}
      btn.classList.toggle('active', !!active); btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
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
  const controls = document.createElement('div'); controls.className = 'ss-header-footer-controls';
  controls.innerHTML = '<label>Header <input class="ss-header-input" type="text" placeholder="Header text"></label><label>Footer <input class="ss-footer-input" type="text" placeholder="Footer text"></label>';
  group.appendChild(controls);
  const pages = editorPages();
  controls.querySelector('.ss-header-input').value = pages?.querySelector('.ss-paper-header')?.textContent || '';
  controls.querySelector('.ss-footer-input').value = pages?.querySelector('.ss-paper-footer')?.textContent?.replace(/^Page \d+$/, '') || '';
  controls.addEventListener('input', e => {
    if (!pages) return;
    if (e.target.classList.contains('ss-header-input')) pages.querySelectorAll('.ss-paper-header').forEach(x => x.textContent = e.target.value);
    if (e.target.classList.contains('ss-footer-input')) pages.querySelectorAll('.ss-paper-footer').forEach(x => x.textContent = e.target.value);
  });
}

function splitOverflow(page) {
  const content = page.querySelector('.ss-page-content');
  if (!content || content.scrollHeight <= content.clientHeight + 6) return false;
  const pages = editorPages(), index = [...pages.children].indexOf(page);
  const next = pages.children[index + 1] || (() => {
    const p = document.createElement('article'); p.className = 'ss-page'; p.dataset.page = String(index + 1);
    p.innerHTML = '<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true"></div><div class="ss-paper-footer"></div>';
    pages.appendChild(p); return p;
  })();
  const nextContent = next.querySelector('.ss-page-content'); nextContent.spellcheck = content.spellcheck;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT), nodes = [];
  let n; while ((n = walker.nextNode())) nodes.push(n);
  if (!nodes.length) return false;
  const locate = pos => { let count=0; for(const node of nodes){const end=count+node.nodeValue.length;if(pos<=end)return[node,Math.max(0,pos-count)];count=end;}return[nodes[nodes.length-1],nodes[nodes.length-1].nodeValue.length]; };
  const total = nodes.reduce((s,x)=>s+x.nodeValue.length,0); let lo=0,hi=total,best=0;
  while(lo<=hi){
    const mid=Math.floor((lo+hi)/2), clone=content.cloneNode(true); clone.classList.add('ss-measure-copy');
    clone.style.position='absolute';clone.style.visibility='hidden';clone.style.height=getComputedStyle(content).height;clone.style.width=getComputedStyle(content).width;
    document.body.appendChild(clone);
    const w=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT);let c=0,x,start=null,off=0;while((x=w.nextNode())){if(c+x.nodeValue.length>=mid){start=x;off=Math.max(0,mid-c);break;}c+=x.nodeValue.length;}
    if(start){const rr=document.createRange();rr.setStart(start,off);rr.setEnd(clone,clone.childNodes.length);rr.deleteContents();}
    const fits=clone.scrollHeight<=clone.clientHeight+6;clone.remove();if(fits){best=mid;lo=mid+1;}else hi=mid-1;
  }
  if(best>=total)return false;
  const [startNode,startOffset]=locate(best), range=document.createRange(); range.setStart(startNode,startOffset); range.setEnd(content,content.childNodes.length);
  const fragment=range.extractContents(); if(fragment.textContent.trim())nextContent.insertBefore(fragment,nextContent.firstChild);
  next.querySelector('.ss-paper-header').textContent=page.querySelector('.ss-paper-header')?.textContent||'';
  next.querySelector('.ss-paper-footer').textContent=page.querySelector('.ss-paper-footer')?.textContent||'';
  installTabIndent(nextContent); return true;
}

function paginateAll() {
  const pages=editorPages(); if(!pages)return;
  let changed=true,guard=0; while(changed&&guard++<50){changed=false;[...pages.querySelectorAll('.ss-page')].forEach(p=>{if(splitOverflow(p))changed=true;});}
  pages.querySelectorAll('.ss-page').forEach((p,i)=>p.dataset.page=String(i));
  const count=pages.querySelectorAll('.ss-page').length||1, pc=document.querySelector('#ss-page-count'); if(pc)pc.textContent=`${count} ${count===1?'page':'pages'}`;
}

function installPagination(){
  const pages=editorPages(); if(!pages||pages.dataset.paginationFix==='1')return;
  pages.dataset.paginationFix='1'; pages.querySelectorAll('.ss-page-content').forEach(installTabIndent);
  pages.addEventListener('input',()=>requestAnimationFrame(paginateAll)); requestAnimationFrame(paginateAll);
}

function closeCharacterEditorAfterSave(){
  if(document.body.dataset.characterSaveFix==='1')return;
  document.body.dataset.characterSaveFix='1';
  document.addEventListener('click',e=>{
    if(!e.target.closest('#ss-record-save'))return;
    setTimeout(()=>{const back=document.querySelector('#ss-record-back');if(back)back.click();},0);
  });
}

function enhance(){
  styleFontOptions(document.querySelector('#ss-font'));
  document.querySelectorAll('#ss-pages .ss-page-content').forEach(installTabIndent);
  bindFormattingState(); addHeaderFooterControls(); installPagination(); closeCharacterEditorAfterSave();
}

const observer=new MutationObserver(enhance); observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',enhance); setTimeout(enhance,0); setInterval(()=>{if(editorPages())paginateAll();},900);
