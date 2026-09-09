/* ScriptSmith editor reliability fixes. Pagination is a single continuous document flow. */

const ssPages=()=>document.querySelector('#ss-pages');
const ssEditors=()=>[...document.querySelectorAll('#ss-pages .ss-page-content')];
const ssActiveEditor=()=>document.activeElement?.closest?.('.ss-page-content')||document.querySelector('#ss-pages .ss-page.active .ss-page-content')||ssEditors()[0]||null;
const ssHeaderValue=()=>document.querySelector('.ss-header-input')?.value||'';
const ssFooterValue=()=>document.querySelector('.ss-footer-input')?.value||'';

function ssInstallEditor(editor){
  if(!editor||editor.dataset.ssDirectFix==='1')return;
  editor.dataset.ssDirectFix='1';
  editor.addEventListener('focus',()=>{document.querySelectorAll('#ss-pages .ss-page').forEach(p=>p.classList.remove('active'));editor.closest('.ss-page')?.classList.add('active');});
  editor.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    e.preventDefault();e.stopImmediatePropagation();
    const s=window.getSelection();if(!s?.rangeCount)return;
    let node=s.anchorNode;if(node?.nodeType===Node.TEXT_NODE)node=node.parentElement;
    const block=node?.closest?.('p,h1,h2,h3,h4,h5,h6,blockquote,li,div')||editor;
    const current=parseFloat(block.style.textIndent||'0')||0;
    block.style.textIndent=`${Math.max(0,current+(e.shiftKey?-0.5:0.5))}in`;
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
  editor.addEventListener('input',()=>{editor.dispatchEvent(new CustomEvent('ss-document-input',{bubbles:true}));ssQueuePagination();});
}

function ssStyleFonts(){
  const select=document.querySelector('#ss-font');if(!select||select.dataset.ssFontsApplied==='1')return;
  const current=select.value||'Georgia';
  const groups={
    'Traditional Serif':['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Palatino','Palatino Linotype','Times New Roman'],
    'Literary Serif':['Cormorant Garamond','Libre Baskerville','Merriweather','Noto Serif','Source Serif 4','Rockwell'],
    'Modern Sans':['Aptos','Arial','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
    'Monospace':['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
    'Display & Character':['Arial Black','Copperplate','Franklin Gothic Medium','Impact','Nunito','Papyrus','Comic Sans MS','Segoe Print','Brush Script MT']
  };
  select.innerHTML='';
  for(const [group,fonts] of Object.entries(groups)){const og=document.createElement('optgroup');og.label=group;fonts.forEach(font=>{const o=document.createElement('option');o.value=font;o.textContent=font;o.style.fontFamily=`'${font.replace(/'/g,"\\'")}'`;og.appendChild(o);});select.appendChild(og);}
  select.value=[...select.options].some(o=>o.value===current)?current:'Georgia';select.dataset.ssFontsApplied='1';
  select.onchange=()=>{const editor=ssActiveEditor();if(!editor)return;editor.focus();document.execCommand('fontName',false,select.value);editor.dispatchEvent(new Event('input',{bubbles:true}));};
}

function ssAddHeaderFooterFields(){
  const group=[...document.querySelectorAll('#ss-ribbon .ss-ribbon-group')].find(g=>/Header\s*\/\s*Footer|Header.*Footer/i.test(g.textContent||''));
  if(!group||group.querySelector('.ss-header-footer-controls'))return;
  const controls=document.createElement('div');controls.className='ss-header-footer-controls';
  controls.innerHTML='<label>Header <input class="ss-header-input" type="text" placeholder="Type your header"></label><label>Footer <input class="ss-footer-input" type="text" placeholder="Type your footer"></label>';
  group.appendChild(controls);
  controls.querySelector('.ss-header-input').value=document.querySelector('#ss-pages .ss-paper-header')?.textContent||'';
  controls.querySelector('.ss-footer-input').value=document.querySelector('#ss-pages .ss-paper-footer')?.textContent?.replace(/^Page\s+\d+$/,'')||'';
  controls.addEventListener('input',e=>{if(e.target.classList.contains('ss-header-input'))document.querySelectorAll('#ss-pages .ss-paper-header').forEach(h=>h.textContent=e.target.value);if(e.target.classList.contains('ss-footer-input'))document.querySelectorAll('#ss-pages .ss-paper-footer').forEach(f=>f.textContent=e.target.value);});
}

function ssFormattingState(){['bold','italic','underline','strikeThrough'].forEach(cmd=>document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(b=>{let a=false;try{a=document.queryCommandState(cmd);}catch{}b.classList.toggle('active',a);b.setAttribute('aria-pressed',a?'true':'false');}));}
function ssBindFormatting(){if(document.body.dataset.ssFormattingFix==='1')return;document.body.dataset.ssFormattingFix='1';document.addEventListener('mousedown',e=>{if(e.target.closest?.('#ss-ribbon .ss-tool[data-cmd="bold"],#ss-ribbon .ss-tool[data-cmd="italic"],#ss-ribbon .ss-tool[data-cmd="underline"],#ss-ribbon .ss-tool[data-cmd="strikeThrough"]'))e.preventDefault();},true);document.addEventListener('selectionchange',ssFormattingState);document.addEventListener('keyup',ssFormattingState);document.addEventListener('mouseup',ssFormattingState);}

function ssMakePage(index){
  const pages=ssPages();if(!pages)return null;
  const page=document.createElement('article');page.className='ss-page';page.dataset.page=String(index);
  page.innerHTML='<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true" spellcheck="true"></div><div class="ss-paper-footer"></div>';
  pages.appendChild(page);page.querySelector('.ss-paper-header').textContent=ssHeaderValue();page.querySelector('.ss-paper-footer').textContent=ssFooterValue()||`Page ${index+1}`;ssInstallEditor(page.querySelector('.ss-page-content'));return page;
}

function ssEditorOf(node){return node?.nodeType===Node.TEXT_NODE?node.parentElement?.closest?.('.ss-page-content'):node?.closest?.('.ss-page-content');}
function ssOffsetInEditor(editor,node,offset){try{const r=document.createRange();r.setStart(editor,0);r.setEnd(node,offset);return r.toString().length;}catch{return 0;}}
function ssBookmark(){
  const root=ssPages(),s=window.getSelection();if(!root||!s?.rangeCount)return null;
  const r=s.getRangeAt(0),startEditor=ssEditorOf(r.startContainer),endEditor=ssEditorOf(r.endContainer);if(!startEditor||!endEditor)return null;
  const editors=ssEditors();let start=0,end=0;
  for(const ed of editors){if(ed===startEditor){start+=ssOffsetInEditor(ed,r.startContainer,r.startOffset);break;}start+=ed.textContent.length;}
  for(const ed of editors){if(ed===endEditor){end+=ssOffsetInEditor(ed,r.endContainer,r.endOffset);break;}end+=ed.textContent.length;}
  return {start,end,collapsed:r.collapsed};
}
function ssPoint(editor,offset){
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let left=Math.max(0,offset),n,last=null;
  while((n=walker.nextNode())){last=n;if(left<=n.nodeValue.length)return{node:n,offset:left};left-=n.nodeValue.length;}
  if(last)return{node:last,offset:last.nodeValue.length};
  return{node:editor,offset:editor.childNodes.length};
}
function ssRestoreBookmark(info){
  if(!info)return;const editors=ssEditors();if(!editors.length)return;
  const locate=offset=>{let left=Math.max(0,offset);for(let i=0;i<editors.length;i++){const len=editors[i].textContent.length;if(left<len||(left===len&&i===editors.length-1))return[editors[i],left];left-=len;}return[editors[editors.length-1],editors[editors.length-1].textContent.length];};
  const [se,so]=locate(info.start),[ee,eo]=locate(info.end);try{const a=ssPoint(se,so),b=ssPoint(ee,eo),r=document.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);const s=window.getSelection();s.removeAllRanges();s.addRange(r);se.focus({preventScroll:true});document.querySelectorAll('#ss-pages .ss-page').forEach(p=>p.classList.remove('active'));se.closest('.ss-page')?.classList.add('active');se.scrollIntoView({block:'nearest',inline:'nearest'});}catch{}}

function ssCloneFits(content,keep){
  const clone=content.cloneNode(true),rect=content.getBoundingClientRect();
  Object.assign(clone.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',width:`${rect.width}px`,height:`${content.clientHeight}px`,overflow:'hidden',columnCount:getComputedStyle(content).columnCount,columnGap:getComputedStyle(content).columnGap,font:getComputedStyle(content).font,lineHeight:getComputedStyle(content).lineHeight});
  document.body.appendChild(clone);
  const walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),nodes=[];let n;while((n=walker.nextNode()))nodes.push(n);
  let left=keep;
  for(const text of nodes){if(left>=text.nodeValue.length){left-=text.nodeValue.length;continue;}text.nodeValue=text.nodeValue.slice(0,Math.max(0,left));let sib=text.nextSibling;while(sib){const next=sib.nextSibling;sib.remove();sib=next;}let parent=text.parentNode;while(parent&&parent!==clone){let next=parent.nextSibling;while(next){const after=next.nextSibling;next.remove();next=after;}parent=parent.parentNode;}break;}
  const fits=clone.scrollHeight<=clone.clientHeight+2;clone.remove();return fits;
}

function ssSplitText(content,nextContent){
  const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT),nodes=[];let n;while((n=walker.nextNode()))if(n.nodeValue.length)nodes.push(n);
  const total=nodes.reduce((s,x)=>s+x.nodeValue.length,0);if(total<2)return false;
  let low=1,high=total-1,best=0;while(low<=high){const mid=Math.floor((low+high)/2);if(ssCloneFits(content,mid)){best=mid;low=mid+1;}else high=mid-1;}if(!best)return false;
  let cut=best,consumed=0;for(const text of nodes){if(consumed+text.nodeValue.length>=best){const local=best-consumed,prefix=text.nodeValue.slice(0,local),boundary=Math.max(prefix.lastIndexOf(' '),prefix.lastIndexOf('\n'),prefix.lastIndexOf('\t'));if(boundary>20)cut=consumed+boundary+1;break;}consumed+=text.nodeValue.length;}
  let pos=0,cutNode=null,cutOffset=0;for(const text of nodes){if(pos+text.nodeValue.length>=cut){cutNode=text;cutOffset=cut-pos;break;}pos+=text.nodeValue.length;}if(!cutNode||cutOffset<=0||cutOffset>=cutNode.nodeValue.length)return false;
  const range=document.createRange();range.setStart(cutNode,cutOffset);range.setEnd(content,content.childNodes.length);const fragment=range.extractContents();if(!fragment.textContent?.length)return false;nextContent.appendChild(fragment);return true;
}

function ssSplitPage(page){
  const content=page.querySelector('.ss-page-content');if(!content||content.scrollHeight<=content.clientHeight+2)return false;
  const root=ssPages(),list=[...root.querySelectorAll('.ss-page')],index=list.indexOf(page),next=list[index+1]||ssMakePage(index+1);if(!next)return false;
  const nextContent=next.querySelector('.ss-page-content');let changed=false;
  while(content.scrollHeight>content.clientHeight+2&&content.children.length>1){nextContent.insertBefore(content.lastElementChild,nextContent.firstChild);changed=true;}
  if(content.scrollHeight>content.clientHeight+2)changed=ssSplitText(content,nextContent)||changed;
  return changed;
}
function ssReflowForward(){const root=ssPages();if(!root)return false;let changed=false;const pages=[...root.querySelectorAll('.ss-page')];for(const page of pages){if(ssSplitPage(page))changed=true;}return changed;}
function ssCleanupEmptyPages(){const pages=[...document.querySelectorAll('#ss-pages .ss-page')];if(pages.length<=1)return false;let changed=false;for(let i=pages.length-1;i>0;i--){const content=pages[i].querySelector('.ss-page-content');if(content&&!content.textContent.trim()&&!content.querySelector('img,table,.scriptsmith-page-break,.scriptsmith-section-break')){pages[i].remove();changed=true;}}return changed;}

let ssPaginationQueued=false,ssPaginationRunning=false;
function ssQueuePagination(){if(ssPaginationQueued)return;ssPaginationQueued=true;requestAnimationFrame(()=>{ssPaginationQueued=false;ssPaginate();});}
function ssPaginate(){
  if(ssPaginationRunning)return;const root=ssPages();if(!root)return;ssPaginationRunning=true;
  try{
    const bookmark=ssBookmark();
    ssEditors().forEach(ssInstallEditor);
    let changed=true,passes=0;while(changed&&passes++<250){changed=false;if(ssReflowForward())changed=true;if(ssCleanupEmptyPages())changed=true;}
    const pages=[...root.querySelectorAll('.ss-page')];pages.forEach((page,i)=>{page.dataset.page=String(i);const h=page.querySelector('.ss-paper-header'),f=page.querySelector('.ss-paper-footer');if(h)h.textContent=ssHeaderValue();if(f)f.textContent=ssFooterValue()||`Page ${i+1}`;});
    const counter=document.querySelector('#ss-page-count');if(counter)counter.textContent=`${pages.length} ${pages.length===1?'page':'pages'}`;
    if(bookmark&&changed)requestAnimationFrame(()=>ssRestoreBookmark(bookmark));
  }finally{ssPaginationRunning=false;}
}
function ssInstallPagination(){
  const pages=ssPages();if(!pages||pages.dataset.ssPaginationFix==='1')return;pages.dataset.ssPaginationFix='1';
  pages.addEventListener('input',ssQueuePagination);pages.addEventListener('paste',()=>requestAnimationFrame(ssQueuePagination));pages.addEventListener('drop',()=>requestAnimationFrame(ssQueuePagination));
  ssEditors().forEach(ssInstallEditor);requestAnimationFrame(ssPaginate);
}
function ssCloseCharacterAfterSave(){if(document.body.dataset.ssCloseCharacterHook==='1')return;document.body.dataset.ssCloseCharacterHook='1';document.addEventListener('click',e=>{const save=e.target.closest?.('[data-action="save-record"]');if(save)setTimeout(()=>save.closest('.ss-modal')?.querySelector('[data-action="close-modal"]')?.click(),0);});}
function ssEnhance(){ssInstallPagination();ssStyleFonts();ssAddHeaderFooterFields();ssBindFormatting();ssCloseCharacterAfterSave();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ssEnhance,{once:true});else ssEnhance();
window.addEventListener('load',ssEnhance,{once:true});
const ssWatcher=new MutationObserver(()=>ssEnhance());ssWatcher.observe(document.documentElement,{childList:true,subtree:true});
