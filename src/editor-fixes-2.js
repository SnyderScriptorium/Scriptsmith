/* ScriptSmith editor reliability fixes. Single pagination engine with stable caret flow. */

const ssPages = () => document.querySelector('#ss-pages');
const ssEditors = () => [...document.querySelectorAll('#ss-pages .ss-page-content')];
const ssActiveEditor = () => document.activeElement?.closest?.('.ss-page-content') || document.querySelector('#ss-pages .ss-page.active .ss-page-content') || ssEditors()[0] || null;
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
    e.preventDefault(); e.stopImmediatePropagation();
    const sel = window.getSelection(); if (!sel?.rangeCount) return;
    let node = sel.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node?.closest?.('p,h1,h2,h3,h4,h5,h6,blockquote,li,div') || editor;
    const current = parseFloat(block.style.textIndent || '0') || 0;
    block.style.textIndent = `${Math.max(0, current + (e.shiftKey ? -0.5 : 0.5))}in`;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  editor.addEventListener('input', ssQueuePagination);
}

function ssStyleFonts() {
  const select = document.querySelector('#ss-font');
  if (!select || select.dataset.ssFontsApplied === '1') return;
  const current = select.value || 'Georgia';
  const groups = {
    'Traditional Serif':['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Palatino','Palatino Linotype','Times New Roman'],
    'Literary Serif':['Cormorant Garamond','Libre Baskerville','Merriweather','Noto Serif','Source Serif 4','Rockwell'],
    'Modern Sans':['Aptos','Arial','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
    'Monospace':['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
    'Display & Character':['Arial Black','Copperplate','Franklin Gothic Medium','Impact','Nunito','Papyrus','Comic Sans MS','Segoe Print','Brush Script MT']
  };
  select.innerHTML='';
  for (const [group,fonts] of Object.entries(groups)) {
    const optgroup=document.createElement('optgroup'); optgroup.label=group;
    fonts.forEach(font=>{const o=document.createElement('option');o.value=font;o.textContent=font;o.style.fontFamily=`'${font.replace(/'/g,"\\'")}'`;optgroup.appendChild(o);});
    select.appendChild(optgroup);
  }
  select.value=[...select.options].some(o=>o.value===current)?current:'Georgia';
  select.dataset.ssFontsApplied='1';
  select.onchange=()=>{const editor=ssActiveEditor();if(!editor)return;editor.focus();document.execCommand('fontName',false,select.value);editor.dispatchEvent(new Event('input',{bubbles:true}));};
}

function ssAddHeaderFooterFields() {
  const group=[...document.querySelectorAll('#ss-ribbon .ss-ribbon-group')].find(g=>/Header\s*\/\s*Footer|Header.*Footer/i.test(g.textContent||''));
  if(!group||group.querySelector('.ss-header-footer-controls'))return;
  const controls=document.createElement('div');controls.className='ss-header-footer-controls';
  controls.innerHTML='<label>Header <input class="ss-header-input" type="text" placeholder="Type your header"></label><label>Footer <input class="ss-footer-input" type="text" placeholder="Type your footer"></label>';
  group.appendChild(controls);
  controls.querySelector('.ss-header-input').value=document.querySelector('#ss-pages .ss-paper-header')?.textContent||'';
  controls.querySelector('.ss-footer-input').value=document.querySelector('#ss-pages .ss-paper-footer')?.textContent?.replace(/^Page\s+\d+$/,'')||'';
  controls.addEventListener('input',e=>{if(e.target.classList.contains('ss-header-input'))document.querySelectorAll('#ss-pages .ss-paper-header').forEach(h=>h.textContent=e.target.value);if(e.target.classList.contains('ss-footer-input'))document.querySelectorAll('#ss-pages .ss-paper-footer').forEach(f=>f.textContent=e.target.value);});
}

function ssFormattingState(){['bold','italic','underline','strikeThrough'].forEach(cmd=>document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(button=>{let active=false;try{active=document.queryCommandState(cmd);}catch{}button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');}));}
function ssBindFormatting(){if(document.body.dataset.ssFormattingFix==='1')return;document.body.dataset.ssFormattingFix='1';document.addEventListener('mousedown',e=>{if(e.target.closest?.('#ss-ribbon .ss-tool[data-cmd="bold"],#ss-ribbon .ss-tool[data-cmd="italic"],#ss-ribbon .ss-tool[data-cmd="underline"],#ss-ribbon .ss-tool[data-cmd="strikeThrough"]'))e.preventDefault();},true);document.addEventListener('selectionchange',ssFormattingState);document.addEventListener('keyup',ssFormattingState);document.addEventListener('mouseup',ssFormattingState);}

function ssMakePage(index){const pages=ssPages();if(!pages)return null;const page=document.createElement('article');page.className='ss-page';page.dataset.page=String(index);page.innerHTML='<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true" spellcheck="true"></div><div class="ss-paper-footer"></div>';pages.appendChild(page);page.querySelector('.ss-paper-header').textContent=ssHeaderValue();page.querySelector('.ss-paper-footer').textContent=ssFooterValue()||`Page ${index+1}`;ssInstallEditor(page.querySelector('.ss-page-content'));return page;}

function ssSelectionInfo(){
  const root=ssPages(),sel=window.getSelection();
  if(!root||!sel?.rangeCount)return null;
  const range=sel.getRangeAt(0);
  const startEditor=range.startContainer.nodeType===Node.TEXT_NODE?range.startContainer.parentElement?.closest('.ss-page-content'):range.startContainer.closest?.('.ss-page-content');
  const endEditor=range.endContainer.nodeType===Node.TEXT_NODE?range.endContainer.parentElement?.closest('.ss-page-content'):range.endContainer.closest?.('.ss-page-content');
  if(!startEditor||!endEditor)return null;
  const all=ssEditors();let start=0,end=0;
  for(const editor of all){
    if(editor===startEditor)start+=ssTextOffset(editor,range.startContainer,range.startOffset);
    else if(editor.compareDocumentPosition(startEditor)&Node.DOCUMENT_POSITION_FOLLOWING)start+=editor.textContent.length;
    if(editor===endEditor){end+=ssTextOffset(editor,range.endContainer,range.endOffset);break;}
    end+=editor.textContent.length;
  }
  return {start,end,collapsed:range.collapsed};
}
function ssTextOffset(root,node,offset){try{const r=document.createRange();r.setStart(root,0);r.setEnd(node,offset);return r.toString().length;}catch{return 0;}}
function ssPoint(root,offset){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let left=Math.max(0,offset),n;while((n=walker.nextNode())){if(left<=n.nodeValue.length)return{node:n,offset:left};left-=n.nodeValue.length;}return{node:root,offset:root.childNodes.length};}
function ssRestore(info){if(!info)return;const all=ssEditors();let sr=info.start,er=info.end,se=all[all.length-1],ee=se;for(let i=0;i<all.length;i++){const len=all[i].textContent.length;if(sr<len||(sr===len&&i===all.length-1)){se=all[i];break;}sr-=len;}for(let i=0;i<all.length;i++){const len=all[i].textContent.length;if(er<len||(er===len&&i===all.length-1)){ee=all[i];break;}er-=len;}try{const a=ssPoint(se,sr),b=ssPoint(ee,er),r=document.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);const s=window.getSelection();s.removeAllRanges();s.addRange(r);se.focus({preventScroll:true});document.querySelectorAll('#ss-pages .ss-page').forEach(p=>p.classList.remove('active'));se.closest('.ss-page')?.classList.add('active');}catch{}}

function ssCloneFits(content,keep){
  const clone=content.cloneNode(true);Object.assign(clone.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',width:`${content.getBoundingClientRect().width}px`,height:`${content.clientHeight}px`,overflow:'hidden'});document.body.appendChild(clone);
  const walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),nodes=[];let n;while((n=walker.nextNode()))nodes.push(n);
  let left=keep;
  for(const text of nodes){if(left>=text.nodeValue.length){left-=text.nodeValue.length;continue;}text.nodeValue=text.nodeValue.slice(0,Math.max(0,left));let sib=text.nextSibling;while(sib){const next=sib.nextSibling;sib.remove();sib=next;}let parent=text.parentNode;while(parent&&parent!==clone){let next=parent.nextSibling;while(next){const after=next.nextSibling;next.remove();next=after;}parent=parent.parentNode;}break;}
  const fits=clone.scrollHeight<=clone.clientHeight+2;clone.remove();return fits;
}

function ssSplitLongText(content,nextContent){
  const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT),nodes=[];let n;while((n=walker.nextNode()))if(n.nodeValue.length)nodes.push(n);
  const total=nodes.reduce((s,x)=>s+x.nodeValue.length,0);if(total<2)return false;
  let low=1,high=total-1,best=0;while(low<=high){const mid=Math.floor((low+high)/2);if(ssCloneFits(content,mid)){best=mid;low=mid+1;}else high=mid-1;}if(!best)return false;
  let cut=best,consumed=0;for(const text of nodes){if(consumed+text.nodeValue.length>=best){const local=best-consumed,prefix=text.nodeValue.slice(0,local),boundary=Math.max(prefix.lastIndexOf(' '),prefix.lastIndexOf('\n'),prefix.lastIndexOf('\t'));if(boundary>20)cut=consumed+boundary+1;break;}consumed+=text.nodeValue.length;}
  let pos=0,cutNode=null,cutOffset=0;for(const text of nodes){if(pos+text.nodeValue.length>=cut){cutNode=text;cutOffset=cut-pos;break;}pos+=text.nodeValue.length;}if(!cutNode||cutOffset<=0||cutOffset>=cutNode.nodeValue.length)return false;
  const range=document.createRange();range.setStart(cutNode,cutOffset);range.setEnd(content,content.childNodes.length);const fragment=range.extractContents();if(!fragment.textContent?.length)return false;nextContent.appendChild(fragment);return true;
}

function ssSplitPage(page){
  const content=page.querySelector('.ss-page-content');if(!content||content.scrollHeight<=content.clientHeight+2)return false;
  const root=ssPages(),list=[...root.querySelectorAll('.ss-page')],index=list.indexOf(page),next=list[index+1]||ssMakePage(index+1);if(!next)return false;const nextContent=next.querySelector('.ss-page-content');let changed=false;
  while(content.scrollHeight>content.clientHeight+2&&content.children.length>1){nextContent.insertBefore(content.lastElementChild,nextContent.firstChild);changed=true;}
  if(content.scrollHeight>content.clientHeight+2)changed=ssSplitLongText(content,nextContent)||changed;
  return changed;
}

let ssPaginationQueued=false,ssPaginationRunning=false;
function ssQueuePagination(){if(ssPaginationQueued)return;ssPaginationQueued=true;requestAnimationFrame(()=>{ssPaginationQueued=false;ssPaginate();});}
function ssPaginate(){
  if(ssPaginationRunning)return;const root=ssPages();if(!root)return;ssPaginationRunning=true;
  try{
    const sel=window.getSelection();const range=sel?.rangeCount?sel.getRangeAt(0):null;const inEditor=range&&(range.startContainer.nodeType===Node.TEXT_NODE?range.startContainer.parentElement?.closest('.ss-page-content'):range.startContainer.closest?.('.ss-page-content'));const bookmark=inEditor?ssSelectionInfo():null;
    ssEditors().forEach(ssInstallEditor);let changed=true,passes=0;while(changed&&passes++<250){changed=false;for(const page of [...root.querySelectorAll('.ss-page')])if(ssSplitPage(page))changed=true;}
    const pages=[...root.querySelectorAll('.ss-page')];pages.forEach((page,i)=>{page.dataset.page=String(i);const h=page.querySelector('.ss-paper-header'),f=page.querySelector('.ss-paper-footer');if(h)h.textContent=ssHeaderValue();if(f)f.textContent=ssFooterValue()||`Page ${i+1}`;});
    const counter=document.querySelector('#ss-page-count');if(counter)counter.textContent=`${pages.length} ${pages.length===1?'page':'pages'}`;
    const now=window.getSelection(),still=now?.rangeCount&&(now.getRangeAt(0).startContainer.nodeType===Node.TEXT_NODE?now.getRangeAt(0).startContainer.parentElement?.closest('.ss-page-content'):now.getRangeAt(0).startContainer.closest?.('.ss-page-content'));if(bookmark&&!still)ssRestore(bookmark);
  }finally{ssPaginationRunning=false;}
}

function ssInstallPagination(){const pages=ssPages();if(!pages||pages.dataset.ssPaginationFix==='1')return;pages.dataset.ssPaginationFix='1';pages.addEventListener('input',ssQueuePagination);pages.addEventListener('paste',()=>requestAnimationFrame(ssQueuePagination));pages.addEventListener('drop',()=>requestAnimationFrame(ssQueuePagination));ssEditors().forEach(ssInstallEditor);requestAnimationFrame(ssPaginate);}

function ssCloseCharacterAfterSave(){if(document.body.dataset.ssCloseCharacterHook==='1')return;document.body.dataset.ssCloseCharacterHook='1';document.addEventListener('click',e=>{const save=e.target.closest?.('[data-action="save-record"]');if(save)setTimeout(()=>{const close=save.closest('.ss-modal')?.querySelector('[data-action="close-modal"]');close?.click();},0);});}
function ssEnhance(){ssInstallPagination();ssStyleFonts();ssAddHeaderFooterFields();ssBindFormatting();ssCloseCharacterAfterSave();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ssEnhance,{once:true});else ssEnhance();
window.addEventListener('load',ssEnhance,{once:true});
const ssWatcher=new MutationObserver(()=>{ssEnhance();});
ssWatcher.observe(document.documentElement,{childList:true,subtree:true});
