import { createDocument, getCurrentDocument, setCurrentDocument, updateDocumentContent, updateDocumentTitle } from './document.js';
import { saveProject, openProject, clearCurrentPath, saveAutosave, loadAutosave, clearAutosave, hasAutosave, listLibraryDocuments, loadLibraryDocument } from './filesystem.js';
import { countWords, countCharacters } from './statistics.js';

const AUTOSAVE_INTERVAL = 10000;
const templates = [
  ['Blank Document', 'document'], ['Novel', 'novel'], ['Novella', 'novella'], ['Short Story', 'short-story'], ['Screenplay', 'screenplay'], ['Poetry', 'poetry']
];

export function initApp() {
  const app = document.querySelector('#app');
  setCurrentDocument(createDocument());
  clearCurrentPath();
  let isDirty = false;
  let autosaveInProgress = false;
  let homeVisible = true;

  app.innerHTML = `<div class="home" id="home">
    <header class="home-header"><div class="brand"><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Writer's Studio</small></div></div><button id="home-settings">Settings</button></header>
    <main class="home-content">
      <section class="welcome"><h1>What will you write?</h1><p>Start something new or return to a project.</p>
        <div class="template-grid" id="templates">${templates.map(([name,type]) => `<button class="template-card" data-template="${type}"><strong>${name}</strong><span>Start a new ${name.toLowerCase()}</span></button>`).join('')}</div>
      </section>
      <section class="library-section"><div class="section-heading"><div><h2>Your Library</h2><p>Your ScriptSmith projects stay available inside the app.</p></div><button id="home-open">Open from computer</button></div><div id="library" class="library-grid"><div class="library-empty">Loading your library…</div></div></section>
    </main>
  </div>
  <div id="editor-shell" hidden></div>`;

  async function refreshLibrary() {
    const library = document.querySelector('#library');
    const docs = await listLibraryDocuments();
    if (!docs.length) { library.innerHTML = '<div class="library-empty">No saved projects yet. Start a document above and save it.</div>'; return; }
    library.innerHTML = docs.map(doc => `<button class="project-card" data-library-id="${doc.libraryId || doc.id}"><span class="project-icon">S</span><span><strong>${escapeHtml(doc.title || 'Untitled Document')}</strong><small>${formatDate(doc.libraryUpdatedAt || doc.updatedAt)}</small></span></button>`).join('');
    library.querySelectorAll('.project-card').forEach(card => card.addEventListener('click', async () => {
      const doc = docs.find(item => (item.libraryId || item.id) === card.dataset.libraryId);
      if (doc) await openDocument(await loadLibraryDocument(doc));
    }));
  }

  function renderEditor() {
    document.querySelector('#home').hidden = true;
    homeVisible = false;
    const shell = document.querySelector('#editor-shell'); shell.hidden = false;
    shell.innerHTML = `<header class="topbar"><div class="brand"><button id="back-home" class="home-button">‹ Library</button><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Writer's Studio</small></div></div><div class="document-title"><input id="title" value="${escapeAttr(getCurrentDocument().title)}" aria-label="Document title"></div><div class="top-actions"><button id="new">New</button><button id="open">Open</button><button id="save">Save</button><button id="save-as">Save As</button></div></header>
    <main class="workspace"><aside class="sidebar"><h2>Project</h2><button class="side-button active" data-view="writing">Writing</button><button class="side-button" data-view="manuscript">Manuscript</button><button class="side-button" data-view="characters">Characters</button><button class="side-button" data-view="worldbuilding">Worldbuilding</button><button class="side-button" data-view="timeline">Timeline</button><button class="side-button" data-view="research">Research</button><button class="side-button" data-view="statistics">Statistics</button><div class="sidebar-spacer"></div><button class="side-button" data-view="settings">Settings</button></aside><section class="editor-area"><div class="toolbar"><button data-command="bold"><b>B</b></button><button data-command="italic"><i>I</i></button><button data-command="underline"><u>U</u></button><span class="toolbar-separator"></span><select id="font"><option>Georgia</option><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Garamond</option><option>Verdana</option><option>Tahoma</option><option>Trebuchet MS</option><option>Courier New</option><option>Lucida Console</option><option>Palatino Linotype</option><option>Book Antiqua</option><option>Cambria</option><option>Century Gothic</option><option>Consolas</option><option>Franklin Gothic Medium</option><option>Impact</option><option>Lucida Sans Unicode</option><option>Segoe UI</option><option>Gill Sans</option><option>Helvetica</option><option>Arial Black</option></select><select id="size">${Array.from({length:56},(_,i)=>`<option value="${i+9}">${i+9}</option>`).join('')}</select><span class="toolbar-separator"></span><button data-command="justifyLeft">Left</button><button data-command="justifyCenter">Center</button><button data-command="justifyRight">Right</button></div><article id="editor" class="page" contenteditable="true" spellcheck="true"></article><footer class="statusbar"><span id="save-status">Ready</span><span id="stats">0 words · 0 characters</span></footer></section></main>`;
    bindEditor();
  }

  async function openDocument(doc) { setCurrentDocument(doc); clearCurrentPath(); isDirty = false; renderEditor(); document.querySelector('#editor').innerHTML = doc.content || ''; updateStats(document.querySelector('#editor').innerText); document.querySelector('#save-status').textContent = 'Ready'; }
  function updateStats(text) { document.querySelector('#stats').textContent = `${countWords(text)} words · ${countCharacters(text)} characters`; }
  function markDirty() { isDirty = true; const status = document.querySelector('#save-status'); if (status) status.textContent = 'Unsaved changes'; }

  function showView(view, button) {
    document.querySelectorAll('.side-button[data-view]').forEach(item => item.classList.toggle('active', item === button));
    const editor = document.querySelector('#editor'); const toolbar = document.querySelector('.toolbar'); const status = document.querySelector('.statusbar');
    if (view === 'writing') { toolbar.hidden = false; editor.hidden = false; status.hidden = false; document.querySelector('#workspace-panel')?.remove(); return; }
    toolbar.hidden = true; editor.hidden = true; status.hidden = true;
    let panel = document.querySelector('#workspace-panel'); if (!panel) { panel = document.createElement('section'); panel.id='workspace-panel'; panel.className='page workspace-panel'; document.querySelector('.editor-area').insertBefore(panel,status); }
    panel.hidden=false; const names={manuscript:'Manuscript',characters:'Characters',worldbuilding:'Worldbuilding',timeline:'Timeline',research:'Research',statistics:'Statistics',settings:'Settings'}; panel.innerHTML=`<h1>${names[view]}</h1><p>This project area is ready for the next ScriptSmith sprint.</p>`;
  }

  async function save(saveAs=false) { try { const saved=await saveProject(getCurrentDocument(),saveAs); if(saved){isDirty=false; document.querySelector('#save-status').textContent='Saved'; await clearAutosave(); await refreshLibrary();}} catch(error){document.querySelector('#save-status').textContent=`Save failed: ${error}`;} }
  async function autosave(){if(!isDirty||autosaveInProgress)return;autosaveInProgress=true;try{await saveAutosave(getCurrentDocument());}catch(error){console.warn(error);}finally{autosaveInProgress=false;}}

  function bindEditor() {
    const editor=document.querySelector('#editor'), title=document.querySelector('#title');
    editor.addEventListener('input',()=>{updateDocumentContent(editor.innerHTML);updateStats(editor.innerText);markDirty();});
    title.addEventListener('input',()=>{updateDocumentTitle(title.value);markDirty();});
    document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>{editor.focus();document.execCommand(b.dataset.command,false);markDirty();}));
    document.querySelector('#font').addEventListener('change',e=>{editor.focus();document.execCommand('fontName',false,e.target.value);markDirty();});
    document.querySelector('#size').addEventListener('change',e=>{editor.focus();document.execCommand('fontSize',false,'7');editor.querySelectorAll('font[size="7"]').forEach(n=>{n.removeAttribute('size');n.style.fontSize=`${e.target.value}px`;});markDirty();});
    document.querySelectorAll('.side-button[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view,b)));
    document.querySelector('#save').onclick=()=>save(false); document.querySelector('#save-as').onclick=()=>save(true);
    document.querySelector('#new').onclick=()=>newDocument('document'); document.querySelector('#open').onclick=async()=>{const doc=await openProject();if(doc)await openDocument(doc);};
    document.querySelector('#back-home').onclick=async()=>{if(isDirty&&!confirm('You have unsaved changes. Return to Library anyway?'))return;document.querySelector('#editor-shell').hidden=true;document.querySelector('#home').hidden=false;homeVisible=true;await refreshLibrary();};
  }

  function newDocument(type){const doc=createDocument();doc.type=type;doc.title=type==='novel'?'Untitled Novel':type==='short-story'?'Untitled Short Story':type==='screenplay'?'Untitled Screenplay':type==='poetry'?'Untitled Poem':type==='novella'?'Untitled Novella':'Untitled Document';setCurrentDocument(doc);clearCurrentPath();isDirty=false;renderEditor();document.querySelector('#editor').innerHTML='';updateStats('');}
  document.querySelectorAll('[data-template]').forEach(b=>b.addEventListener('click',()=>newDocument(b.dataset.template)));
  document.querySelector('#home-open').onclick=async()=>{const doc=await openProject();if(doc)await openDocument(doc);};
  document.querySelector('#home-settings').onclick=()=>alert('Settings will be available in a future sprint.');
  setInterval(autosave,AUTOSAVE_INTERVAL);
  checkRecovery();
  refreshLibrary();

  async function checkRecovery(){try{if(!(await hasAutosave()))return;const recovered=await loadAutosave();if(recovered&&confirm(`ScriptSmith found a recovered copy of “${recovered.title||'Untitled Document'}”. Restore it?`)){setCurrentDocument(recovered);renderEditor();document.querySelector('#editor').innerHTML=recovered.content||'';updateStats(document.querySelector('#editor').innerText);isDirty=true;}else await clearAutosave();}catch(_) {}}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function escapeAttr(v){return escapeHtml(v);}
  function formatDate(v){try{return new Date(v).toLocaleString([], {month:'short',day:'numeric',year:'numeric'})}catch(_){return ''}}
}
