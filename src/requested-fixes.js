import { getCurrentDocument, updateDocumentContent } from './document.js';
import { saveProject } from './filesystem.js';
import { getSettings, updateSettings } from '../settings.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function notify(message){const n=document.createElement('div');n.className='ss-toast';n.textContent=message;document.body.appendChild(n);setTimeout(()=>n.remove(),2400);}

function addOtherTemplate(){
  const grid=document.querySelector('#templates'); if(!grid||grid.querySelector('[data-template="other"]'))return;
  const b=document.createElement('button'); b.className='template-card theme-card'; b.dataset.template='other';
  b.innerHTML='<strong>Other</strong><span>Essays, articles, notes, nonfiction, and other writing</span>';
  b.onclick=()=>{document.querySelector('[data-template="other"]')?.removeEventListener('click',()=>{}); startOther();};
  grid.appendChild(b);
}
function startOther(){
  const home=document.querySelector('#home'), collection=document.querySelector('#collection-shell');
  if(!home||!collection)return;
  home.hidden=true; collection.hidden=false;
  collection.innerHTML='<header class="topbar"><div class="brand"><button id="ss-other-home" class="home-button theme-button">‹ Library</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Other Writing</small></div></div><div class="top-actions"><button id="ss-other-new" class="primary-action">+ New Other Writing</button></div></header><main class="collection-page"><div class="collection-heading"><h1>Other Writing</h1><p>Essays, articles, notes, nonfiction, journals, and anything that does not belong in a story category.</p></div><div id="ss-other-list" class="library-grid"></div></main>';
  document.querySelector('#ss-other-home').onclick=()=>{collection.hidden=true;home.hidden=false;};
  document.querySelector('#ss-other-new').onclick=()=>startOtherEditor();
}
function startOtherEditor(){
  const collection=document.querySelector('#collection-shell'), editor=document.querySelector('#editor-shell'); if(!editor)return;
  collection.hidden=true; editor.hidden=false;
  editor.innerHTML='<header class="topbar"><div class="brand"><button id="ss-other-back" class="home-button theme-button">‹ Library</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Other Writing</small></div></div><div class="top-actions"><button id="ss-other-save" class="primary-action">Save</button></div></header><main class="workspace"><section class="editor-area ss-other-editor-area"><div class="toolbar"></div><article id="ss-other-editor" class="page" contenteditable="true" spellcheck="true"></article><footer class="statusbar"><span>Other Writing</span><span id="ss-other-stats">0 words</span></footer></section></main>';
  const e=document.querySelector('#ss-other-editor'); const d=getCurrentDocument(); d.type='other'; d.title='Untitled Other Writing'; e.addEventListener('keydown',tabIndent); e.addEventListener('input',()=>{updateDocumentContent(e.innerHTML);const text=e.innerText.trim();document.querySelector('#ss-other-stats').textContent=`${text?text.split(/\s+/).length:0} words`;});
  document.querySelector('#ss-other-save').onclick=async()=>{updateDocumentContent(e.innerHTML);await saveProject(d,false);notify('Saved to ScriptSmith Library under Other Writing');};
  document.querySelector('#ss-other-back').onclick=()=>{editor.hidden=true;document.querySelector('#home').hidden=false;};
}
function tabIndent(e){if(e.key!=='Tab')return;e.preventDefault();document.execCommand('insertText',false,'\t');}

function installTabIndent(){
 document.addEventListener('keydown',e=>{if(e.key==='Tab'&&e.target.closest('[contenteditable="true"]'))tabIndent(e);},true);
}

function addStructureTabs(){
 const p=document.querySelector('#workspace-panel'); if(!p||!document.querySelector('.side-button[data-view="manuscript"].active'))return;
 if(p.querySelector('.ss-requested-structure'))return;
 const d=getCurrentDocument(); d.metadata=d.metadata||{}; d.metadata.chapters=Array.isArray(d.metadata.chapters)?d.metadata.chapters:[];
 const ensure=(title,type)=>{let c=d.metadata.chapters.find(x=>x.type===type);if(!c){c={id:crypto.randomUUID(),title,content:'',type};d.metadata.chapters.unshift(c);}return c;};
 const toc=ensure('Table of Contents','toc'), pro=ensure('Prologue','prologue'), epi=ensure('Epilogue','epilogue');
 const bar=document.createElement('div');bar.className='ss-requested-structure';bar.innerHTML=[['toc','Table of Contents',toc],['prologue','Prologue',pro],['epilogue','Epilogue',epi]].map(([t,l,c])=>`<button class="theme-button" data-ss-structure="${c.id}">${l}</button>`).join('');p.prepend(bar);
 bar.querySelectorAll('[data-ss-structure]').forEach(b=>b.onclick=()=>{const c=d.metadata.chapters.find(x=>x.id===b.dataset.ssStructure);if(!c)return;const existing=[...p.querySelectorAll('[data-open-chapter]')].find(x=>x.dataset.openChapter===c.id);if(existing)existing.click();else notify(`${c.title} is ready in the manuscript structure.`);});
}

function improveAutosave(){
 let timer=null;
 const run=()=>{const s=getSettings();if(timer)clearInterval(timer);if(!s.autosave)return;const ms=Math.max(1000,Number(s.autosaveIntervalMs)||30000);timer=setInterval(async()=>{const e=document.querySelector('#editor');const d=getCurrentDocument();if(!e||!d)return;updateDocumentContent(e.innerHTML);try{await saveProject(d,false);const status=document.querySelector('#save-status');if(status)status.textContent='Autosaved';}catch(err){console.error(err);}},ms);};
 run();window.addEventListener('scriptsmith:settings-changed',run);
}

export function installRequestedFixes(){
 const observer=new MutationObserver(()=>{addOtherTemplate();addStructureTabs();});observer.observe(document.body,{childList:true,subtree:true});
 addOtherTemplate(); installTabIndent(); improveAutosave();
}
