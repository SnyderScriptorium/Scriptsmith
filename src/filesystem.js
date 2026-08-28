import { open } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile, readDir, remove } from '@tauri-apps/plugin-fs';
import { createBackup, shouldBackup } from './backups.js';
import { migrateDocument } from './document.js';

let currentPath = null;
const AUTOSAVE_DIR = 'ScriptSmith/autosave';
const AUTOSAVE_FILE = `${AUTOSAVE_DIR}/recovery.json`;
const LIBRARY_DIR = 'ScriptSmith/library';
const BACKUP_META_KEY = 'scriptsmith-last-backup';
const LOCAL_LIBRARY_KEY = 'scriptsmith-library-fallback';
function localLibrary(){try{return JSON.parse(localStorage.getItem(LOCAL_LIBRARY_KEY)||'{}')}catch(_){return {}}}
function writeLocalLibrary(record){const all=localLibrary();all[record.libraryId]=record;localStorage.setItem(LOCAL_LIBRARY_KEY,JSON.stringify(all));}
function readLocalLibrary(){const all=localLibrary();return Object.values(all).map(migrateDocument);}

export function getCurrentPath() { return currentPath; }
export async function saveProject(document, saveAs = false) {
  document = migrateDocument(document);
  if (saveAs) return exportProject(document);
  await saveToLibrary(document);
  try { const last=localStorage.getItem(BACKUP_META_KEY); if(shouldBackup(last)){await createBackup(document);localStorage.setItem(BACKUP_META_KEY,new Date().toISOString());} } catch(_){}
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scriptsmith:saved'));
  return true;
}
export async function exportProject(document) {
  document=migrateDocument(document);
  const {save}=await import('@tauri-apps/plugin-dialog');
  const path=await save({title:'Export ScriptSmith Document',defaultPath:`${safeName(document.title)}.scriptsmith.json`,filters:[{name:'ScriptSmith Document',extensions:['scriptsmith.json','json']}]});
  if(!path)return false; await writeTextFile(path,JSON.stringify(document,null,2)); currentPath=path; return true;
}
export async function openProject() {
  const path=await open({title:'Open ScriptSmith Document',multiple:false,filters:[{name:'ScriptSmith Document',extensions:['scriptsmith.json','json']}]});
  if(!path||Array.isArray(path))return null;
  const document=migrateDocument(JSON.parse(await readTextFile(path))); currentPath=path; await saveToLibrary(document);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scriptsmith:document-opened')); return document;
}
export async function saveToLibrary(document) {
  document=migrateDocument(document);
  const id=safeName(document.id||document.title||'Untitled Document').replace(/\s+/g,'-').toLowerCase();
  const record={...document,libraryId:id,libraryUpdatedAt:new Date().toISOString()};
  try { await mkdir(LIBRARY_DIR,{baseDir:BaseDirectory.AppData,recursive:true}); await writeTextFile(`${LIBRARY_DIR}/${id}.json`,JSON.stringify(record,null,2),{baseDir:BaseDirectory.AppData}); }
  catch(error){ writeLocalLibrary(record); }
}
export async function deleteLibraryDocument(documentOrId){
  const id=typeof documentOrId==='string' ? documentOrId : (documentOrId?.libraryId||documentOrId?.id);
  if(!id)return false;
  let removed=false;
  try { const path=`${LIBRARY_DIR}/${id}.json`; if(await exists(path,{baseDir:BaseDirectory.AppData})){await remove(path,{baseDir:BaseDirectory.AppData});removed=true;} } catch(_){}
  try { const all=localLibrary(); if(Object.prototype.hasOwnProperty.call(all,id)){delete all[id];localStorage.setItem(LOCAL_LIBRARY_KEY,JSON.stringify(all));removed=true;} } catch(_){}
  if(currentPath && String(currentPath).includes(`${id}.json`))currentPath=null;
  if(removed && typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scriptsmith:library-changed'));
  return removed;
}
export async function listLibraryDocuments() {
  const docs=[];
  try { await mkdir(LIBRARY_DIR,{baseDir:BaseDirectory.AppData,recursive:true}); const entries=await readDir(LIBRARY_DIR,{baseDir:BaseDirectory.AppData}); for(const entry of entries){if(!entry.name?.endsWith('.json'))continue;try{docs.push(migrateDocument(JSON.parse(await readTextFile(`${LIBRARY_DIR}/${entry.name}`,{baseDir:BaseDirectory.AppData}))));}catch(_){} } } catch(_){ }
  const merged=new Map(); [...docs,...readLocalLibrary()].forEach(d=>merged.set(d.libraryId||d.id,d));
  return [...merged.values()].sort((a,b)=>new Date(b.libraryUpdatedAt||b.updatedAt||0)-new Date(a.libraryUpdatedAt||a.updatedAt||0));
}
export async function loadLibraryDocument(document){
  const id=document.libraryId||document.id; if(!id)return migrateDocument(document);
  try{return migrateDocument(JSON.parse(await readTextFile(`${LIBRARY_DIR}/${id}.json`,{baseDir:BaseDirectory.AppData})));}
  catch(_){const local=localLibrary()[id];return local?migrateDocument(local):migrateDocument(document);}
}
export async function saveAutosave(document){await mkdir(AUTOSAVE_DIR,{baseDir:BaseDirectory.AppData,recursive:true});await writeTextFile(AUTOSAVE_FILE,JSON.stringify({version:2,savedAt:new Date().toISOString(),document:migrateDocument(document)},null,2),{baseDir:BaseDirectory.AppData});}
export async function hasAutosave(){return exists(AUTOSAVE_FILE,{baseDir:BaseDirectory.AppData});}
export async function loadAutosave(){if(!(await hasAutosave()))return null;const data=JSON.parse(await readTextFile(AUTOSAVE_FILE,{baseDir:BaseDirectory.AppData}));return migrateDocument(data.document||null);}
export async function clearAutosave(){try{if(await hasAutosave())await remove(AUTOSAVE_FILE,{baseDir:BaseDirectory.AppData});}catch(_){} }
export function clearCurrentPath(){currentPath=null;}
function safeName(value){return(value||'Untitled Document').replace(/[\\/:*?"<>|]/g,'-').trim();}
