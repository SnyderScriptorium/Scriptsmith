import { createDocument, getCurrentDocument, setCurrentDocument, updateDocumentContent, updateDocumentTitle } from './document.js';
import { saveProject, openProject, clearCurrentPath } from './filesystem.js';
import { countWords, countCharacters } from './statistics.js';

export function initApp() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">S</span><div><strong>ScriptSmith</strong><small>Writer's Studio</small></div></div>
      <div class="document-title"><input id="title" value="Untitled Document" aria-label="Document title"></div>
      <div class="top-actions"><button id="new">New</button><button id="open">Open</button><button id="save">Save</button><button id="save-as">Save As</button></div>
    </header>
    <main class="workspace">
      <aside class="sidebar">
        <h2>Workspace</h2>
        <button class="side-button active">Writing</button><button class="side-button">Manuscript</button><button class="side-button">Characters</button><button class="side-button">Worldbuilding</button><button class="side-button">Timeline</button><button class="side-button">Research</button><button class="side-button">Statistics</button>
        <div class="sidebar-spacer"></div><button class="side-button">Settings</button>
      </aside>
      <section class="editor-area">
        <div class="toolbar" aria-label="Formatting toolbar">
          <button data-command="bold"><b>B</b></button><button data-command="italic"><i>I</i></button><button data-command="underline"><u>U</u></button><span class="toolbar-separator"></span>
          <select id="font"><option>Georgia</option><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Garamond</option></select>
          <select id="size"><option value="11">11</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="20">20</option><option value="24">24</option></select><span class="toolbar-separator"></span>
          <button data-command="justifyLeft">Left</button><button data-command="justifyCenter">Center</button><button data-command="justifyRight">Right</button>
        </div>
        <article id="editor" class="page" contenteditable="true" spellcheck="true" aria-label="ScriptSmith writing area"></article>
        <footer class="statusbar"><span id="save-status">Ready</span><span id="stats">0 words · 0 characters</span></footer>
      </section>
    </main>`;

  setCurrentDocument(createDocument());
  clearCurrentPath();
  let isDirty = false;
  const editor = document.querySelector('#editor');
  const title = document.querySelector('#title');
  const status = document.querySelector('#save-status');

  function markDirty() {
    isDirty = true;
    status.textContent = 'Unsaved changes';
  }

  function updateStats(text) {
    document.querySelector('#stats').textContent = `${countWords(text)} words · ${countCharacters(text)} characters`;
  }

  async function save(saveAs = false) {
    try {
      const saved = await saveProject(getCurrentDocument(), saveAs);
      if (saved) { isDirty = false; status.textContent = 'Saved'; }
    } catch (error) { status.textContent = `Save failed: ${error}`; }
  }

  editor.addEventListener('input', () => { updateDocumentContent(editor.innerHTML); updateStats(editor.innerText); markDirty(); });
  title.addEventListener('input', () => { updateDocumentTitle(title.value); markDirty(); });
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => { editor.focus(); document.execCommand(button.dataset.command, false); markDirty(); }));
  document.querySelector('#font').addEventListener('change', e => { editor.focus(); document.execCommand('fontName', false, e.target.value); markDirty(); });
  document.querySelector('#size').addEventListener('change', e => { editor.focus(); document.execCommand('fontSize', false, '7'); editor.querySelectorAll('font[size="7"]').forEach(n => n.removeAttribute('size')); markDirty(); });

  document.querySelector('#new').addEventListener('click', async () => {
    if (isDirty && !window.confirm('You have unsaved changes. Create a new document anyway?')) return;
    const doc = createDocument(); setCurrentDocument(doc); clearCurrentPath(); isDirty = false; title.value = doc.title; editor.innerHTML = ''; updateStats(''); status.textContent = 'Ready';
  });
  document.querySelector('#save').addEventListener('click', () => save(false));
  document.querySelector('#save-as').addEventListener('click', () => save(true));
  document.querySelector('#open').addEventListener('click', async () => {
    if (isDirty && !window.confirm('You have unsaved changes. Open another document anyway?')) return;
    try { const doc = await openProject(); if (!doc) return; setCurrentDocument(doc); title.value = doc.title; editor.innerHTML = doc.content || ''; updateStats(editor.innerText); isDirty = false; status.textContent = 'Opened'; }
    catch (error) { status.textContent = `Open failed: ${error}`; }
  });

  window.addEventListener('beforeunload', event => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
