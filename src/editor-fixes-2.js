/* ScriptSmith editor integration.
 * Pagination is handled here as one coherent flow: each visible paper is a fixed
 * page, and overflow is moved to the next paper without CSS columns or text loss.
 */

const ssPages = () => document.querySelector('#ss-pages');
const ssEditors = () => [...document.querySelectorAll('#ss-pages .ss-page-content')];
let ssLastActiveEditor = null;
let ssPaginating = false;
const ssActiveEditor = () => ssLastActiveEditor?.isConnected ? ssLastActiveEditor : document.querySelector('#ss-pages .ss-page.active .ss-page-content') || ssEditors()[0] || null;
const ssHeaderValue = () => document.querySelector('.ss-header-input')?.value || '';
const ssFooterValue = () => document.querySelector('.ss-footer-input')?.value || '';

function ssActivateEditor(editor){
  if(!editor)return;
  ssLastActiveEditor=editor;
  document.querySelectorAll('#ss-pages .ss-page').forEach(p=>p.classList.toggle('active',p.contains(editor)));
}

function ssInstallEditor(editor){
  if(!editor||editor.dataset.ssDirectFix==='1')return;
  editor.dataset.ssDirectFix='1';
  const activate=()=>ssActivateEditor(editor);
  editor.addEventListener('focus',activate,true);
  editor.addEventListener('mousedown',activate,true);
  editor.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    e.preventDefault();e.stopImmediatePropagation();activate();
    const sel=window.getSelection();if(!sel?.rangeCount)return;
    let node=sel.anchorNode;if(node?.nodeType===Node.TEXT_NODE)node=node.parentElement;
    const block=node?.closest?.('p,h1,h2,h3,h4,h5,h6,blockquote,li,div')||editor;
    const current=parseFloat(block.style.textIndent||'0')||0;
    const delta=e.shiftKey?-0.5:0.5;
    block.style.textIndent=`${Math.max(0,current+delta)}in`;
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
  editor.addEventListener('input',()=>requestAnimationFrame(ssPaginate),false);
  editor.addEventListener('paste',()=>requestAnimationFrame(ssPaginate),false);
}

function ssStyleFonts(){
  const select=document.querySelector('#ss-font');
  if(!select||select.dataset.ssFontsApplied==='1')return;
  const current=select.value||'Georgia';
  const groups={
    'Traditional Serif':['Baskerville','Bodoni 72','Book Antiqua','Bookman','Cambria','Century Schoolbook','Constantia','Didot','EB Garamond','Garamond','Georgia','Hoefler Text','Palatino','Palatino Linotype','Times New Roman'],
    'Literary Serif':['Cormorant Garamond','Libre Baskerville','Merriweather','Noto Serif','Source Serif 4','Rockwell'],
    'Modern Sans':['Aptos','Arial','Calibri','Century Gothic','Futura','Gill Sans','Helvetica','Helvetica Neue','Inter','Lato','Montserrat','Open Sans','Optima','Poppins','Raleway','Roboto','Segoe UI','Source Sans 3','Tahoma','Trebuchet MS','Verdana'],
    'Monospace':['Consolas','Courier New','Lucida Console','Menlo','Monaco'],
    'Display & Character':['Arial Black','Copperplate','Franklin Gothic Medium','Impact','Nunito','Papyrus','Comic Sans MS','Segoe Print','Brush Script MT']
  };
  select.innerHTML='';
  for(const[group,fonts]of Object.entries(groups)){
    const optgroup=document.createElement('optgroup');optgroup.label=group;
    fonts.forEach(font=>{const option=document.createElement('option');option.value=font;option.textContent=font;option.style.fontFamily=`'${font.replace(/'/g,"\\'")}'`;optgroup.appendChild(option);});
    select.appendChild(optgroup);
  }
  select.value=[...select.options].some(o=>o.value===current)?current:'Georgia';
  select.dataset.ssFontsApplied='1';
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
  controls.addEventListener('input',e=>{
    if(e.target.classList.contains('ss-header-input'))document.querySelectorAll('#ss-pages .ss-paper-header').forEach(h=>h.textContent=e.target.value);
    if(e.target.classList.contains('ss-footer-input'))document.querySelectorAll('#ss-pages .ss-paper-footer').forEach(f=>f.textContent=e.target.value);
  });
}

function ssFormattingState(){
  ['bold','italic','underline','strikeThrough'].forEach(cmd=>document.querySelectorAll(`#ss-ribbon .ss-tool[data-cmd="${cmd}"]`).forEach(button=>{let active=false;try{active=document.queryCommandState(cmd);}catch{}button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');}));
}
function ssBindFormatting(){
  if(document.body.dataset.ssFormattingFix==='1')return;
  document.body.dataset.ssFormattingFix='1';
  document.addEventListener('mousedown',e=>{if(e.target.closest?.('#ss-ribbon .ss-tool[data-cmd="bold"],#ss-ribbon .ss-tool[data-cmd="italic"],#ss-ribbon .ss-tool[data-cmd="underline"],#ss-ribbon .ss-tool[data-cmd="strikeThrough"]'))e.preventDefault();},true);
  document.addEventListener('selectionchange',ssFormattingState);document.addEventListener('keyup',ssFormattingState);document.addEventListener('mouseup',ssFormattingState);
}

function ssMakePage(index){
  const pages=ssPages();if(!pages)return null;
  const page=document.createElement('article');page.className='ss-page';page.dataset.page=String(index);
  page.innerHTML='<div class="ss-paper-header"></div><div class="ss-page-content" contenteditable="true" spellcheck="true"></div><div class="ss-paper-footer"></div>';
  pages.appendChild(page);
  page.querySelector('.ss-paper-header').textContent=ssHeaderValue();page.querySelector('.ss-paper-footer').textContent=ssFooterValue();
  ssInstallEditor(page.querySelector('.ss-page-content'));return page;
}

function ssCaretBookmark(){
  const sel=window.getSelection();if(!sel?.rangeCount)return null;
  const range=sel.getRangeAt(0);let node=range.commonAncestorContainer;if(node.nodeType===Node.TEXT_NODE)node=node.parentElement;
  const editor=node?.closest?.('.ss-page-content');if(!editor)return null;
  const before=range.cloneRange();before.selectNodeContents(editor);before.setEnd(range.startContainer,range.startOffset);
  const local=before.toString().length;
  const pageIndex=ssEditors().indexOf(editor);
  return {pageIndex:Math.max(0,pageIndex),offset:local};
}
function ssRestoreCaret(bookmark){
  if(!bookmark)return;
  const editors=ssEditors();let remaining=bookmark.offset;let editor=editors[Math.min(bookmark.pageIndex,Math.max(0,editors.length-1))]||editors[0];
  if(!editor)return;
  for(let i=0;i<editors.length;i++){
    const e=editors[i],len=e.innerText.length;
    if(i<bookmark.pageIndex)continue;
    if(i===bookmark.pageIndex||remaining<=len){editor=e;break;}
    remaining-=len;editor=editors[Math.min(i+1,editors.length-1)];
  }
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let n;let left=remaining;let last=null;
  while((n=walker.nextNode())){last=n;if(left<=n.nodeValue.length)break;left-=n.nodeValue.length;}
  const range=document.createRange();
  if(last){range.setStart(last,Math.max(0,Math.min(left,last.nodeValue.length)));range.collapse(true);}else{range.selectNodeContents(editor);range.collapse(false);}
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);ssActivateEditor(editor);
}

function ssClonePrefix(content,keepLength){
  const clone=content.cloneNode(true);
  clone.style.position='fixed';clone.style.left='-100000px';clone.style.top='0';clone.style.visibility='hidden';
  clone.style.width=`${Math.max(1,content.clientWidth)}px`;clone.style.height=`${Math.max(1,content.clientHeight)}px`;clone.style.overflow='hidden';
  document.body.appendChild(clone);
  const walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT);const nodes=[];let n;
  while((n=walker.nextNode()))nodes.push(n);
  let remaining=Math.max(0,keepLength);let cutNode=null;let cutOffset=0;
  for(const text of nodes){if(remaining>=text.nodeValue.length){remaining-=text.nodeValue.length;continue;}cutNode=text;cutOffset=remaining;break;}
  if(cutNode){const range=document.createRange();range.setStart(cutNode,cutOffset);range.setEnd(clone,clone.childNodes.length);range.deleteContents();}
  else if(keepLength<=0)clone.innerHTML='';
  return clone;
}
function ssCloneFits(content,keepLength){const clone=ssClonePrefix(content,keepLength);const fits=clone.scrollHeight<=clone.clientHeight+2;clone.remove();return fits;}

function ssSplitLongText(content,nextContent){
  const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);const nodes=[];let n;
  while((n=walker.nextNode()))if(n.nodeValue.length)nodes.push(n);
  if(!nodes.length)return false;
  const total=nodes.reduce((sum,x)=>sum+x.nodeValue.length,0);if(total<2)return false;
  let low=1,high=total-1,best=0;
  while(low<=high){const mid=Math.floor((low+high)/2);if(ssCloneFits(content,mid)){best=mid;low=mid+1;}else high=mid-1;}
  if(!best)return false;
  let cut=best,consumed=0;
  for(const text of nodes){if(consumed+text.nodeValue.length>=best){const local=best-consumed;const before=text.nodeValue.slice(0,local);const boundary=Math.max(before.lastIndexOf(' '),before.lastIndexOf('\n'),before.lastIndexOf('\t'));if(boundary>20)cut=consumed+boundary+1;break;}consumed+=text.nodeValue.length;}
  let pos=0,cutNode=null,cutOffset=0;
  for(const text of nodes){if(pos+text.nodeValue.length>=cut){cutNode=text;cutOffset=cut-pos;break;}pos+=text.nodeValue.length;}
  if(!cutNode||cutOffset<=0||cutOffset>=cutNode.nodeValue.length)return false;
  const range=document.createRange();range.setStart(cutNode,cutOffset);range.setEnd(content,content.childNodes.length);
  const fragment=range.extractContents();if(!fragment.textContent&&!fragment.querySelector?.('*'))return false;
  nextContent.insertBefore(fragment,nextContent.firstChild);return true;
}

function ssSplitPage(page){
  const content=page.querySelector('.ss-page-content');if(!content)return false;
  const overflows=content.scrollHeight>content.clientHeight+2;
  if(!overflows)return false;
  const pages=ssPages();const all=[...pages.querySelectorAll('.ss-page')];const index=all.indexOf(page);const next=all[index+1]||ssMakePage(index+1);if(!next)return false;
  const nextContent=next.querySelector('.ss-page-content');if(!nextContent)return false;
  let changed=false;
  while(content.scrollHeight>content.clientHeight+2){
    const last=content.lastElementChild;
    if(last){nextContent.insertBefore(last,nextContent.firstChild);changed=true;continue;}
    if(ssSplitLongText(content,nextContent))changed=true;else break;
  }
  if(content.scrollHeight>content.clientHeight+2&&ssSplitLongText(content,nextContent))changed=true;
  return changed;
}

function ssPullBackContent(){
  const pages=ssPages();if(!pages)return false;let changed=false;const all=[...pages.querySelectorAll('.ss-page')];
  for(let i=1;i<all.length;i++){
    const prev=all[i-1]?.querySelector('.ss-page-content'),cur=all[i]?.querySelector('.ss-page-content');if(!prev||!cur)continue;
    while(cur.firstChild){const node=cur.firstChild;prev.appendChild(node);if(prev.scrollHeight>prev.clientHeight+2){prev.removeChild(node);break;}changed=true;}
  }
  return changed;
}

function ssPaginate(){
  if(ssPaginating)return;const pages=ssPages();if(!pages)return;ssPaginating=true;
  const bookmark=ssCaretBookmark();
  try{
    ssEditors().forEach(ssInstallEditor);
    let guard=0,changed=true;
    while(changed&&guard++<100){changed=false;for(const page of [...pages.querySelectorAll('.ss-page')])if(ssSplitPage(page))changed=true;}
    // Reflow only when a page has genuinely become short; never delete the page holding the caret.
    ssPullBackContent();
    pages.querySelectorAll('.ss-page').forEach((page,i)=>{page.dataset.page=String(i);const footer=page.querySelector('.ss-paper-footer');if(footer&&!ssFooterValue())footer.textContent=`Page ${i+1}`;});
    const count=pages.querySelectorAll('.ss-page').length||1;const counter=document.querySelector('#ss-page-count');if(counter)counter.textContent=`${count} ${count===1?'page':'pages'}`;
  }finally{ssPaginating=false;}
  ssRestoreCaret(bookmark);
  requestAnimationFrame(()=>{
    const sel=window.getSelection();if(!sel?.rangeCount)return;const rect=sel.getRangeAt(0).getBoundingClientRect();const scroller=document.querySelector('.ss-editor-scroll');if(!scroller)return;const view=scroller.getBoundingClientRect();if(rect.bottom>view.bottom-24)scroller.scrollTop+=rect.bottom-(view.bottom-24);else if(rect.top<view.top+24)scroller.scrollTop-=view.top+24-rect.top;
  });
}

function ssInstallPagination(){
  const pages=ssPages();if(!pages||pages.dataset.ssPaginationFix==='1')return;pages.dataset.ssPaginationFix='1';requestAnimationFrame(ssPaginate);
}
function ssCloseCharacterAfterSave(){
  if(document.body.dataset.ssCloseCharacterHook==='1')return;document.body.dataset.ssCloseCharacterHook='1';
  document.addEventListener('click',e=>{const save=e.target.closest?.('#ss-record-save');if(save)setTimeout(()=>document.querySelector('#ss-record-back')?.click(),0);},true);
}
function ssEnhance(){ssStyleFonts();ssEditors().forEach(ssInstallEditor);ssAddHeaderFooterFields();ssBindFormatting();ssInstallPagination();}
ssCloseCharacterAfterSave();
let ssEnhanceQueued=false;
const ssEnhanceQueuedRun=()=>{if(ssEnhanceQueued)return;ssEnhanceQueued=true;requestAnimationFrame(()=>{ssEnhanceQueued=false;ssEnhance();});};
new MutationObserver(ssEnhanceQueuedRun).observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',ssEnhance);setTimeout(ssEnhance,50);
